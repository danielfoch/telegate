import test from 'node:test';
import assert from 'node:assert/strict';
import { createRelay, hash } from './server.mjs';
import { randomBytes } from 'node:crypto';

const harnesses=[{id:'codex-main',name:'Codex',kind:'codex',enabled:true}];
async function fixture(t,options={}) {
  const clock={time:Date.now()};
  const relay=createRelay({now:()=>clock.time,rateLimit:false,...options});
  await new Promise(r=>relay.server.listen(0,'127.0.0.1',r));
  t.after(()=>relay.close());
  const base=`http://127.0.0.1:${relay.server.address().port}`;
  const call=async(path,secret,body)=>{
    const res=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(secret?{Authorization:'Bearer '+secret}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:res.status,...await res.json()};
  };
  const register=async username=>{const r=await call('/v1/auth/register',null,{username,password:'test-password-with-entropy'});assert.equal(r.status,200);return r;};
  const pair=async(owner,name='Mac mini')=>{
    const secret=randomBytes(32).toString('base64url');
    const p=await call('/v1/pair/start',null,{name,platform:'darwin',harnesses,tokenHash:hash(secret)});assert.equal(p.status,200);
    const approved=await call('/v1/pair/approve',owner,{code:p.code});assert.equal(approved.status,200);
    const status=await call('/v1/pair/status',secret);assert.equal(status.status,'paired');
    return {secret,id:approved.deviceId,code:p.code};
  };
  const task=async(owner,d,overrides={})=>call('/v1/tasks',owner,{requestKey:randomBytes(16).toString('hex'),deviceId:d.id,harnessId:'codex-main',title:'Improve mobile',prompt:'Improve the mobile interface in the selected working folder.',send:true,...overrides});
  return {relay,clock,call,register,pair,task,base};
}
test('accounts cannot inspect, route to, revoke, or act on another account’s resources',async t=>{
  const f=await fixture(t),alice=await f.register('alice'),bob=await f.register('bob');
  const mac=await f.pair(alice.token),job=await f.task(alice.token,mac);
  assert.equal(job.status,200);
  assert.equal((await f.call('/v1/state',bob.token)).devices.length,0);
  assert.equal((await f.call('/v1/state',bob.token)).tasks.length,0);
  assert.equal((await f.task(bob.token,mac)).status,400);
  assert.equal((await f.call('/v1/devices/revoke',bob.token,{deviceId:mac.id})).status,404);
  assert.equal((await f.call('/v1/tasks/action',bob.token,{taskId:job.task.id,action:'cancel'})).status,404);
  assert.equal((await f.call('/v1/device/poll',alice.token,{harnesses})).status,401);
  assert.equal((await f.call('/v1/state',mac.secret)).status,401);
  const raw=f.relay.db.prepare('SELECT * FROM sessions').all();assert.ok(raw.every(s=>s.hash!==alice.token&&s.hash!==bob.token));
});
test('pairing requires the locally generated secret, expires, and is single use',async t=>{
  const f=await fixture(t),u=await f.register('alice');const secret=randomBytes(32).toString('hex');
  const p=await f.call('/v1/pair/start',null,{name:'My Mini',platform:'darwin',harnesses,tokenHash:hash(secret)});
  assert.equal((await f.call('/v1/pair/preview?code='+p.code,u.token)).name,'My Mini');
  assert.equal((await f.call('/v1/pair/status','wrong')).status,410);
  assert.equal((await f.call('/v1/pair/approve',u.token,{code:p.code})).status,200);
  assert.equal((await f.call('/v1/pair/approve',u.token,{code:p.code})).status,404);
  const p2=await f.call('/v1/pair/start',null,{name:'Other',platform:'darwin',harnesses,tokenHash:hash('other-secret')});
  f.clock.time+=601000;
  assert.equal((await f.call('/v1/pair/approve',u.token,{code:p2.code})).status,404);
});
test('exact device routing, atomic claim, and request idempotency',async t=>{
  const f=await fixture(t),u=await f.register('alice'),mini=await f.pair(u.token),laptop=await f.pair(u.token,'Laptop');
  const first=await f.task(u.token,mini,{requestKey:'same-request'});
  const retry=await f.task(u.token,mini,{requestKey:'same-request'});
  assert.equal(first.task.id,retry.task.id);
  assert.equal((await f.task(u.token,mini,{requestKey:'same-request',prompt:'Different operation'})).status,409);
  assert.equal((await f.call('/v1/device/poll',laptop.secret,{harnesses})).task,null);
  const polls=await Promise.all(Array.from({length:6},()=>f.call('/v1/device/poll',mini.secret,{harnesses})));
  assert.equal(polls.filter(p=>p.task).length,1);
  const task=polls.find(p=>p.task).task;assert.equal(task.status,'running');
  assert.equal((await f.call('/v1/device/result',mini.secret,{taskId:task.id,leaseId:'wrong',status:'completed',result:'bad'})).status,409);
  const result={taskId:task.id,leaseId:task.leaseId,status:'completed',result:'All done',runId:'thread-123'};
  assert.equal((await f.call('/v1/device/result',laptop.secret,result)).status,409);
  assert.equal((await f.call('/v1/device/result',mini.secret,result)).task.status,'completed');
  assert.equal((await f.call('/v1/device/result',mini.secret,{...result,status:'failed'})).task.status,'completed');
});
test('heartbeat extends lease; stale tasks need attention and never silently rerun',async t=>{
  const f=await fixture(t),u=await f.register('alice'),mini=await f.pair(u.token);
  await f.task(u.token,mini);
  const {task}=await f.call('/v1/device/poll',mini.secret,{harnesses});
  f.clock.time+=100000;
  await f.call('/v1/device/heartbeat',mini.secret,{harnesses,taskId:task.id,leaseId:task.leaseId});
  f.clock.time+=100000;
  assert.equal((await f.call('/v1/state',u.token)).tasks[0].status,'running');
  f.clock.time+=30000;
  assert.equal((await f.call('/v1/state',u.token)).tasks[0].status,'needs_attention');
  assert.equal((await f.call('/v1/device/poll',mini.secret,{harnesses})).task,null);
  assert.equal((await f.call('/v1/device/result',mini.secret,{taskId:task.id,leaseId:task.leaseId,status:'completed',result:'Late verified result'})).task.status,'completed');
});
test('revocation invalidates device tokens and cancels only unstarted work',async t=>{
  const f=await fixture(t),u=await f.register('alice'),mini=await f.pair(u.token);
  await f.task(u.token,mini);await f.call('/v1/device/poll',mini.secret,{harnesses});await f.task(u.token,mini);
  await f.call('/v1/devices/revoke',u.token,{deviceId:mini.id});
  assert.equal((await f.call('/v1/device/poll',mini.secret,{harnesses})).status,401);
  const state=await f.call('/v1/state',u.token);assert.equal(state.devices.length,0);
  assert.deepEqual(state.tasks.map(x=>x.status).sort(),['cancelled','needs_attention']);
});
test('drafts require send; disabled and invented harnesses cannot receive work',async t=>{
  const f=await fixture(t),u=await f.register('alice'),mini=await f.pair(u.token);
  assert.equal((await f.task(u.token,mini,{harnessId:'invented'})).status,400);
  const {task}=await f.task(u.token,mini,{send:false});
  assert.equal((await f.call('/v1/device/poll',mini.secret,{harnesses})).task,null);
  assert.equal((await f.call('/v1/tasks/action',u.token,{taskId:task.id,action:'send'})).task.status,'queued');
  assert.equal((await f.call('/v1/device/poll',mini.secret,{harnesses:[{...harnesses[0],enabled:false}]})).task,null);
});
test('recovery rotates recovery secret and sessions; deletion cascades to all user data',async t=>{
  const f=await fixture(t),u=await f.register('alice'),mini=await f.pair(u.token);await f.task(u.token,mini);
  const r=await f.call('/v1/auth/recover',null,{username:'alice',password:'new-test-password-long',recoveryKey:u.recoveryKey});
  assert.equal(r.status,200);assert.notEqual(r.recoveryKey,u.recoveryKey);
  assert.equal((await f.call('/v1/state',u.token)).status,401);
  assert.equal((await f.call('/v1/auth/recover',null,{username:'alice',password:'another-password-long',recoveryKey:u.recoveryKey})).status,401);
  assert.equal((await f.call('/v1/account/delete',r.token,{password:'wrong'})).status,401);
  assert.equal((await f.call('/v1/account/delete',r.token,{password:'new-test-password-long'})).status,200);
  for(const table of ['users','devices','tasks','sessions','pairings'])assert.equal(f.relay.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n,0);
});
test('origin, body limits, and optional pilot invitation are enforced',async t=>{
  const f=await fixture(t,{signupCode:'invitation'});
  assert.equal((await f.call('/v1/auth/register',null,{username:'alice',password:'test-password-with-entropy'})).status,403);
  const r=await fetch(f.base+'/v1/auth/register',{method:'POST',headers:{'content-type':'application/json',origin:'https://attacker.test'},body:'{}'});assert.equal(r.status,403);
  const huge=await fetch(f.base+'/v1/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({padding:'x'.repeat(71000)})});assert.equal(huge.status,413);
});
