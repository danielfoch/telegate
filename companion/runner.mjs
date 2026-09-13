import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, stat, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { agentKinds, inspectAgentCLI, agentInvocation, parseAgentResult } from './agent-cli.mjs';
import { constants } from 'node:fs';
import { delimiter, join } from 'node:path';
const exec = promisify(execFile);
const cliChecks = new Map();
function harnessEnvironment() {
  const env = {...process.env};
  // Relay credentials belong to the connector, not the agent executing a brief.
  delete env.TELEGATE_DEVICE_TOKEN;
  delete env.TELEGATE_CONFIG;
  return env;
}
async function inspectLocalCLI(h) {
  const key = JSON.stringify([h.kind, h.command, h.cwd]);
  if (!cliChecks.has(key)) cliChecks.set(key, (async () => {
    try {
      const {stdout, stderr} = await exec(h.command, h.kind === 'codex' ? ['exec', '--help'] : ['--help'], {cwd:h.cwd, timeout:10000, maxBuffer:256000});
      const help = stdout + stderr;
      const flags = h.kind === 'codex' ? ['--json', '--approve-for-me'] : ['--print', '--output-format', '--resume'];
      if (!flags.every(flag => help.includes(flag))) return 'Update this agent: its CLI is missing required delegation options.';
      if (h.kind === 'codex') {
        try { await exec('git', ['rev-parse', '--show-toplevel'], {cwd:h.cwd, timeout:5000}); }
        catch { return 'Choose a Git project folder for Codex in Configure.'; }
      }
    } catch { return 'Cannot start this agent. Check its executable and installation.'; }
  })());
  return cliChecks.get(key);
}

function taskInput(task) {
  if (typeof task.prompt !== 'string' || !task.title || !task.id) throw new Error('Invalid task brief.');
  return `Task ID: ${task.id}\n\n${task.title}\n\n${task.prompt}\n\nUse your existing harness instructions and permissions. Report the outcome, artifacts, and any required user action. Do not claim an action succeeded without checking it.`;
}
export function invocation(task, adapter, options={}) {
  const input=taskInput(task);
  const resume=task.resumeRunId;
  if(resume && !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,199}$/.test(resume))throw new Error('The saved harness session ID is invalid. Open the harness to continue.');
  if(agentKinds.includes(adapter.kind)) {
    if(!adapter.command||!adapter.cwd)throw new Error('Choose an executable and working folder on this computer.');
    return agentInvocation(task,adapter,input,options);
  }
  const args=adapter.kind==='codex'?(resume?['exec','--approve-for-me','resume','--json',resume,'-']:['exec','--json','--approve-for-me','-']):
    adapter.kind==='claude'?['--print','--output-format','stream-json','--verbose',...(resume?['--resume',resume]:[])]:adapter.args;
  if (!['codex','claude','command'].includes(adapter.kind)||!Array.isArray(args)||!args.every(a=>typeof a==='string')) throw new Error('Invalid local harness configuration.');
  if (!adapter.command || !adapter.cwd) throw new Error('Choose an executable and working folder on this computer.');
  return {command:adapter.command,args,input};
}
export async function available(harnesses) {
  return Promise.all(harnesses.map(async h=>{
    let enabled=h.enabled!==false,problem;
    if (h.kind==='webhook') {
      try {const u=new URL(h.url); enabled &&= u.protocol==='https:' && !u.username && !u.password && !u.hash;}
      catch {enabled=false;}
      if(!enabled && h.enabled!==false)problem='Enter a valid HTTPS task endpoint without embedded credentials.';
    }
    else {
      try { if (!(await stat(h.cwd)).isDirectory()) enabled=false; } catch {enabled=false;}
      const paths=h.command?.includes('/')||h.command?.includes('\\')?[h.command]:(process.env.PATH||'').split(delimiter).map(p=>join(p,h.command||''));
      let executable=false;
      for (const p of paths) {try{await access(p,constants.X_OK);executable=true;break;}catch{}}
      enabled &&= executable;
      if(enabled && agentKinds.includes(h.kind)){const checked=await inspectAgentCLI(h);enabled=checked.ready;problem=checked.problem;}
      else if(enabled && ['codex','claude'].includes(h.kind)){problem=await inspectLocalCLI(h);enabled=!problem;}
      if(!enabled && h.enabled!==false && !problem)problem='Executable or working folder not found. Check Configure on this computer.';
    }
    return {id:h.id,name:h.name,kind:h.kind,enabled,...(problem?{problem}:{})};
  }));
}
export function parseResult(output,kind) {
  if(kind==='command') return {result:output.trim(),failed:false};
  let result='',runId,failed=false,attention=false;
  for(const line of output.split('\n')) {try{
    const e=JSON.parse(line);runId=e.thread_id||e.session_id||runId;
    if(e.type==='item.completed'&&e.item?.type==='agent_message')result+=e.item.text+'\n';
    if(e.type==='turn.failed'||e.type==='error'){failed=true;result+=e.error?.message||e.message||'Harness reported an error.';}
    if(e.type==='result'){result=e.result||result;failed=!!e.is_error;attention=!!e.permission_denials?.length;}
  }catch{}}
  return {result:result.trim(),runId,failed,attention};
}
export async function runTask(task,adapter,{signal,timeoutMs,onChild=()=>{}}={}) {
  timeoutMs ??= Math.max(1,Math.min(1440,Number(adapter.timeoutMinutes)||240))*60000;
  if(signal?.aborted)return {status:'needs_attention',result:'Connector stopped before execution. No harness process was started.'};
  if(adapter.kind==='webhook') {
    if(new URL(adapter.url).protocol!=='https:')throw new Error('Cloud harness endpoints must use HTTPS.');
    // URL and credentials are configured locally, never supplied by a task or model.
    const response=await fetch(adapter.url,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','Idempotency-Key':task.id,...(adapter.token?{Authorization:`Bearer ${adapter.token}`}:{})},body:JSON.stringify({id:task.id,title:task.title,prompt:task.prompt,parent_task_id:task.parentTaskId,resume_run_id:task.resumeRunId,callback_url:task.callback?.url,callback_token:task.callback?.token}),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000)});
    if(!response.ok)throw new Error(`Cloud harness returned HTTP ${response.status}. Inspect its queue before retrying.`);
    const r=await response.json();
    return {status:['completed','failed'].includes(r.status)?r.status:'submitted',result:String(r.result||r.message||'Accepted by the cloud harness. Continue in its app.'),runId:r.id,threadURL:r.thread_url||r.threadURL};
  }
  let capabilities,temporary,messageFile;
  if(agentKinds.includes(adapter.kind)) {
    capabilities=await inspectAgentCLI(adapter);
    if(!capabilities.ready)throw new Error(capabilities.problem);
    if(signal?.aborted)return {status:'needs_attention',result:'Connector stopped before execution. No harness process was started.'};
  }
  try {
    if(adapter.kind==='openclaw'){
      temporary=await mkdtemp(join(tmpdir(),'telegate-openclaw-'));messageFile=join(temporary,'brief.txt');
      await writeFile(messageFile,taskInput(task),{mode:0o600});
    }
    const call=invocation(task,adapter,{capabilities,messageFile,timeoutMs});
    return await new Promise(resolve=>{
    let stdout='',stderr='',interrupted=false,settled=false,killTimer;
    const child=spawn(call.command,call.args,{cwd:adapter.cwd,shell:false,stdio:['pipe','pipe','pipe'],env:harnessEnvironment(),detached:process.platform!=='win32'});
    const kill=sig=>{try{if(process.platform!=='win32'&&child.pid)process.kill(-child.pid,sig);else child.kill(sig);}catch{}};
    const stop=()=>{interrupted=true;kill('SIGTERM');killTimer=setTimeout(()=>kill('SIGKILL'),3000);killTimer.unref();};
    const timer=setTimeout(stop,timeoutMs);
    onChild(child);
    const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);clearTimeout(killTimer);signal?.removeEventListener('abort',stop);onChild(null);resolve(value);};
    signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted)stop();
    child.stdout.on('data',d=>{stdout=(stdout+d).slice(-250000);});
    child.stderr.on('data',d=>{stderr=(stderr+d).slice(-12000);});child.stdin.on('error',()=>{});
    child.once('error',e=>finish({status:'failed',result:e.message}));
    child.once('close',code=>{
      const parsed=agentKinds.includes(adapter.kind)?parseAgentResult(stdout,stderr,adapter.kind):parseResult(stdout,adapter.kind);
      finish({status:interrupted||parsed.attention?'needs_attention':code!==0||parsed.failed?'failed':parsed.result?'completed':'needs_attention',result:((interrupted?'Execution stopped. Inspect the harness before retrying.\n':'')+(parsed.result||stderr||'Harness exited without a result.')).slice(-48000),runId:call.runId||parsed.runId});
    });
    child.stdin.end(call.input);
    });
  } finally { if(temporary)await rm(temporary,{recursive:true,force:true}); }
}
