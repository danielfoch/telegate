import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {createRelay, hash} from './server.mjs';

const submissionToken = 'adapter-secret-'.repeat(4), callbackKey = 'callback-secret-'.repeat(4);
const harnesses = [{id:'clydesdale', name:'Grok Bot / Clydesdale', kind:'webhook', enabled:true}];
async function fixture(t, extra={}) {
  const calls=[], clock={time:Date.now()};
  const options={publicURL:'https://relay.example.test', rateLimit:false, callbackKey, now:()=>clock.time,
    ...extra, grokbot:{webhookURL:'https://provider.example.test/hooks/dedicated', webhookToken:'provider-secret', submissionToken,
      fetchImpl:async (url,init)=>{calls.push({url,...init,body:JSON.parse(init.body)});return new Response('{}',{status:202});}, ...extra.grokbot}};
  let relay, base;
  async function open() {relay=createRelay(options);await new Promise(r=>relay.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${relay.server.address().port}`;}
  await open();t.after(()=>relay.close());
  const call=async(path,token,body,headers={})=>{
    const res=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
    return {code:res.status,...await res.json()};
  };
  const user=await call('/v1/auth/register',null,{username:'grok-test',password:'test-password-with-entropy'});
  assert.equal(user.code,200);
  const secret=randomBytes(32).toString('base64url');
  const pair=await call('/v1/pair/start',null,{name:'Mini',platform:'darwin',harnesses,tokenHash:hash(secret)});
  const device=await call('/v1/pair/approve',user.token,{code:pair.code});
  const claim=async()=>{
    const r=await call('/v1/tasks',user.token,{requestKey:randomBytes(16).toString('hex'),deviceId:device.deviceId,harnessId:'clydesdale',title:'Harmless test',prompt:'Return a test summary. Do not contact anybody.',send:true});
    assert.equal(r.code,200);
    const {task}=await call('/v1/device/poll',secret,{harnesses});assert.ok(task);
    return {task,body:{id:task.id,title:task.title,prompt:task.prompt,callback_url:task.callback.url,callback_token:task.callback.token,parent_task_id:task.parentTaskId,resume_run_id:task.resumeRunId}};
  };
  const submit=(body, token=submissionToken)=>call('/v1/adapters/grokbot/tasks',token,body,{'Idempotency-Key':body.id});
  const ack=task=>call('/v1/device/result',secret,{taskId:task.id,leaseId:task.leaseId,status:'submitted',result:'Accepted',runId:task.id});
  const complete=(body,outcome={status:'completed',result:'Verified test result'})=>call(new URL(body.callback_url).pathname,body.callback_token,outcome);
  return {get relay(){return relay;},call,claim,submit,ack,complete,calls,clock,user,secret,device,
    async restart(){await relay.close();await open();}};
}
test('Grok Bot round trip: durable acceptance, one HTTP dispatch, authenticated callback and push',async t=>{
  const pushes=[];
  const f=await fixture(t,{pushSender:async n=>{pushes.push(n);return {status:200};},pushEncryptionKey:randomBytes(32)});
  await f.call('/v1/notifications/register',f.user.token,{token:'ab'.repeat(32),environment:'sandbox'});
  const {task,body}=await f.claim();
  assert.equal((await f.submit(body)).status,'accepted');
  assert.equal(f.calls.length,0);
  assert.equal(f.relay.db.prepare('SELECT state FROM grokbot_deliveries').get().state,'pending');
  await f.ack(task); await f.relay.flushGrokbot();
  assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0].body,body);
  assert.equal(f.calls[0].headers.Authorization,'Bearer provider-secret');
  assert.equal(f.calls[0].headers['Idempotency-Key'],task.id);assert.equal(f.calls[0].redirect,'error');
  assert.equal((await f.complete(body)).task.status,'completed');
  await f.relay.flushPush();assert.equal(pushes.length,1);assert.equal(pushes[0].payload.taskId,task.id);
  assert.equal((await f.submit(body)).status,'accepted');await f.relay.flushGrokbot();assert.equal(f.calls.length,1);
  assert.equal((await f.complete(body,{status:'failed',result:'Do not overwrite'})).task.result,'Verified test result');
  await f.relay.flushPush();assert.equal(pushes.length,1);
});
test('submission rejects wrong bearer, invented tasks, modified briefs and arbitrary callback destinations',async t=>{
  const f=await fixture(t),{body}=await f.claim();
  assert.equal((await f.submit(body,'wrong')).code,401);
  assert.equal((await f.submit({...body,id:'invented'})).code,403);
  assert.equal((await f.submit({...body,callback_token:'wrong'})).code,403);
  for(const patch of [{prompt:'Changed'}, {title:'Changed'}, {resume_run_id:'unrelated'}, {parent_task_id:'other'}, {callback_url:'https://attacker.example.test/v1/hooks/tasks/'+body.id}, {callback_url:'http://127.0.0.1/v1/hooks/tasks/'+body.id}]) {
    assert.equal((await f.submit({...body,...patch})).code,409);
  }
  assert.equal((await f.call('/v1/adapters/grokbot/tasks',submissionToken,body,{'Idempotency-Key':'different'})).code,400);
  await f.relay.flushGrokbot();assert.equal(f.calls.length,0);
});
test('early completion survives the companion acceptance response',async t=>{
  const f=await fixture(t),{task,body}=await f.claim();await f.submit(body);await f.relay.flushGrokbot();
  await f.complete(body);assert.equal((await f.ack(task)).task.status,'completed');
});
test('ambiguous provider failure is reported without automatic execution retry or secret leakage',async t=>{
  let attempts=0;
  const f=await fixture(t,{grokbot:{fetchImpl:async()=>{attempts++;throw new Error('secret-provider-url-and-token');}}});
  const {task,body}=await f.claim();await f.submit(body);await f.relay.flushGrokbot();
  assert.equal((await f.ack(task)).task.status,'needs_attention');
  const state=await f.call('/v1/state',f.user.token);assert.doesNotMatch(JSON.stringify(state),/secret-provider/);
  await f.submit(body);await f.relay.flushGrokbot();assert.equal(attempts,1);
  assert.equal((await f.complete(body)).task.status,'completed');
});
test('a durable queued task survives restart; a crash during dispatch never replays',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'telegate-grok-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const f=await fixture(t,{database:join(dir,'relay.sqlite')});const {task,body}=await f.claim();
  await f.submit(body);await f.ack(task);await f.restart();await f.relay.flushGrokbot();assert.equal(f.calls.length,1);
  // Simulate a process dying after it marked the HTTP attempt, before persisting the response.
  f.relay.db.prepare("UPDATE grokbot_deliveries SET state='sending' WHERE task_id=?").run(task.id);
  await f.restart();await f.relay.flushGrokbot();assert.equal(f.calls.length,1);
  assert.equal((await f.call('/v1/state',f.user.token)).tasks[0].status,'needs_attention');
  assert.equal((await f.complete(body)).task.status,'completed');
});
test('deadline reports missing results and still accepts a late verified completion',async t=>{
  const f=await fixture(t,{grokbot:{completionTimeoutMs:60_000}}),{task,body}=await f.claim();
  await f.submit(body);await f.ack(task);await f.relay.flushGrokbot();f.clock.time+=61_000;await f.relay.flushGrokbot();
  assert.equal((await f.call('/v1/state',f.user.token)).tasks[0].status,'needs_attention');assert.equal(f.calls.length,1);
  assert.equal((await f.complete(body)).task.status,'completed');
});
test('revocation prevents queued dispatch and callbacks; account deletion removes adapter receipts',async t=>{
  const f=await fixture(t),{body}=await f.claim();await f.submit(body);
  await f.call('/v1/devices/revoke',f.user.token,{deviceId:f.device.deviceId});
  await f.relay.flushGrokbot();assert.equal(f.calls.length,0);assert.equal((await f.complete(body)).code,403);
  assert.equal((await f.call('/v1/account/delete',f.user.token,{password:'test-password-with-entropy'})).code,200);
  assert.equal(f.relay.db.prepare('SELECT count(*) AS n FROM grokbot_deliveries').get().n,0);
});
test('disabled harness is not dispatched and callback credentials cannot submit a second task',async t=>{
  const f=await fixture(t),{body}=await f.claim();await f.submit(body);
  await f.call('/v1/device/heartbeat',f.secret,{harnesses:[{...harnesses[0],enabled:false}]});
  await f.relay.flushGrokbot();assert.equal(f.calls.length,0);
  assert.equal((await f.submit(body,body.callback_token)).code,401);
});
