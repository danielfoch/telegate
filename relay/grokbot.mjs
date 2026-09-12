// Optional, single-bot cloud adapter hosted by the relay. No model/API key required.
import { createHash, timingSafeEqual } from 'node:crypto';

const digest = value => createHash('sha256').update(value).digest();
export const sameSecret = (a, b) => typeof a === 'string' && typeof b === 'string' && timingSafeEqual(digest(a), digest(b));
const fail = (status, message) => { throw Object.assign(new Error(message), {status}); };

export function createGrokbot({db, now, publicURL, callbackToken, finishTask, webhookURL, webhookToken = '', submissionToken, callbackKey, fetchImpl = fetch, completionTimeoutMs = 24 * 3600_000}) {
  let endpoint, origin;
  try { endpoint = new URL(webhookURL); origin = new URL(publicURL); } catch { throw new Error('Configure valid Grok Bot and relay HTTPS URLs.'); }
  if ([endpoint, origin].some(u => u.protocol !== 'https:' || u.username || u.password || u.hash) || origin.pathname !== '/' || origin.search) throw new Error('Grok Bot requires HTTPS and a relay origin without a path or credentials.');
  if (typeof submissionToken !== 'string' || submissionToken.length < 32 || typeof callbackKey !== 'string' || callbackKey.length < 32) throw new Error('Grok Bot requires submission and callback secrets of at least 32 characters.');
  if (webhookToken && (typeof webhookToken !== 'string' || /[\r\n]/.test(webhookToken))) throw new Error('Invalid Grok Bot webhook token.');
  if (!Number.isSafeInteger(completionTimeoutMs) || completionTimeoutMs < 60_000 || completionTimeoutMs > 7 * 86400_000) throw new Error('Grok Bot completion timeout must be between 1 minute and 7 days.');
  db.exec(`CREATE TABLE IF NOT EXISTS grokbot_deliveries (
    task_id TEXT PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
    state TEXT NOT NULL, created_at INTEGER NOT NULL, deadline INTEGER NOT NULL
  );`);
  const one = (sql, ...args) => db.prepare(sql).get(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const task = id => one('SELECT * FROM tasks WHERE id=?', id);
  const eligible = t => {
    if (!t?.lease_id || !['running', 'submitted', 'needs_attention'].includes(t.status)) return false;
    const d = one('SELECT * FROM devices WHERE id=? AND revoked=0', t.device_id);
    return d && JSON.parse(d.harnesses).some(h => h.id === t.harness_id && h.kind === 'webhook' && h.enabled);
  };
  const attention = (id, result) => {
    const t = task(id);
    if (eligible(t)) finishTask(t, {status:'needs_attention', result});
  };
  // The provider's webhook has no verified idempotency guarantee. An interrupted
  // HTTP attempt may have started work: never replay it after a process restart.
  for (const d of db.prepare("SELECT task_id FROM grokbot_deliveries WHERE state='sending'").all()) {
    run("UPDATE grokbot_deliveries SET state='uncertain' WHERE task_id=?", d.task_id);
    attention(d.task_id, 'The relay restarted during Grok Bot submission. Check Clydesdale before sending this work again.');
  }
  function submit(req, b) {
    if (!sameSecret(req.headers.authorization, 'Bearer ' + submissionToken)) fail(401, 'Grok Bot submission authentication failed.');
    if (typeof b.id !== 'string' || req.headers['idempotency-key'] !== b.id) fail(400, 'Idempotency-Key must match the task ID.');
    const t = task(b.id);
    if (!t || !sameSecret(b.callback_token, callbackToken(t))) fail(403, 'A claimed Telegate task and its callback credential are required.');
    const expectedCallback = new URL('/v1/hooks/tasks/' + t.id, origin).href;
    if (b.callback_url !== expectedCallback || b.title !== t.title || b.prompt !== t.prompt || (b.parent_task_id ?? null) !== t.parent_id || (b.resume_run_id ?? null) !== t.resume_run_id) fail(409, 'Submission differs from the saved Telegate brief.');
    const previous = one('SELECT state FROM grokbot_deliveries WHERE task_id=?', t.id);
    // A retry acknowledges the same receipt, even if completion raced its ACK.
    if (!previous) {
      if (!eligible(t)) fail(409, 'This task or its computer is no longer available.');
      run("INSERT INTO grokbot_deliveries VALUES (?,'pending',?,?)", t.id, now(), now() + completionTimeoutMs);
    }
    return {id:t.id, status:'accepted', message:'Saved for Grok Bot / Clydesdale. Completion will appear in Telegate.'};
  }
  let flushing = false, stopped = false;
  const controller = new AbortController();
  async function flush() {
    if (flushing || stopped) return;
    flushing = true;
    try {
      for (const d of db.prepare("SELECT * FROM grokbot_deliveries WHERE state IN ('pending','submitted') AND deadline<=?").all(now())) {
        run("UPDATE grokbot_deliveries SET state='timed_out' WHERE task_id=?", d.task_id);
        attention(d.task_id, 'Grok Bot has not reported a result before the configured deadline. Check Clydesdale; this task has not been resubmitted.');
      }
      const jobs = db.prepare("SELECT * FROM grokbot_deliveries WHERE state='pending' ORDER BY created_at LIMIT 8").all();
      for (const d of jobs) {
        if (stopped) break;
        const t = task(d.task_id);
        if (!eligible(t)) { run("UPDATE grokbot_deliveries SET state='cancelled' WHERE task_id=?", d.task_id); continue; }
        if (!run("UPDATE grokbot_deliveries SET state='sending' WHERE task_id=? AND state='pending'", t.id).changes) continue;
        try {
          const response = await fetchImpl(endpoint.href, {
            method:'POST', redirect:'error',
            headers:{'Content-Type':'application/json', 'Idempotency-Key':t.id, ...(webhookToken ? {Authorization:'Bearer ' + webhookToken} : {})},
            body:JSON.stringify({id:t.id, title:t.title, prompt:t.prompt, parent_task_id:t.parent_id, resume_run_id:t.resume_run_id,
              callback_url:new URL('/v1/hooks/tasks/' + t.id, origin).href, callback_token:callbackToken(t)}),
            signal:AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)])
          });
          await response.body?.cancel();
          if (!response.ok) throw new Error('Provider did not acknowledge receipt');
          run("UPDATE grokbot_deliveries SET state='submitted' WHERE task_id=?", t.id);
        } catch {
          run("UPDATE grokbot_deliveries SET state='uncertain' WHERE task_id=?", t.id);
          // Never log fetch errors: webhook URLs and authorization may be secret.
          attention(t.id, 'Grok Bot delivery could not be confirmed. Check Clydesdale before sending again; Telegate will not automatically repeat the work.');
        }
      }
    } finally { flushing = false; }
  }
  const timer = setInterval(() => void flush().catch(() => console.error('Grok Bot queue failed')), 1000);
  timer.unref();
  return {submit, flush, async close() { stopped = true; clearInterval(timer); controller.abort(); while (flushing) await new Promise(r => setTimeout(r, 10)); }};
}
