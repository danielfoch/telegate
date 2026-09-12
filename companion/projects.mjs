import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { realpath, lstat } from 'node:fs/promises';
import { basename } from 'node:path';
import { createHash } from 'node:crypto';
import { atomicJSON, readJSON, request } from './client.mjs';
const execute=promisify(execFile);
const git=async(cwd,args)=>{
  const {stdout}=await execute('git',['--no-optional-locks','-c','core.fsmonitor=false','-c','core.untrackedCache=false','-C',cwd,...args],{timeout:3500,maxBuffer:256000,encoding:'utf8',env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'}});
  return stdout.trim();
};
export async function scanProjects(harnesses) {
  const roots=new Map();
  for(const h of harnesses.slice(0,30)) {
    // A phone cannot add scan roots. Opt-in and folders are configured on this computer.
    if(h.shareProjectContext!==true||h.kind==='webhook'||!h.cwd)continue;
    try {
      const s=await lstat(h.cwd);if(!s.isDirectory()||s.isSymbolicLink())continue;
      const cwd=await realpath(h.cwd);
      if(roots.has(cwd))roots.get(cwd).push(h.id);else roots.set(cwd,[h.id]);
    }catch{}
  }
  const projects=[];
  for(const [cwd,harnessIds] of roots) {
    const project={id:createHash('sha256').update(cwd).digest('hex'),name:basename(cwd),harnessIds,branch:null,changedFiles:null,latestCommit:null,latestCommitAt:null,status:'not_git'};
    try {
      // Refuse parent-repository discovery: a selected folder is not permission to inspect its parents.
      const root=await git(cwd,['rev-parse','--show-toplevel']);
      if(await realpath(root)!==cwd){projects.push(project);continue;}
      project.status='ready';
      project.branch=await git(cwd,['symbolic-ref','--short','-q','HEAD']).catch(()=> 'Detached HEAD');
      // File names and diff contents never leave this process; count records only.
      const changes=await git(cwd,['status','--porcelain=v1','-z','--untracked-files=normal']);
      const records=changes.split('\0');let count=0;
      for(let i=0;i<records.length;i++){if(!records[i])continue;count++;if(/^[RC]|^.[RC]/.test(records[i]))i++;}
      project.changedFiles=count;
      const commit=await git(cwd,['log','-1','--format=%ct%n%s']).catch(()=> '');
      if(commit){const [seconds,...subject]=commit.split('\n');project.latestCommitAt=Number(seconds)*1000;project.latestCommit=subject.join(' ').slice(0,200);}
    }catch(e){project.status=e.killed||e.code==='ERR_CHILD_PROCESS_STDIO_MAXBUFFER'?'unavailable':'not_git';}
    projects.push(project);
  }
  return projects;
}
export function createScanner(configPath,log=()=>{}) {
  let running=false;
  return async(config,secret,policy)=>{
    if(running||!policy)return;running=true;
    try {
      const path=configPath+'.scan.json',previous=await readJSON(path,{at:0,requestId:null,configHash:null});
      const configHash=createHash('sha256').update(JSON.stringify((config.harnesses||[]).map(h=>[h.id,h.cwd,h.shareProjectContext]))).digest('hex');
      const due=policy.intervalMinutes>0&&Date.now()-previous.at>=policy.intervalMinutes*60000;
      const requested=policy.requestId&&policy.requestId!==previous.requestId;
      if(!due&&!requested&&configHash===previous.configHash)return;
      const projects=await scanProjects(config.harnesses||[]);
      await request(config.service,secret,'/v1/device/projects',{projects,requestId:policy.requestId});
      await atomicJSON(path,{at:Date.now(),requestId:policy.requestId,configHash});
      log(`Project context refreshed (${projects.length} shared folders).`);
    }finally{running=false;}
  };
}
