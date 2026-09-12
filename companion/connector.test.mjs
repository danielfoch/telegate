import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRelay } from '../relay/server.mjs';
import { atomicJSON, request, startPairing, runConnector } from './client.mjs';

async function eventually(fn) {const deadline=Date.now()+5000;while(Date.now()<deadline){if(await fn())return;await new Promise(r=>setTimeout(r,20));}assert.fail('Timed out waiting for connector outcome.');}
async function setup(t) {
  const dir=await mkdtemp(join(tmpdir(),'telegate-test-'));
  const relay=createRelay({rateLimit:false});await new Promise(r=>relay.server.listen(0,'127.0.0.1',r));
  const service=`http://127.0.0.1:${relay.server.address().port}`;
  const u=await request(service,null,'/v1/auth/register',{username:'connector-test',password:'testing-password-long'});
  const counter=join(dir,'runs');
  const harnesses=[{id:'fake',name:'Fake harness',kind:'command',enabled:true,command:process.execPath,cwd:dir,args:['-e',`const fs=require('node:fs');fs.appendFileSync(${JSON.stringify(counter)},'run\\n');process.stdin.resume();process.stdin.on('end',()=>console.log('Verified fake result'));`]}];
  const p=await startPairing(service,'Test Mac','darwin',harnesses);
  const {deviceId}=await request(service,u.token,'/v1/pair/approve',{code:p.code});
  const path=join(dir,'computer.json');await atomicJSON(path,{service,deviceToken:p.secret,deviceId,harnesses});
  t.after(async()=>{await relay.close();await rm(dir,{recursive:true,force:true});});
  const submit=async key=>(await request(service,u.token,'/v1/tasks',{requestKey:key,deviceId,harnessId:'fake',title:'Fake task',prompt:'Only run the test fixture.',send:true})).task;
  const tasks=async()=>(await request(service,u.token,'/v1/state')).tasks;
  return {relay,service,u,path,dir,counter,harnesses,secret:p.secret,submit,tasks};
}
test('paired computer executes an assigned task and durably reports its result',async t=>{
  const f=await setup(t);await f.submit('execute-once');
  const controller=new AbortController();const running=runConnector(f.path,{signal:controller.signal,pollMs:20,log:()=>{}});
  try {
    await eventually(async()=>(await f.tasks())[0]?.status==='completed');
    const tasks=await f.tasks();assert.equal(tasks[0].result,'Verified fake result');
    const count=await readFile(f.counter,'utf8');assert.equal(count,'run\n');
    await assert.rejects(runConnector(f.path,{signal:controller.signal,pollMs:20,log:()=>{}}),/already running/);
  }finally{controller.abort();await running;}
});
test('restart recovers an interrupted claim without executing it again',async t=>{
  const f=await setup(t);await f.submit('interrupted');
  const {task}=await request(f.service,f.secret,'/v1/device/poll',{harnesses:f.harnesses.map(h=>({id:h.id,name:h.name,kind:h.kind,enabled:true}))});
  await atomicJSON(f.path+'.state.json',{active:task,outbox:null});
  const controller=new AbortController();const running=runConnector(f.path,{signal:controller.signal,pollMs:20,log:()=>{}});
  try{await eventually(async()=>(await f.tasks())[0]?.status==='needs_attention');await assert.rejects(readFile(f.counter),'ENOENT');}
  finally{controller.abort();await running;}
});
