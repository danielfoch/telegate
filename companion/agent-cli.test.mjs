import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,stat,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {invocation,runTask,available} from './runner.mjs';
import {parseAgentResult} from './agent-cli.mjs';
import {createRelay} from '../relay/server.mjs';
import {request,startPairing,atomicJSON,runConnector} from './client.mjs';

const task={id:'test-job',title:'Harmless fixture',prompt:'literal $(touch injected) `echo unsafe`\n--yolo; /reset'};
async function fixture(t,kind,{legacy=false,outcome='ok'}={}) {
  const dir=await mkdtemp(join(tmpdir(),'telegate-agent-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const command=join(dir,kind), record=join(dir,'received.json');
  const source=`#!${process.execPath}
import fs from 'node:fs';
const args=process.argv.slice(2),value=f=>args[args.indexOf(f)+1];
if(args.includes('--help')){console.log(${JSON.stringify(kind==='openclaw'?'--agent --session-key --message-file --json --timeout':legacy?'--query --quiet --resume':'--query --query-file --quiet --resume')});process.exit(0);}
let input='';
if(args.includes('--message-file'))input=fs.readFileSync(value('--message-file'),'utf8');
else if(args.includes('--query'))input=value('--query');
else for await(const chunk of process.stdin)input+=chunk;
fs.writeFileSync(${JSON.stringify(record)},JSON.stringify({args,input,mode:args.includes('--message-file')?fs.statSync(value('--message-file')).mode&511:null,cwd:process.cwd()}));
${outcome==='timeout'?'setInterval(()=>{},1000);':kind==='openclaw'?`console.log(JSON.stringify({status:${JSON.stringify(outcome)},runId:'not-a-session',result:{payloads:[{text:'Verified OpenClaw result'}]}}));`:`console.log('Verified Hermes result');${legacy?"console.log('session_id: 20260912_200000_abcdef');":"console.error('session_id: 20260912_200000_abcdef');"}process.exit(${outcome==='ok'?0:1});`}
`;
  await writeFile(command,source,{mode:0o700});
  return {adapter:{id:kind,name:kind,kind,command,cwd:dir,enabled:true},dir,record};
}

test('OpenClaw uses a private file and isolated session; follow-up targets that exact session',async t=>{
  const f=await fixture(t,'openclaw');const result=await runTask(task,f.adapter);
  assert.equal(result.status,'completed');assert.equal(result.runId,'telegate-test-job');assert.equal(result.result,'Verified OpenClaw result');
  const sent=JSON.parse(await readFile(f.record,'utf8'));assert.ok(sent.input.includes(task.prompt));assert.equal(sent.mode,0o600);
  assert.equal(sent.args[sent.args.indexOf('--session-key')+1],'telegate-test-job');assert.equal(sent.args.includes(task.prompt),false);
  assert.ok(!sent.args.includes('--local')&&!sent.args.includes('--deliver'));
  const file=sent.args[sent.args.indexOf('--message-file')+1];await assert.rejects(stat(file),{code:'ENOENT'});
  const call=invocation({...task,id:'follow-up',resumeRunId:result.runId},f.adapter,{messageFile:'/private/brief.txt'});
  assert.equal(call.args[call.args.indexOf('--session-key')+1],result.runId);
  assert.throws(()=>invocation({...task,resumeRunId:'main'},f.adapter,{messageFile:'/brief'}),/session/);
  assert.throws(()=>invocation(task,{...f.adapter,agentId:'ops --deliver'},{messageFile:'/brief'}),/agent ID/);
  await assert.rejects(stat(join(f.dir,'injected')),{code:'ENOENT'});
});
for(const legacy of [false,true])test(`Hermes ${legacy?'legacy argv':'stdin'} executes a literal brief and captures a resumable session`,async t=>{
  const f=await fixture(t,'hermes',{legacy});const result=await runTask(task,f.adapter);
  assert.equal(result.status,'completed');assert.equal(result.result,'Verified Hermes result');assert.equal(result.runId,'20260912_200000_abcdef');
  const sent=JSON.parse(await readFile(f.record,'utf8'));assert.ok(sent.input.includes(task.prompt));assert.equal(sent.cwd,await realpath(f.dir));assert.ok(!sent.args.includes('--yolo'));
  assert.equal(sent.args.includes('--query-file'),!legacy);
  const follow=invocation({...task,resumeRunId:result.runId},f.adapter,{capabilities:{queryFile:!legacy}});
  assert.equal(follow.args[follow.args.indexOf('--resume')+1],result.runId);assert.ok(!follow.args.includes('--continue'));
  for(const resumeRunId of ['latest','--continue','main'])assert.throws(()=>invocation({...task,resumeRunId},f.adapter),/session/);
  await assert.rejects(stat(join(f.dir,'injected')),{code:'ENOENT'});
});
test('empty, malformed, incomplete and failed CLI results cannot become confirmed completion',async t=>{
  for(const value of ['{}','[]','null','not json',JSON.stringify({status:'accepted',result:{payloads:[{text:'Queued'}]}}),JSON.stringify({status:'ok',result:{meta:{aborted:true},payloads:[{text:'Aborted'}]}})])assert.equal(parseAgentResult(value,'','openclaw').attention,true);
  assert.equal(parseAgentResult('session_id: 20260912_200000_abcdef\n','','hermes').result,'');
  const f=await fixture(t,'hermes',{outcome:'failed'});assert.equal((await runTask(task,f.adapter)).status,'failed');
  const c=await fixture(t,'openclaw',{outcome:'in_flight'});assert.equal((await runTask(task,c.adapter)).status,'needs_attention');
});
test('cancelled and timed-out work stops locally and removes private task files',async t=>{
  const f=await fixture(t,'openclaw',{outcome:'timeout'}),abort=new AbortController();abort.abort();
  assert.equal((await runTask(task,f.adapter,{signal:abort.signal})).status,'needs_attention');
  await assert.rejects(stat(f.record),{code:'ENOENT'});
  const result=await runTask(task,f.adapter,{timeoutMs:1000});assert.equal(result.status,'needs_attention');
  const sent=JSON.parse(await readFile(f.record,'utf8'));await assert.rejects(stat(sent.args[sent.args.indexOf('--message-file')+1]),{code:'ENOENT'});
});
test('missing or incompatible harnesses are advertised as unavailable',async t=>{
  const f=await fixture(t,'openclaw');await writeFile(f.adapter.command,`#!${process.execPath}\nconsole.log('--message --json');\n`,{mode:0o700});
  const list=await available([f.adapter,{...f.adapter,id:'missing',command:'/missing/openclaw'}]);
  assert.ok(list.every(h=>!h.enabled));assert.match(list[0].problem,/Update OpenClaw/);
});
test('both new harness kinds pair, execute through Connect, report results and resume owned follow-ups',async t=>{
  const f=await fixture(t,'hermes'),g=await fixture(t,'openclaw'),harnesses=[f.adapter,g.adapter];
  const relay=createRelay({rateLimit:false});await new Promise(r=>relay.server.listen(0,'127.0.0.1',r));
  const service=`http://127.0.0.1:${relay.server.address().port}`,stop=new AbortController();let work;
  t.after(async()=>{stop.abort();await work;await relay.close();});
  const user=await request(service,null,'/v1/auth/register',{username:'new-harnesses',password:'long-test-password'});
  const pairing=await startPairing(service,'Mini','darwin',harnesses);const d=await request(service,user.token,'/v1/pair/approve',{code:pairing.code});
  const path=join(f.dir,'computer.json');await atomicJSON(path,{service,deviceToken:pairing.secret,harnesses});
  work=runConnector(path,{signal:stop.signal,pollMs:10,log:()=>{}});
  async function send(h,parentTaskId){
    const {task:queued}=await request(service,user.token,'/v1/tasks',{requestKey:crypto.randomUUID(),deviceId:d.deviceId,harnessId:h.id,title:task.title,prompt:task.prompt,send:true,parentTaskId});
    for(let i=0;i<200;i++){const state=await request(service,user.token,'/v1/state');const done=state.tasks.find(x=>x.id===queued.id);if(done.status==='completed')return done;await new Promise(r=>setTimeout(r,20));}
    assert.fail('No completed result');
  }
  for(const h of harnesses){const first=await send(h),second=await send(h,first.id);assert.ok(first.runId);assert.equal(second.resumeRunId,first.runId);assert.equal(second.runId,first.runId);}
});
