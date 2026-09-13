#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { homedir, hostname, platform } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { inspectAgentCLI, agentKinds, agentNames } from './agent-cli.mjs';
import { available } from './runner.mjs';
import { atomicJSON, readJSON, request, startPairing, runConnector, validateService } from './client.mjs';

const args=process.argv.slice(2), command=args[0]||'setup';
const configPath=resolve(process.env.TELEGATE_CONFIG||join(homedir(),'.config','telegate','computer.json'));
if(command==='check') {
  if(Number(process.versions.node.split('.')[0])<24)throw new Error('Install Node.js 24 or newer.');
  const config=await readJSON(configPath,{harnesses:[]});
  console.log(JSON.stringify({harnesses:await available(config.harnesses||[])}));
} else if(command==='run') {
  const controller=new AbortController();for(const s of ['SIGINT','SIGTERM'])process.once(s,()=>controller.abort());
  await runConnector(configPath,{signal:controller.signal}).catch(e=>{console.error(e.message);process.exitCode=1;});
} else {
  const rl=createInterface({input:stdin,output:stdout});
  const ask=async(label,initial='')=>(await rl.question(label+(initial?` [${initial}]`:'')+': ')).trim()||initial;
  try {
    const config=await readJSON(configPath,{service:'',name:hostname(),harnesses:[]});
    config.service=validateService(await ask('Telegate service address',config.service||process.env.TELEGATE_SERVICE||'http://127.0.0.1:8790'));
    config.name=await ask('Computer name',config.name);
    do {
      const preset=await ask('Add harness: codex, claude, openclaw, hermes, grokbot, command, or webhook','codex');
      const kind=preset==='grokbot'?'webhook':preset;
      if(!['codex','claude','openclaw','hermes','command','webhook'].includes(kind))throw new Error('Unknown harness type.');
      const h={id:randomUUID(),name:await ask('Display name',kind==='claude'?'Claude Code':kind==='codex'?'Codex':preset==='grokbot'?'Grok Bot / Clydesdale':agentNames[kind]||'My harness'),kind,enabled:true};
      if(kind==='webhook') {h.url=await ask('Task-submission HTTPS endpoint',preset==='grokbot'?new URL('/v1/adapters/grokbot/tasks',config.service).href:'');if(new URL(h.url).protocol!=='https:')throw new Error('Use HTTPS.');h.token=await ask(preset==='grokbot'?'Relay GROKBOT_SUBMISSION_TOKEN (not the Grok webhook key)':'Optional endpoint bearer token (leave empty if none)');if(preset==='grokbot'&&h.token.length<32)throw new Error('Copy the relay submission token from Grok Bot setup.');}
      else {h.command=await ask('Executable',kind==='command'?'':kind);h.cwd=resolve(await ask('Working folder',process.cwd()));if(kind==='command'){h.args=JSON.parse(await ask('Arguments as a JSON array; prompts arrive on stdin','[]'));if(!Array.isArray(h.args)||!h.args.every(x=>typeof x==='string'))throw new Error('Arguments must be a JSON string array.');}}
      if(kind==='openclaw'){h.agentId=await ask('OpenClaw agent ID','main');console.log('OpenClaw uses that agent’s configured workspace. The folder above is only the CLI launch folder and optional project metadata.');}
      if(agentKinds.includes(kind)){const check=await inspectAgentCLI(h);if(!check.ready)console.log(check.problem);else if(kind==='hermes'&&!check.queryFile)console.log('Older Hermes detected: briefs are passed as literal process arguments. Update Hermes to use stdin instead.');}
      if(kind!=='webhook')h.shareProjectContext=(await ask('Share this folder’s project name, branch, change count, and latest commit subject with your voice app? y/n','n')).toLowerCase()==='y';
      config.harnesses.push(h);
    }while((await ask('Add another harness? y/n','n')).toLowerCase()==='y');
    await atomicJSON(configPath,config);
    if(!config.deviceToken){
      const pair=await startPairing(config.service,config.name,platform(),config.harnesses);
      console.log(`\nOpen Telegate on your phone → Computers → Add computer.\nPairing code: ${pair.code.slice(0,5)}-${pair.code.slice(5)}\nConfirm that the app shows “${config.name}”. This code expires in 10 minutes.\n`);
      while(Date.now()<pair.expiresAt){const status=await request(config.service,pair.secret,'/v1/pair/status');if(status.status==='paired'){config.deviceToken=pair.secret;config.deviceId=status.deviceId;await atomicJSON(configPath,config);console.log('Computer paired.');break;}await new Promise(r=>setTimeout(r,2500));}
      if(!config.deviceToken)throw new Error('Pairing expired. Run setup again.');
    }
    console.log('Ready. Run: npm run connect -- run');
  }finally{rl.close();}
}
