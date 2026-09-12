import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createRelay,hash } from './server.mjs';
import { request } from '../companion/client.mjs';
import { encryptToken,decryptToken } from './push.mjs';
async function setup(t,options={}) {
  const deliveries=[],clock={time:Date.now()};
  const relay=createRelay({rateLimit:false,now:()=>clock.time,publicURL:'https://relay.example.test',callbackKey:'test-callback-key',pushEncryptionKey:randomBytes(32),pushSender:async message=>{deliveries.push(message);return {status:200};},...options});
  await new Promise(r=>relay.server.listen(0,'127.0.0.1',r));t.after(()=>relay.close());
  const base=`http://127.0.0.1:${relay.server.address().port}`;
  const u=await request(base,null,'/v1/auth/register',{username:'alice',password:'private-test-password'});
  const hs=[{id:'cloud',name:'Cloud harness',kind:'webhook',enabled:true}];const secret=randomBytes(32).toString('hex');
  const p=await request(base,null,'/v1/pair/start',{name:'Mini',platform:'darwin',tokenHash:hash(secret),harnesses:hs});
  const {deviceId}=await request(base,u.token,'/v1/pair/approve',{code:p.code});
  const create=async(extra={})=>(await request(base,u.token,'/v1/tasks',{deviceId,harnessId:'cloud',requestKey:randomBytes(12).toString('hex'),title:'Private project task',prompt:'Private task details.',send:true,...extra})).task;
  const claim=async()=> (await request(base,secret,'/v1/device/poll',{harnesses:hs})).task;
  return {relay,deliveries,clock,base,u,secret,deviceId,hs,create,claim};
}
test('completion callback is task-scoped, idempotent, and not overwritten by submission acknowledgement',async t=>{
  const f=await setup(t);await f.create();const job=await f.claim();
  const path=new URL(job.callback.url).pathname;
  await assert.rejects(request(f.base,'incorrect',path,{status:'completed',result:'Fake'}),/authentication/);
  const result=await request(f.base,job.callback.token,path,{status:'completed',result:'Verified cloud result',runId:'cloud-run',thread_url:'https://harness.example.test/thread/cloud-run'});
  assert.equal(result.task.status,'completed');
  const late=await request(f.base,f.secret,'/v1/device/result',{taskId:job.id,leaseId:job.leaseId,status:'submitted',result:'Accepted'});assert.equal(late.task.status,'completed');assert.equal(late.task.result,'Verified cloud result');
  const duplicate=await request(f.base,job.callback.token,path,{status:'failed',result:'Different outcome'});assert.equal(duplicate.task.status,'completed');
  await f.create();const next=await f.claim();await assert.rejects(request(f.base,job.callback.token,new URL(next.callback.url).pathname,{status:'completed',result:'Wrong task'}),/authentication/);
  await request(f.base,f.u.token,'/v1/devices/revoke',{deviceId:f.deviceId});await assert.rejects(request(f.base,next.callback.token,new URL(next.callback.url).pathname,{status:'completed',result:'Revoked'}),/does not accept/);
});
test('durable completion notifications target only subscribed owner phones and contain no work content',async t=>{
  const f=await setup(t),pushToken='ab'.repeat(32);
  await request(f.base,f.u.token,'/v1/notifications/register',{token:pushToken,environment:'sandbox'});
  const row=f.relay.db.prepare('SELECT token FROM push_devices').get();assert.ok(!row.token.includes(pushToken));
  await f.create();const job=await f.claim();const callback=new URL(job.callback.url).pathname;
  await request(f.base,job.callback.token,callback,{status:'completed',result:'PRIVATE RESULT'});
  await request(f.base,job.callback.token,callback,{status:'completed',result:'PRIVATE RESULT'});
  assert.equal(f.relay.db.prepare('SELECT COUNT(*) AS n FROM notifications').get().n,1);
  await f.relay.flushPush();assert.equal(f.deliveries.length,1);assert.equal(f.deliveries[0].deviceToken,pushToken);assert.equal(f.deliveries[0].payload.taskId,job.id);
  assert.ok(!JSON.stringify(f.deliveries[0].payload).includes('PRIVATE'));assert.ok(!JSON.stringify(f.deliveries[0].payload).includes('Private project'));
  await f.relay.flushPush();assert.equal(f.deliveries.length,1);
});
test('APNs transient errors retry with stable identity; uninstalled device tokens are removed',async t=>{
  let calls=0;const f=await setup(t,{pushSender:async()=>{calls++;return calls===1?{status:503,reason:'ServiceUnavailable'}:{status:410,reason:'Unregistered'};}});
  await request(f.base,f.u.token,'/v1/notifications/register',{token:'cd'.repeat(32),environment:'sandbox'});
  await f.create();const job=await f.claim();await request(f.base,job.callback.token,new URL(job.callback.url).pathname,{status:'completed',result:'Done'});
  await f.relay.flushPush();assert.equal(calls,1);assert.equal(f.relay.db.prepare('SELECT state FROM notifications').get().state,'pending');
  await f.relay.flushPush();assert.equal(calls,1);
  f.clock.time+=31000;await f.relay.flushPush();assert.equal(calls,2);assert.equal(f.relay.db.prepare('SELECT COUNT(*) AS n FROM push_devices').get().n,0);
});
test('switching accounts on a phone removes the previous account’s pending notifications',async t=>{
  const f=await setup(t),pushToken='ef'.repeat(32);await request(f.base,f.u.token,'/v1/notifications/register',{token:pushToken,environment:'sandbox'});
  await f.create();const job=await f.claim();await request(f.base,job.callback.token,new URL(job.callback.url).pathname,{status:'completed',result:'Done'});
  const bob=await request(f.base,null,'/v1/auth/register',{username:'bob',password:'another-test-password'});
  await request(f.base,bob.token,'/v1/notifications/register',{token:pushToken,environment:'sandbox'});
  await f.relay.flushPush();assert.equal(f.deliveries.length,0);
});
test('follow-up routing derives the saved harness session from an owned completed task',async t=>{
  const f=await setup(t);await f.create();const job=await f.claim();
  await assert.rejects(f.create({parentTaskId:job.id}),/finish/);
  await request(f.base,job.callback.token,new URL(job.callback.url).pathname,{status:'completed',result:'Done',runId:'saved-session-123'});
  const child=await f.create({parentTaskId:job.id});assert.equal(child.resumeRunId,'saved-session-123');assert.equal(child.parentTaskId,job.id);
  const bob=await request(f.base,null,'/v1/auth/register',{username:'bob',password:'another-test-password'});
  await assert.rejects(request(f.base,bob.token,'/v1/tasks',{deviceId:f.deviceId,harnessId:'cloud',title:'Followup',prompt:'Another task',requestKey:'other-user',parentTaskId:job.id}),/not found/);
});
test('push tokens use authenticated encryption',()=>{const key=randomBytes(32),encrypted=encryptToken('private-device-token',key);assert.equal(decryptToken(encrypted,key),'private-device-token');const bytes=Buffer.from(encrypted,'base64');bytes[30]^=1;assert.throws(()=>decryptToken(bytes.toString('base64'),key));});

test('notification task lookup can retrieve older work and never another account’s task',async t=>{
  const f=await setup(t);const task=await f.create();
  f.relay.db.prepare('UPDATE tasks SET created_at=? WHERE id=?').run(1,task.id);
  const result=await request(f.base,f.u.token,'/v1/tasks/'+task.id);assert.equal(result.task.id,task.id);
  const bob=await request(f.base,null,'/v1/auth/register',{username:'bob',password:'another-test-password'});
  await assert.rejects(request(f.base,bob.token,'/v1/tasks/'+task.id),/not found/);
});
