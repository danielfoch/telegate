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
test('registration needs no invitation and still enforces origin and body limits',async t=>{
  // Stale deployment options must not bring back the removed gate.
  const f=await fixture(t,{signupCode:'legacy-invitation'});
  assert.equal((await f.call('/v1/auth/register',null,{username:'alice',password:'test-password-with-entropy'})).status,200);
  assert.equal((await f.call('/v1/auth/register',null,{username:'bob',password:'test-password-with-entropy',signupCode:'stale-phone-value'})).status,200);
  const r=await fetch(f.base+'/v1/auth/register',{method:'POST',headers:{'content-type':'application/json',origin:'https://attacker.test'},body:'{}'});assert.equal(r.status,403);
  const huge=await fetch(f.base+'/v1/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({padding:'x'.repeat(71000)})});assert.equal(huge.status,413);
});

test('dashboard counts accepted prompts once and estimates only confirmed completions',async t=>{
  const f=await fixture(t),u=await f.register('alice'),other=await f.register('bob'),d=await f.pair(u.token);
  const first=await f.task(u.token,d,{requestKey:'same'});await f.task(u.token,d,{requestKey:'same'});
  const draft=await f.task(u.token,d,{send:false});
  let stats=await f.call('/v1/dashboard',u.token);
  assert.deepEqual(stats.allTime,{promptsShipped:1,tasksCompleted:0,estimatedMinutesSaved:0});
  assert.equal(stats.preferences.leaderboardEnabled,false);
  const job=(await f.call('/v1/device/poll',d.secret,{harnesses})).task;
  const finish={taskId:job.id,leaseId:job.leaseId,status:'completed',result:'Done'};
  await f.call('/v1/device/result',d.secret,finish);await f.call('/v1/device/result',d.secret,finish);
  await f.call('/v1/tasks/action',u.token,{taskId:draft.task.id,action:'send'});
  await f.call('/v1/tasks/action',u.token,{taskId:draft.task.id,action:'cancel'});
  stats=await f.call('/v1/dashboard',u.token);
  assert.deepEqual(stats.allTime,{promptsShipped:2,tasksCompleted:1,estimatedMinutesSaved:30});
  assert.deepEqual((await f.call('/v1/dashboard',other.token)).allTime,{promptsShipped:0,tasksCompleted:0,estimatedMinutesSaved:0});
  assert.equal((await f.call('/v1/dashboard',d.secret)).status,401);
  stats=await f.call('/v1/dashboard/preferences',u.token,{minutesPerCompletedTask:90});
  assert.equal(stats.allTime.estimatedMinutesSaved,90);
  assert.equal((await f.call('/v1/dashboard/preferences',u.token,{minutesPerCompletedTask:-1})).status,400);
  assert.equal((await f.call('/v1/dashboard/preferences',u.token,{minutesPerCompletedTask:1.5})).status,400);
  assert.equal((await f.call('/v1/dashboard/preferences',u.token,{minutesPerCompletedTask:0})).allTime.estimatedMinutesSaved,0);
});
test('weekly metrics use first shipment and completion times rather than draft creation or callback retries',async t=>{
  const f=await fixture(t),u=await f.register('alice'),d=await f.pair(u.token);
  const draft=await f.task(u.token,d,{send:false});
  const old=await f.task(u.token,d);const job=(await f.call('/v1/device/poll',d.secret,{harnesses})).task;
  await f.call('/v1/device/result',d.secret,{taskId:job.id,leaseId:job.leaseId,status:'completed',result:'Done'});
  f.clock.time+=8*86400000;
  await f.call('/v1/device/result',d.secret,{taskId:job.id,leaseId:job.leaseId,status:'completed',result:'Done'});
  await f.call('/v1/tasks/action',u.token,{taskId:draft.task.id,action:'send'});
  let stats=await f.call('/v1/dashboard',u.token);
  assert.equal(stats.allTime.promptsShipped,2);assert.equal(stats.last7Days.promptsShipped,1);assert.equal(stats.last7Days.tasksCompleted,0);
  const next=(await f.call('/v1/device/poll',d.secret,{harnesses})).task;
  await f.call('/v1/device/result',d.secret,{taskId:next.id,leaseId:next.leaseId,status:'failed',result:'Not completed'});
  assert.equal((await f.call('/v1/dashboard',u.token)).last7Days.estimatedMinutesSaved,0);
});
test('leaderboard is opt-in, exposes aliases and counts only, ranks ties, and removes departed accounts',async t=>{
  const f=await fixture(t),alice=await f.register('private-alice'),bob=await f.register('private-bob');
  const a=await f.pair(alice.token),b=await f.pair(bob.token);
  await f.task(alice.token,a);await f.task(bob.token,b);
  assert.deepEqual((await f.call('/v1/leaderboard',alice.token)).entries,[]);
  assert.equal((await f.call('/v1/dashboard/preferences',alice.token,{leaderboardEnabled:true})).status,400);
  await f.call('/v1/dashboard/preferences',alice.token,{leaderboardEnabled:true,displayName:'Trail Walker'});
  await f.call('/v1/dashboard/preferences',bob.token,{leaderboardEnabled:true,displayName:'Ocean Air'});
  let board=await f.call('/v1/leaderboard',alice.token);
  assert.equal(board.entries.length,2);assert.deepEqual(board.entries.map(x=>x.rank),[1,1]);
  assert.equal(board.yourEntry.displayName,'Trail Walker');assert.equal(board.yourEntry.isYou,true);
  const serialized=JSON.stringify(board);
  for(const secret of ['private-alice','private-bob',alice.userId,bob.userId,'Improve mobile','Mac mini','estimatedMinutes'])assert.ok(!serialized.includes(secret));
  assert.deepEqual(Object.keys(board.entries[0]).sort(),['displayName','id','isYou','promptsShipped','rank','tasksCompleted'].sort());
  await f.call('/v1/dashboard/preferences',alice.token,{leaderboardEnabled:false});
  board=await f.call('/v1/leaderboard',alice.token);assert.equal(board.entries.length,1);assert.equal(board.yourEntry,null);
  await f.call('/v1/account/delete',bob.token,{password:'test-password-with-entropy'});
  assert.equal((await f.call('/v1/leaderboard',alice.token)).entries.length,0);
});
test('dashboard lifetime totals include tasks outside the latest-100 task feed',async t=>{
  const f=await fixture(t),u=await f.register('alice'),d=await f.pair(u.token);
  const original=(await f.task(u.token,d)).task;
  const insert=f.relay.db.prepare(`INSERT INTO tasks(id,owner,device_id,harness_id,title,prompt,status,request_key,fingerprint,created_at,updated_at,shipped_at,completed_at)
    SELECT ?,owner,device_id,harness_id,title,prompt,'completed',?,fingerprint,created_at,updated_at,shipped_at,? FROM tasks WHERE id=?`);
  for(let i=0;i<110;i++)insert.run('history-'+i,'history-'+i,f.clock.time,original.id);
  assert.equal((await f.call('/v1/state',u.token)).tasks.length,100);
  const stats=await f.call('/v1/dashboard',u.token);assert.equal(stats.allTime.promptsShipped,111);assert.equal(stats.allTime.tasksCompleted,110);assert.equal(stats.allTime.estimatedMinutesSaved,3300);
});
