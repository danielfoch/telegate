import { randomBytes, createHash } from 'node:crypto';
import { readFile, writeFile, rename, mkdir, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { available, runTask } from './runner.mjs';
import { createScanner } from './projects.mjs';

export function validateService(value) {
  const url=new URL(value);
  if(url.protocol!=='https:' && !(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname))) throw new Error('Use an HTTPS service address. HTTP is only supported on localhost.');
  if(url.username||url.password||url.search||url.hash)throw new Error('Use a plain service URL.');
  return url.origin;
}
export async function request(base,secret,path,body,signal) {
  const r=await fetch(validateService(base)+path,{method:body===undefined?'GET':'POST',redirect:'error',headers:{'Content-Type':'application/json',...(secret?{Authorization:'Bearer '+secret}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)});
  const result=await r.json();
  if(!r.ok){const e=new Error(result.error||`Service returned ${r.status}.`);e.status=r.status;throw e;}return result;
}
export async function atomicJSON(path,value){await mkdir(dirname(path),{recursive:true,mode:0o700});const temp=path+'.tmp';await writeFile(temp,JSON.stringify(value,null,2),{mode:0o600});await rename(temp,path);}
export async function readJSON(path,fallback){try{return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
export async function startPairing(base,name,platform,harnesses) {
  const secret=randomBytes(32).toString('base64url');
  const pairing=await request(base,null,'/v1/pair/start',{name,platform,harnesses:await available(harnesses),tokenHash:createHash('sha256').update(secret).digest('hex')});
  return {secret,...pairing};
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export async function runConnector(configPath,{signal,log=console.log,pollMs=3000}={}) {
  const lock=configPath+'.lock';
  try{await mkdir(lock,{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw e;
    const previous=await readJSON(lock+'/pid.json',null);
    if(!previous)throw new Error('Connector lock is incomplete. Close other connectors before removing '+lock);
    let alive=true;try{process.kill(previous.pid,0);}catch(err){if(err.code==='ESRCH')alive=false;}
    if(alive)throw new Error('A connector is already running for this configuration.');
    await rm(lock,{recursive:true});await mkdir(lock,{mode:0o700});
  }
  await atomicJSON(lock+'/pid.json',{pid:process.pid});
  const statePath=configPath+'.state.json';let workController,revoked=false;
  const scan=createScanner(configPath,log);
  const scans=new Set();
  const scheduleScan=(...args)=>{const work=scan(...args).catch(e=>log('Project scan: '+e.message));scans.add(work);void work.finally(()=>scans.delete(work));};
  try {
    let state=await readJSON(statePath,{active:null,outbox:null});
    if(state.active&&!state.outbox){state.outbox={taskId:state.active.id,leaseId:state.active.leaseId,status:'needs_attention',result:'Connector restarted during execution. The task was not rerun. Inspect the harness before retrying.'};await atomicJSON(statePath,state);}
    while(!signal?.aborted&&!revoked){
      const config=await readJSON(configPath,null);if(!config)throw new Error('Set up this computer first.');
      const secret=process.env.TELEGATE_DEVICE_TOKEN||config.deviceToken;
      try {
        const hs=await available(config.harnesses||[]);
        if(state.outbox){await request(config.service,secret,'/v1/device/result',state.outbox);state={active:null,outbox:null};await atomicJSON(statePath,state);log('Result delivered.');}
        const {task,scan:scanPolicy}=await request(config.service,secret,'/v1/device/poll',{harnesses:hs});
        // Scanning is read-only and bounded. Do not delay claiming/executing a queued task for it.
        if(!signal?.aborted)scheduleScan(config,secret,scanPolicy);
        if(!task){await sleep(pollMs);continue;}
        state.active=task;await atomicJSON(statePath,state); // Durable claim before any execution.
        const adapter=config.harnesses.find(h=>h.id===task.harnessId&&hs.some(s=>s.id===h.id&&s.enabled));
        workController=new AbortController();
        const stop=()=>workController?.abort();signal?.addEventListener('abort',stop,{once:true});
        if(signal?.aborted)workController.abort();
        let heartbeatInFlight=false;
        const heartbeat=setInterval(async()=>{
          if(heartbeatInFlight)return;heartbeatInFlight=true;
          try{const r=await request(config.service,secret,'/v1/device/heartbeat',{harnesses:hs,taskId:task.id,leaseId:task.leaseId});if(!signal?.aborted)scheduleScan(config,secret,r.scan);}
          catch(e){if(e.status===401){revoked=true;workController.abort();}log('Heartbeat: '+e.message);}finally{heartbeatInFlight=false;}
        },10000);
        log(`Running ${task.title} on ${adapter?.name||task.harnessId}`);
        let result;
        try{if(!adapter)throw new Error('The selected harness is unavailable on this computer.');result=await runTask(task,adapter,{signal:workController.signal});}
        catch(e){result={status:'needs_attention',result:e.message};}
        finally{clearInterval(heartbeat);signal?.removeEventListener('abort',stop);workController=null;}
        state.outbox={taskId:task.id,leaseId:task.leaseId,...result};await atomicJSON(statePath,state);
        log(`Task ${result.status}.`);
      }catch(e){if(e.status===401){revoked=true;throw e;}if(e.status===409&&state.outbox){log('Result lease no longer matches. Inspect local saved state before reconnecting.');throw e;}log(e.message);await sleep(pollMs);}
    }
  }finally{workController?.abort();await Promise.allSettled([...scans]);await rm(lock,{recursive:true,force:true});}
}
