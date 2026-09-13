import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const exec = promisify(execFile), cache = new Map();
export const agentKinds = ['openclaw', 'hermes'];
export const agentNames = {openclaw:'OpenClaw', hermes:'Hermes Agent'};

// Help probes never run a model. Cache them so heartbeat polling doesn't spawn
// a Python/Node CLI every few seconds. Restart Connect after updating a CLI.
export async function inspectAgentCLI(adapter) {
  const key=JSON.stringify([adapter.command,adapter.cwd,adapter.kind]);
  if(cache.has(key))return cache.get(key);
  const probe=(async()=>{
    try {
      const {stdout,stderr}=await exec(adapter.command,[adapter.kind==='openclaw'?'agent':'chat','--help'],{cwd:adapter.cwd,timeout:10000,maxBuffer:256000,windowsHide:true});
      const help=stdout+'\n'+stderr;
      const required=adapter.kind==='openclaw'?['--agent','--session-key','--message-file','--json','--timeout']:['--query','--quiet','--resume'];
      if(!required.every(flag=>help.includes(flag)))return {ready:false,problem:`Update ${agentNames[adapter.kind]}: this CLI is missing required task/session options.`};
      return {ready:true,queryFile:help.includes('--query-file')};
    } catch { return {ready:false,problem:`Cannot start ${agentNames[adapter.kind]}. Check its executable, installation and working folder on this computer.`}; }
  })();
  cache.set(key,probe);return probe;
}

export function agentInvocation(task,adapter,input,{capabilities,messageFile,timeoutMs}={}) {
  const resume=task.resumeRunId;
  if(adapter.kind==='openclaw') {
    const agentId=adapter.agentId||'main';
    if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(agentId))throw new Error('Choose a valid local OpenClaw agent ID.');
    const session=resume||`telegate-${task.id}`;
    if(!/^telegate-[a-zA-Z0-9_-]{1,160}$/.test(session))throw new Error('The saved OpenClaw session is invalid. Open OpenClaw to continue.');
    if(!messageFile)throw new Error('OpenClaw requires a private task file.');
    return {command:adapter.command,args:['agent','--agent',agentId,'--session-key',session,'--message-file',messageFile,'--json','--timeout',String(Math.max(1,Math.ceil((timeoutMs||240*60000)/1000)))],input:'',runId:session};
  }
  if(resume && (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,199}$/.test(resume)||['latest','last','main','default'].includes(resume.toLowerCase())))throw new Error('The saved Hermes session is invalid. Open Hermes to continue.');
  // Current Hermes reads stdin. Older releases only accept a literal argv value;
  // spawn(shell:false) keeps it data. Never build a shell command from a brief.
  return {command:adapter.command,args:['chat','--quiet',...(capabilities?.queryFile?['--query-file','-']:['--query',input]),...(resume?['--resume',resume]:[])],input:capabilities?.queryFile?input:''};
}

export function parseAgentResult(stdout,stderr,kind) {
  if(kind==='hermes') {
    const pattern=/^session_id:\s*([a-zA-Z0-9][a-zA-Z0-9_-]{0,199})\s*$/gm;
    const metadata=[...stderr.matchAll(pattern)].at(-1)||[...stdout.matchAll(pattern)].at(-1);
    const runId=metadata&&!['latest','last','main','default'].includes(metadata[1].toLowerCase())?metadata[1]:undefined;
    return {result:stdout.replace(/\n?session_id:\s*[a-zA-Z0-9][a-zA-Z0-9_-]{0,199}\s*$/,'').trim(),runId};
  }
  let envelope;
  try { envelope=JSON.parse(stdout); } catch { return {result:'OpenClaw did not return a valid JSON result. Inspect the gateway before retrying.',attention:true}; }
  if(!envelope||typeof envelope!=='object'||Array.isArray(envelope))return {result:'OpenClaw returned an unknown result format. Inspect the gateway before retrying.',attention:true};
  const result=envelope.result||envelope;
  const text=(Array.isArray(result.payloads)?result.payloads:[]).flatMap(p=>{
    if(!p||typeof p!=='object')return [];
    return [typeof p.text==='string'?p.text:'',...(Array.isArray(p.mediaUrls)?p.mediaUrls:[]),p.mediaUrl||''].filter(v=>typeof v==='string'&&v.trim());
  }).join('\n').trim();
  // A gateway receipt/in-flight/error isn't proof that work completed, even if
  // the process exits zero. Preserve an inspectable session without retrying.
  const ok=envelope.ok!==false&&['ok','completed'].includes(envelope.status)&&result.meta?.aborted!==true;
  return {result:text||(ok?'OpenClaw finished without a result.':String(envelope.error?.message||envelope.summary||'OpenClaw did not confirm completion. Inspect the gateway before retrying.')),attention:!ok||!text};
}
