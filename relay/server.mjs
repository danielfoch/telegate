import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, createHash, createHmac, scrypt, timingSafeEqual } from 'node:crypto';
import { createAPNsSender, encryptToken, decryptToken } from './push.mjs';
import { createMetrics } from './metrics.mjs';
import { createGrokbot } from './grokbot.mjs';
import { promisify } from 'node:util';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const derive = promisify(scrypt);
const token = () => randomBytes(32).toString('base64url');
export const hash = value => createHash('sha256').update(value).digest('hex');
class HTTPError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HTTPError(status, message); };
const string = (value, min, max, label) => {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) fail(400, `Invalid ${label}.`);
  return value.trim();
};
const credentials = async password => {
  string(password, 12, 256, 'password (12–256 characters)');
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await derive(password, salt, 64)).toString('hex')}`;
};
const verify = async (password, encoded) => {
  if (typeof password !== 'string' || password.length > 256) return false;
  const [salt, digest] = encoded.split(':');
  const actual = await derive(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(digest, 'hex'));
};
const harnesses = input => {
  if (!Array.isArray(input) || input.length > 30) fail(400, 'Add at most 30 harnesses.');
  const seen = new Set();
  return input.map(h => {
    const id = string(h.id, 1, 80, 'harness ID');
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || seen.has(id)) fail(400, 'Harness IDs must be unique.');
    seen.add(id);
    const kind = string(h.kind, 1, 30, 'harness type');
    if (!['codex', 'claude', 'command', 'webhook'].includes(kind)) fail(400, 'Unknown harness type.');
    return { id, name: string(h.name, 1, 100, 'harness name'), kind, enabled: h.enabled === true };
  });
};

export function createRelay({ database = ':memory:', now = Date.now, publicURL = 'http://127.0.0.1:8790', rateLimit = true, signupCode = '', callbackKey='', pushSender=null, pushEncryptionKey=null, grokbot=null } = {}) {
  if (database !== ':memory:') mkdirSync(dirname(resolve(database)), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(database);
  if (database !== ':memory:') chmodSync(database, 0o600);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL, recovery_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, platform TEXT NOT NULL, token_hash TEXT UNIQUE NOT NULL, harnesses TEXT NOT NULL DEFAULT '[]', last_seen INTEGER, revoked INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS pairings (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, token_hash TEXT UNIQUE NOT NULL, name TEXT NOT NULL, platform TEXT NOT NULL, harnesses TEXT NOT NULL, expires_at INTEGER NOT NULL, device_id TEXT REFERENCES devices(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE, harness_id TEXT NOT NULL, title TEXT NOT NULL, prompt TEXT NOT NULL, status TEXT NOT NULL, request_key TEXT NOT NULL, fingerprint TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, lease_id TEXT, lease_until INTEGER, result TEXT NOT NULL DEFAULT '', run_id TEXT, thread_url TEXT, UNIQUE(owner,request_key));
    CREATE INDEX IF NOT EXISTS queue ON tasks(device_id,status,created_at);
    CREATE INDEX IF NOT EXISTS owner_tasks ON tasks(owner,created_at);
    CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
    PRAGMA user_version=1;`);
  // Additive migration: preserve existing pilot accounts and tasks.
  if (!db.prepare('PRAGMA table_info(devices)').all().some(c=>c.name==='scan_minutes')) {
    db.exec('ALTER TABLE devices ADD COLUMN scan_minutes INTEGER NOT NULL DEFAULT 60; ALTER TABLE devices ADD COLUMN scan_requested TEXT;');
  }
  db.exec('CREATE TABLE IF NOT EXISTS project_snapshots (device_id TEXT PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE, scanned_at INTEGER NOT NULL, projects TEXT NOT NULL); PRAGMA user_version=2;');
  if(!db.prepare('PRAGMA table_info(tasks)').all().some(c=>c.name==='parent_id'))db.exec('ALTER TABLE tasks ADD COLUMN parent_id TEXT; ALTER TABLE tasks ADD COLUMN resume_run_id TEXT;');
  db.exec(`CREATE TABLE IF NOT EXISTS push_devices (id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, token TEXT NOT NULL, environment TEXT NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, push_id TEXT NOT NULL REFERENCES push_devices(id) ON DELETE CASCADE, outcome TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL, last_error TEXT, UNIQUE(task_id,push_id,outcome)); PRAGMA user_version=3;`);
  const metrics = createMetrics(db, now);
  const one = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const transaction = fn => { db.exec('BEGIN IMMEDIATE'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (e) { db.exec('ROLLBACK'); throw e; } };
  const limit = (key, max, window = 60_000) => {
    if (!rateLimit) return;
    const t = now();
    run('DELETE FROM limits WHERE expires_at < ?', t);
    const r = one(`INSERT INTO limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count`, key, t + window);
    if (r.count > max) fail(429, 'Too many attempts. Try again shortly.');
  };
  const bearer = req => {
    const a = req.headers.authorization;
    if (!a?.startsWith('Bearer ') || a.length > 512) fail(401, 'Sign in again.');
    return hash(a.slice(7));
  };
  const user = req => {
    const s = one('SELECT owner FROM sessions WHERE hash=? AND expires_at>?', bearer(req), now());
    if (!s) fail(401, 'Sign in again.');
    return s.owner;
  };
  const device = req => {
    const d = one('SELECT * FROM devices WHERE token_hash=? AND revoked=0', bearer(req));
    if (!d) fail(401, 'This computer is disconnected. Pair it again.');
    return d;
  };
  const session = owner => {
    const secret = token();
    run('INSERT INTO sessions VALUES (?,?,?)', hash(secret), owner, now() + 30 * 86400_000);
    return secret;
  };
  const taskJSON = t => ({ id:t.id, deviceId:t.device_id, harnessId:t.harness_id, title:t.title, prompt:t.prompt, status:t.status, createdAt:t.created_at, updatedAt:t.updated_at, result:t.result, runId:t.run_id, threadURL:t.thread_url, leaseId:t.lease_id, parentTaskId:t.parent_id,resumeRunId:t.resume_run_id });
  const pushReady=!!pushSender&&Buffer.isBuffer(pushEncryptionKey)&&pushEncryptionKey.length===32;
  const callbackToken=t=>createHmac('sha256',callbackKey).update(t.id+':'+t.lease_id).digest('base64url');
  const enqueue=t=>{
    if(!['completed','failed','needs_attention'].includes(t.status))return;
    for(const d of all('SELECT id FROM push_devices WHERE owner=?',t.owner))run('INSERT OR IGNORE INTO notifications(id,task_id,push_id,outcome,next_at) VALUES (?,?,?,?,?)',randomUUID(),t.id,d.id,t.status,now());
  };
  const finishTask=(t,b)=>transaction(()=>{
    if(!['running','needs_attention','submitted'].includes(t.status))return {ok:true,task:taskJSON(t)};
    let threadURL=null;
    if(b.threadURL){try{const u=new URL(b.threadURL);if(['https:','codex:'].includes(u.protocol))threadURL=u.href;}catch{}}
    run('UPDATE tasks SET status=?,result=?,run_id=COALESCE(?,run_id),thread_url=COALESCE(?,thread_url),updated_at=? WHERE id=?',b.status,string(b.result||'No result text provided.',1,48000,'result'),typeof b.runId==='string'?b.runId.slice(0,200):null,threadURL,now(),t.id);
    if(b.status==='completed')run('UPDATE tasks SET completed_at=COALESCE(completed_at,?) WHERE id=?',now(),t.id);
    const updated=one('SELECT * FROM tasks WHERE id=?',t.id);enqueue(updated);return {ok:true,task:taskJSON(updated)};
  });
  const grok = grokbot ? createGrokbot({...grokbot,db,now,publicURL,callbackToken,finishTask,callbackKey}) : null;
  let pushing=false;
  const flushPush=async()=>{
    if(pushing||!pushReady)return;pushing=true;
    try{
      run("UPDATE notifications SET state='pending' WHERE state='sending' AND next_at<?",now());
      const jobs=all("SELECT n.*,p.token,p.environment FROM notifications n JOIN push_devices p ON p.id=n.push_id WHERE n.state='pending' AND n.next_at<=? ORDER BY n.next_at LIMIT 20",now());
      for(const n of jobs){
        if(!run("UPDATE notifications SET state='sending',next_at=?,attempts=attempts+1 WHERE id=? AND state='pending'",now()+60000,n.id).changes)continue;
        try{
          const reply=await pushSender({deviceToken:decryptToken(n.token,pushEncryptionKey),environment:n.environment,notificationId:n.id,collapseId:n.task_id+':'+n.outcome,payload:{aps:{alert:{title:n.outcome==='completed'?'Your delegated work is ready':'Your delegated work needs attention',body:'Tap to review the result or continue by voice.'},sound:'default','thread-id':n.task_id},taskId:n.task_id}});
          if(reply.status===200)run("UPDATE notifications SET state='accepted',last_error=NULL WHERE id=?",n.id);
          else if(reply.status===410||reply.reason==='BadDeviceToken'||reply.reason==='DeviceTokenNotForTopic')run('DELETE FROM push_devices WHERE id=?',n.push_id);
          else throw new Error(reply.reason||`APNs ${reply.status}`);
        }catch(e){run('UPDATE notifications SET state=?,next_at=?,last_error=? WHERE id=?',n.attempts>=9?'failed':'pending',now()+Math.min(3600000,30000*2**n.attempts),String(e.message).slice(0,160),n.id);}
      }
    }finally{pushing=false;}
  };
  const pushTimer=setInterval(()=>void flushPush().catch(()=>console.error('Push queue failed')),5000);pushTimer.unref();
  const ownTask = (owner,id) => { const t=one('SELECT * FROM tasks WHERE id=? AND owner=?',id,owner); if (!t) fail(404,'Task not found.'); return t; };
  const expire = () => {
    run("UPDATE tasks SET status='needs_attention',result='Computer stopped reporting. Inspect the harness before retrying.',updated_at=? WHERE status='running' AND lease_until<?",now(),now());
    run('DELETE FROM pairings WHERE expires_at<?',now());
    run('DELETE FROM sessions WHERE expires_at<?',now());
  };
  async function route(req, url, b) {
    const p = url.pathname, method = req.method;
    // Never trust X-Forwarded-For from an arbitrary client. Reverse proxy isolates this listener.
    const ip = req.socket.remoteAddress || 'unknown';
    limit(`ip:${ip}`, 1200);
    expire();
    if (method === 'POST' && p === '/v1/adapters/grokbot/tasks') {
      if (!grok) fail(503, 'Grok Bot is not configured on this relay.');
      return grok.submit(req,b);
    }
    if (method === 'GET' && p === '/health') return { status: 'ok', version: 1 };
    if(method==='POST'&&p.startsWith('/v1/hooks/tasks/')) {
      const id=p.slice('/v1/hooks/tasks/'.length),t=one('SELECT * FROM tasks WHERE id=?',id);
      if(!callbackKey||!t?.lease_id||!timingSafeEqual(Buffer.from(bearer(req)),Buffer.from(hash(callbackToken(t)))))fail(401,'Callback authentication failed.');
      const d=one('SELECT * FROM devices WHERE id=? AND revoked=0',t.device_id);
      if(!d||!JSON.parse(d.harnesses).some(h=>h.id===t.harness_id&&h.kind==='webhook'))fail(403,'This task does not accept cloud callbacks.');
      if(!['completed','failed','needs_attention'].includes(b.status))fail(400,'Provide a terminal outcome.');
      return finishTask(t,{...b,threadURL:b.threadURL||b.thread_url});
    }
    if (method === 'POST' && p.startsWith('/v1/auth/')) {
      limit(`auth:${ip}`, 20);
      if (p === '/v1/auth/logout') { run('DELETE FROM sessions WHERE hash=?',bearer(req)); return {ok:true}; }
      const username = string(b.username,3,80,'account name').toLowerCase();
      if (!/^[a-z0-9][a-z0-9_.@+-]+$/.test(username)) fail(400,'Use letters, numbers, dots or underscores for your account name.');
      limit(`account:${username}`, 12);
      if (p === '/v1/auth/register') {
        if (signupCode && !timingSafeEqual(Buffer.from(hash(String(b.signupCode||''))),Buffer.from(hash(signupCode)))) fail(403,'A valid pilot invitation code is required.');
        if (one('SELECT id FROM users WHERE username=?',username)) fail(409,'That account name is already in use.');
        const password = await credentials(b.password), id=randomUUID(), recovery=token();
        try { run('INSERT INTO users VALUES (?,?,?,?,?)',id,username,password,hash(recovery),now()); }
        catch (e) { if (e.code?.includes('CONSTRAINT')) fail(409,'That account name is already in use.'); throw e; }
        return { token:session(id), userId:id, username, recoveryKey:recovery };
      }
      const u=one('SELECT * FROM users WHERE username=?',username);
      if (p === '/v1/auth/login') {
        // Equal work for absent users, reducing account-existence timing leakage.
        const valid=await verify(b.password,u?.password || `00000000000000000000000000000000:${'0'.repeat(128)}`);
        if (!u || !valid) fail(401,'Account name or password is incorrect.');
        return {token:session(u.id),userId:u.id,username};
      }
      if (p === '/v1/auth/recover') {
        if (!u || !timingSafeEqual(Buffer.from(hash(String(b.recoveryKey||''))),Buffer.from(u.recovery_hash))) fail(401,'Account name or recovery key is incorrect.');
        const password=await credentials(b.password), recovery=token();
        transaction(()=>{run('UPDATE users SET password=?, recovery_hash=? WHERE id=?',password,hash(recovery),u.id);run('DELETE FROM sessions WHERE owner=?',u.id);});
        return {token:session(u.id),userId:u.id,username,recoveryKey:recovery};
      }
      fail(404,'Route not found.');
    }
    if (method==='POST' && p==='/v1/pair/start') {
      limit(`pair-start:${ip}`,10);
      if (typeof b.tokenHash!=='string' || !/^[a-f0-9]{64}$/.test(b.tokenHash)) fail(400,'Invalid computer credential.');
      const existing=one('SELECT * FROM pairings WHERE token_hash=?',b.tokenHash);
      if (existing) return {id:existing.id,code:existing.code,expiresAt:existing.expires_at};
      const id=randomUUID(), code=randomBytes(5).toString('hex').toUpperCase(), expiresAt=now()+600_000;
      run('INSERT INTO pairings VALUES (?,?,?,?,?,?,?,NULL)',id,code,b.tokenHash,string(b.name,1,100,'computer name'),string(b.platform,1,50,'platform'),JSON.stringify(harnesses(b.harnesses||[])),expiresAt);
      return {id,code,expiresAt};
    }
    if (method==='GET' && p==='/v1/pair/status') {
      const r=one('SELECT * FROM pairings WHERE token_hash=?',bearer(req));
      if (!r) fail(410,'Pairing expired. Start again on your computer.');
      return {status:r.device_id?'paired':'pending',deviceId:r.device_id,expiresAt:r.expires_at};
    }
    if (p.startsWith('/v1/device/')) {
      const d=device(req); limit(`device:${d.id}`,100);
      const scan={intervalMinutes:d.scan_minutes,requestId:d.scan_requested};
      if (method==='POST' && p==='/v1/device/projects') {
        if (!Array.isArray(b.projects)||b.projects.length>30)fail(400,'Share at most 30 project summaries.');
        const hs=JSON.parse(d.harnesses).map(h=>h.id);
        const projects=b.projects.map(p=>{
          if (!Array.isArray(p.harnessIds)||!p.harnessIds.every(id=>hs.includes(id)))fail(400,'Project must belong to a configured harness.');
          return {id:string(p.id,1,80,'project ID'),name:string(p.name,1,120,'project name'),harnessIds:p.harnessIds,
            branch:typeof p.branch==='string'?p.branch.slice(0,120):null,
            changedFiles:Number.isSafeInteger(p.changedFiles)&&p.changedFiles>=0?Math.min(p.changedFiles,100000):null,
            latestCommit:typeof p.latestCommit==='string'?p.latestCommit.slice(0,200):null,
            latestCommitAt:Number.isFinite(p.latestCommitAt)&&p.latestCommitAt>=0?p.latestCommitAt:null,
            status:['ready','not_git','unavailable'].includes(p.status)?p.status:'unavailable'};
        });
        run('INSERT INTO project_snapshots VALUES (?,?,?) ON CONFLICT(device_id) DO UPDATE SET scanned_at=excluded.scanned_at,projects=excluded.projects',d.id,now(),JSON.stringify(projects));
        if(b.requestId)run('UPDATE devices SET scan_requested=NULL WHERE id=? AND scan_requested=?',d.id,b.requestId);
        return {ok:true};
      }
      if (method==='POST' && (p==='/v1/device/heartbeat'||p==='/v1/device/poll')) {
        const hs=harnesses(b.harnesses||JSON.parse(d.harnesses));
        run('UPDATE devices SET last_seen=?,harnesses=? WHERE id=?',now(),JSON.stringify(hs),d.id);
        if (b.taskId && b.leaseId) run("UPDATE tasks SET lease_until=? WHERE id=? AND device_id=? AND lease_id=? AND status='running'",now()+120_000,b.taskId,d.id,b.leaseId);
        if (p.endsWith('heartbeat')) return {ok:true,scan};
        const ids=hs.filter(h=>h.enabled).map(h=>h.id);
        if (!ids.length || one("SELECT id FROM tasks WHERE device_id=? AND status='running'",d.id)) return {task:null,scan};
        const t=one(`UPDATE tasks SET status='running',lease_id=?,lease_until=?,updated_at=? WHERE id=(SELECT id FROM tasks WHERE device_id=? AND status='queued' AND harness_id IN (${ids.map(()=>'?').join(',')}) ORDER BY created_at,id LIMIT 1) AND status='queued' RETURNING *`,token(),now()+120_000,now(),d.id,...ids);
        const task=t?taskJSON(t):null;
        if(task&&callbackKey&&new URL(publicURL).protocol==='https:'&&hs.some(h=>h.id===t.harness_id&&h.kind==='webhook'))task.callback={url:new URL('/v1/hooks/tasks/'+t.id,publicURL).href,token:callbackToken(t)};
        return {task,scan};
      }
      if (method==='POST' && p==='/v1/device/result') {
        const t=one('SELECT * FROM tasks WHERE id=? AND device_id=?',b.taskId,d.id);
        if (!t || t.lease_id!==b.leaseId) fail(409,'Task lease does not match.');
        if (!['completed','failed','needs_attention','submitted'].includes(b.status)) fail(400,'Invalid task outcome.');
        // An adapter can report a delivery problem before the companion's ACK.
        if (b.status==='submitted' && t.status==='needs_attention') return {ok:true,task:taskJSON(t)};
        return finishTask(t,b);
      }
      fail(404,'Route not found.');
    }
    const owner=user(req); limit(`user:${owner}`,180);
    if(method==='GET'&&p==='/v1/dashboard')return metrics.dashboard(owner);
    if(method==='POST'&&p==='/v1/dashboard/preferences')return metrics.update(owner,b);
    if(method==='GET'&&p==='/v1/leaderboard')return metrics.leaderboard(owner);
    if(method==='GET'&&p==='/v1/notifications/config')return {ready:pushReady};
    if(method==='POST'&&p==='/v1/notifications/register') {
      if(!pushReady)fail(503,'Push notifications have not been configured for this Telegate service.');
      const value=string(b.token,32,256,'push token').toLowerCase();if(!/^[a-fA-F0-9]+$/.test(value)||!['sandbox','production'].includes(b.environment))fail(400,'Invalid push registration.');
      run('DELETE FROM push_devices WHERE id=? AND owner<>?',hash(value+':'+b.environment),owner);
      run('INSERT INTO push_devices VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,token=excluded.token,environment=excluded.environment,updated_at=excluded.updated_at',hash(value+':'+b.environment),owner,encryptToken(value,pushEncryptionKey),b.environment,now());return {ok:true};
    }
    if(method==='POST'&&p==='/v1/notifications/unregister') {run('DELETE FROM push_devices WHERE owner=? AND id=?',owner,hash(String(b.token).toLowerCase()+':'+String(b.environment)));return {ok:true};}
    if (method==='GET' && /^\/v1\/tasks\/[a-zA-Z0-9-]+$/.test(p)) return {task:taskJSON(ownTask(owner,p.split('/').at(-1)))};
    if (method==='GET' && p==='/v1/state') return {
      devices:all('SELECT * FROM devices WHERE owner=? AND revoked=0 ORDER BY name',owner).map(d=>{const snapshot=one('SELECT * FROM project_snapshots WHERE device_id=?',d.id);return {id:d.id,name:d.name,platform:d.platform,harnesses:JSON.parse(d.harnesses),online:d.last_seen!==null&&now()-d.last_seen<45_000,lastSeen:d.last_seen,scanMinutes:d.scan_minutes,scanRequested:!!d.scan_requested,scannedAt:snapshot?.scanned_at ?? null,projects:snapshot?JSON.parse(snapshot.projects):[]};}),
      tasks:all('SELECT * FROM tasks WHERE owner=? ORDER BY created_at DESC LIMIT 100',owner).map(taskJSON)
    };
    if (p==='/v1/pair/preview'||p==='/v1/pair/approve') {
      limit(`pair-code:${owner}`,12);
      const code=string(method==='GET'?url.searchParams.get('code'):b.code,10,20,'pairing code').replace(/[-\s]/g,'').toUpperCase();
      const pair=one('SELECT * FROM pairings WHERE code=? AND device_id IS NULL',code);
      if (!pair) fail(404,'Code expired or already used. Get a new code on your computer.');
      if (method==='GET'&&p.endsWith('preview')) return {name:pair.name,platform:pair.platform,harnesses:JSON.parse(pair.harnesses),expiresAt:pair.expires_at};
      if (method==='POST'&&p.endsWith('approve')) return transaction(()=>{
        if (one('SELECT COUNT(*) AS n FROM devices WHERE owner=? AND revoked=0',owner).n>=30) fail(409,'Disconnect a computer before adding more than 30.');
        const id=randomUUID();
        run('INSERT INTO devices(id,owner,name,platform,token_hash,harnesses) VALUES (?,?,?,?,?,?)',id,owner,pair.name,pair.platform,pair.token_hash,pair.harnesses);
        run('UPDATE pairings SET device_id=? WHERE id=? AND device_id IS NULL',id,pair.id);
        return {ok:true,deviceId:id};
      });
    }
    if (method==='POST'&&p==='/v1/devices/revoke') return transaction(()=>{
      const id=string(b.deviceId,1,100,'computer');
      if (!run('UPDATE devices SET revoked=1 WHERE id=? AND owner=?',id,owner).changes) fail(404,'Computer not found.');
      run("UPDATE tasks SET status='cancelled',updated_at=? WHERE device_id=? AND owner=? AND status IN ('queued','draft')",now(),id,owner);
      run("UPDATE tasks SET status='needs_attention',result='Computer disconnected. The local connector will stop its active process when it detects revocation; check the computer for any completed effects.',updated_at=? WHERE device_id=? AND owner=? AND status='running'",now(),id,owner);
      return {ok:true};
    });
    if(method==='POST'&&p==='/v1/devices/scan') {
      const id=string(b.deviceId,1,100,'computer');
      if(!one('SELECT id FROM devices WHERE id=? AND owner=? AND revoked=0',id,owner))fail(404,'Computer not found.');
      if(b.intervalMinutes!==undefined){if(![0,5,15,30,60,180,360,720,1440].includes(b.intervalMinutes))fail(400,'Choose a supported scan interval.');run('UPDATE devices SET scan_minutes=? WHERE id=? AND owner=?',b.intervalMinutes,id,owner);}
      if(b.scanNow===true)run('UPDATE devices SET scan_requested=? WHERE id=? AND owner=?',randomUUID(),id,owner);
      return {ok:true};
    }
    if (method==='POST'&&p==='/v1/tasks') {
      const key=string(b.requestKey,1,200,'request ID'), deviceId=string(b.deviceId,1,100,'computer'), harnessId=string(b.harnessId,1,80,'harness');
      const title=string(b.title,1,160,'title'), prompt=string(b.prompt,1,16000,'brief'), status=b.send===true?'queued':'draft';
      const parent=b.parentTaskId?ownTask(owner,string(b.parentTaskId,1,100,'parent task')):null;
      if(parent&&(parent.device_id!==deviceId||parent.harness_id!==harnessId))fail(400,'A follow-up must use the original computer and harness.');
      if(parent&&!['completed','failed','needs_attention'].includes(parent.status))fail(409,'Wait for the existing task to finish before continuing its session.');
      const fingerprint=hash(JSON.stringify([deviceId,harnessId,title,prompt,status,parent?.id||null]));
      const previous=one('SELECT * FROM tasks WHERE owner=? AND request_key=?',owner,key);
      if (previous) { if (previous.fingerprint!==fingerprint) fail(409,'This request ID was already used for a different brief.'); return {task:taskJSON(previous)}; }
      const d=one('SELECT * FROM devices WHERE id=? AND owner=? AND revoked=0',deviceId,owner);
      if (!d || !JSON.parse(d.harnesses).some(h=>h.id===harnessId&&h.enabled)) fail(400,'Choose one of your configured harnesses.');
      if (one("SELECT COUNT(*) AS n FROM tasks WHERE owner=? AND status IN ('queued','draft')",owner).n>=100) fail(409,'Finish or cancel some queued work before adding more.');
      const id=randomUUID();
      run('INSERT INTO tasks(id,owner,device_id,harness_id,title,prompt,status,request_key,fingerprint,created_at,updated_at,parent_id,resume_run_id,shipped_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id,owner,deviceId,harnessId,title,prompt,status,key,fingerprint,now(),now(),parent?.id??null,parent?.run_id??null,status==='queued'?now():null);
      return {task:taskJSON(ownTask(owner,id))};
    }
    if (method==='POST'&&p==='/v1/tasks/action') {
      const t=ownTask(owner,string(b.taskId,1,100,'task'));
      if (b.action==='send'&&t.status==='draft') {
        const d=one('SELECT * FROM devices WHERE id=? AND owner=? AND revoked=0',t.device_id,owner);
        if (!d||!JSON.parse(d.harnesses).some(h=>h.id===t.harness_id&&h.enabled)) fail(409,'This harness is disconnected.');
        run("UPDATE tasks SET status='queued',updated_at=?,shipped_at=COALESCE(shipped_at,?) WHERE id=? AND status='draft'",now(),now(),t.id);
      } else if (b.action==='cancel'&&['draft','queued'].includes(t.status)) run("UPDATE tasks SET status='cancelled',updated_at=? WHERE id=? AND status IN ('draft','queued')",now(),t.id);
      else fail(409,'This task has already moved on. Refresh its status.');
      return {task:taskJSON(ownTask(owner,t.id))};
    }
    if (method==='POST'&&p==='/v1/account/delete') {
      const u=one('SELECT * FROM users WHERE id=?',owner);
      if (!await verify(b.password,u.password)) fail(401,'Password is incorrect.');
      run('DELETE FROM users WHERE id=?',owner);
      return {ok:true};
    }
    fail(404,'Route not found.');
  }
  const server=createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.setHeader('X-Content-Type-Options','nosniff');
    try {
      if (req.headers.origin && req.headers.origin!==new URL(publicURL).origin) fail(403,'Unexpected request origin.');
      const url=new URL(req.url,'http://localhost');
      if (req.method!=='GET' && !req.headers['content-type']?.startsWith('application/json')) fail(415,'Send JSON.');
      let size=0;const chunks=[];
      for await (const c of req) { size+=c.length; if(size>70000)fail(413,'Request is too large.');chunks.push(c); }
      let body={}; if (size) { try { body=JSON.parse(Buffer.concat(chunks)); } catch { fail(400,'Invalid JSON.'); } }
      if (!body || Array.isArray(body) || typeof body!=='object') fail(400,'Send a JSON object.');
      const result=await route(req,url,body);res.end(JSON.stringify(result));
    } catch(e) { res.statusCode=e.status||500;res.end(JSON.stringify({error:e.status?e.message:'The service could not complete this request.'})); if(!e.status) console.error('Relay error:',e.code||e.name); }
  });
  server.requestTimeout=15000;server.headersTimeout=10000;
  return { server, db, flushPush, flushGrokbot:()=>grok?.flush(), close:async()=>{await grok?.close();clearInterval(pushTimer);while(pushing)await new Promise(r=>setTimeout(r,10));pushSender?.close?.();await new Promise(resolve=>server.close(resolve));db.close();} };
}
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const publicURL=process.env.PUBLIC_URL||'http://127.0.0.1:8790';
  if (process.env.NODE_ENV==='production' && !publicURL.startsWith('https://')) throw new Error('Production PUBLIC_URL must use HTTPS.');
  const pushSender=createAPNsSender({keyFile:process.env.APNS_KEY_FILE,keyId:process.env.APNS_KEY_ID,teamId:process.env.APNS_TEAM_ID,bundleId:process.env.APNS_BUNDLE_ID});
  const pushEncryptionKey=process.env.PUSH_ENCRYPTION_KEY?Buffer.from(process.env.PUSH_ENCRYPTION_KEY,'base64'):null;
  if(pushSender&&pushEncryptionKey?.length!==32)throw new Error('Configure a 32-byte base64 PUSH_ENCRYPTION_KEY before enabling APNs.');
  const grokbot=process.env.GROKBOT_WEBHOOK_URL ? {webhookURL:process.env.GROKBOT_WEBHOOK_URL,webhookToken:process.env.GROKBOT_WEBHOOK_TOKEN||'',submissionToken:process.env.GROKBOT_SUBMISSION_TOKEN,completionTimeoutMs:Number(process.env.GROKBOT_COMPLETION_TIMEOUT_MINUTES||1440)*60_000} : null;
  const relay=createRelay({grokbot,database:process.env.DATABASE_PATH||'./data/telegate.sqlite',publicURL,signupCode:process.env.SIGNUP_CODE||'',callbackKey:process.env.CALLBACK_SIGNING_KEY||'',pushSender,pushEncryptionKey});
  relay.server.listen(Number(process.env.PORT||8790),process.env.HOST||'127.0.0.1',()=>console.log(`Telegate relay listening at ${publicURL}`));
  for (const signal of ['SIGINT','SIGTERM']) process.once(signal,async()=>{await relay.close();process.exit(0);});
}
