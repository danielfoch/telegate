import test from 'node:test';
import assert from 'node:assert/strict';
import { invocation, runTask, available } from './runner.mjs';
import { validateService } from './client.mjs';
const task={id:'job-1',title:'Literal prompt',prompt:'$(touch SHOULD_NOT_EXIST); `echo secret`\nKeep this literal.'};
test('untrusted prompts go to stdin and never become shell code or command arguments',async()=>{
  const call=invocation(task,{kind:'codex',command:'codex',cwd:process.cwd()});
  assert.deepEqual(call.args,['exec','--json','--approve-for-me','--skip-git-repo-check','-']);assert.ok(!call.args.includes('--sandbox'));
  const result=await runTask(task,{kind:'command',command:process.execPath,args:['-e','process.stdin.pipe(process.stdout)'],cwd:process.cwd()});
  assert.equal(result.status,'completed');assert.ok(result.result.includes(task.prompt));
});
test('nonzero exit, empty output, and timeout cannot masquerade as completion',async()=>{
  const adapter={kind:'command',command:process.execPath,cwd:process.cwd()};
  assert.equal((await runTask(task,{...adapter,args:['-e','process.exit(2)']})).status,'failed');
  assert.equal((await runTask(task,{...adapter,args:['-e','process.exit(0)']})).status,'needs_attention');
  assert.equal((await runTask(task,{...adapter,args:['-e','setInterval(()=>{},1000)']},{timeoutMs:80})).status,'needs_attention');
});
test('unavailable commands and work folders are advertised as unavailable',async()=>{
  const results=await available([{id:'one',name:'One',kind:'command',command:process.execPath,cwd:process.cwd()},{id:'two',name:'Two',kind:'codex',command:'/not-a-command',cwd:'/not-a-directory'}]);
  assert.equal(results[0].enabled,true);assert.equal(results[1].enabled,false);
});
test('remote service credentials only travel over HTTPS and redirects are not accepted',()=>{
  assert.equal(validateService('https://api.example.test/'),'https://api.example.test');
  assert.equal(validateService('http://127.0.0.1:8790'),'http://127.0.0.1:8790');
  assert.throws(()=>validateService('http://example.test'));assert.throws(()=>validateService('https://user:secret@example.test'));
});
test('follow-ups resume only an explicit saved session, never the last session or injected arguments',()=>{
  const adapter={kind:'codex',command:'codex',cwd:process.cwd()};
  assert.deepEqual(invocation({...task,resumeRunId:'session-123'},adapter).args,['exec','--approve-for-me','--skip-git-repo-check','resume','--json','session-123','-']);
  assert.deepEqual(invocation({...task,resumeRunId:'session-123'},{...adapter,kind:'claude'}).args,['--print','--output-format','stream-json','--verbose','--permission-mode','auto','--resume','session-123']);
  assert.throws(()=>invocation({...task,resumeRunId:'--last'},adapter),/session ID/);
});

test('approval policy is a local Connect setting; a brief cannot choose it and unknown values fall back to automatic review',()=>{
  const claude={kind:'claude',command:'claude',cwd:process.cwd()},codex={kind:'codex',command:'codex',cwd:process.cwd()};
  assert.deepEqual(invocation({...task,approvalMode:'bypass'},claude).args.slice(-2),['--permission-mode','auto']);
  assert.deepEqual(invocation(task,{...claude,approvalMode:'edits'}).args.slice(-2),['--permission-mode','acceptEdits']);
  assert.equal(invocation(task,{...claude,approvalMode:'bypass'}).args.includes('--permission-mode'),false);
  assert.equal(invocation(task,{...codex,approvalMode:'bypass'}).args.includes('--approve-for-me'),false);
  assert.deepEqual(invocation(task,{...codex,approvalMode:'not-a-mode'}).args,['exec','--json','--approve-for-me','--skip-git-repo-check','-']);
});
test('cloud brief includes scoped callbacks and explicit follow-up IDs without local command execution',async t=>{
  let sent;
  t.mock.method(globalThis,'fetch',async(url,init)=>{sent={url,...init,body:JSON.parse(init.body)};return Response.json({id:'saved-task',status:'accepted'});});
  const result=await runTask({...task,parentTaskId:'parent',resumeRunId:'saved-run',callback:{url:'https://relay.test/v1/hooks/tasks/job-1',token:'scoped-callback'}},{kind:'webhook',url:'https://relay.test/v1/adapters/grokbot/tasks',token:'submission-token'});
  assert.equal(result.status,'submitted');assert.equal(result.runId,'saved-task');
  assert.equal(sent.redirect,'error');assert.equal(sent.headers.Authorization,'Bearer submission-token');assert.equal(sent.headers['Idempotency-Key'],task.id);
  assert.deepEqual(sent.body,{id:task.id,title:task.title,prompt:task.prompt,parent_task_id:'parent',resume_run_id:'saved-run',callback_url:'https://relay.test/v1/hooks/tasks/job-1',callback_token:'scoped-callback'});
});

test('setup diagnostics explain missing executables and reject credential-bearing endpoints',async()=>{
  const results=await available([
    {id:'missing',name:'Missing',kind:'claude',command:'/not-installed',cwd:process.cwd()},
    {id:'url',name:'Cloud',kind:'webhook',url:'https://user:password@example.test/tasks'},
    {id:'off',name:'Off',kind:'command',enabled:false,command:process.execPath,cwd:process.cwd()},
  ]);
  assert.match(results[0].problem,/Executable or working folder/);
  assert.equal(results[1].enabled,false);
  assert.match(results[1].problem,/without embedded credentials/);
  assert.equal(results[2].enabled,false);
  assert.equal(results[2].problem,undefined);
});

test('Codex setup checks CLI compatibility and accepts explicitly chosen non-Git folders',async t=>{
  const {mkdtemp,writeFile,rm}=await import('node:fs/promises');
  const {tmpdir}=await import('node:os');
  const {join}=await import('node:path');
  const dir=await mkdtemp(join(tmpdir(),'telegate-cli-check-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const command=join(dir,'fake-codex');
  await writeFile(command,'#!/usr/bin/env node\nif(process.argv.slice(2).join(" ")!=="exec --help") process.exit(8); console.log("--json --approve-for-me --skip-git-repo-check");',{mode:0o700});
  const [h]=await available([{id:'codex',name:'Codex',kind:'codex',command,cwd:dir}]);
  assert.equal(h.enabled,true);
  assert.equal(h.problem,undefined);
  const old=join(dir,'old-codex');
  await writeFile(old,'#!/usr/bin/env node\nconsole.log("--json");',{mode:0o700});
  const [legacy]=await available([{id:'old',name:'Old',kind:'codex',command:old,cwd:dir}]);
  assert.match(legacy.problem,/missing required delegation options/);
});

test('local tasks do not inherit connector credentials or private configuration paths',async t=>{
  const before={token:process.env.TELEGATE_DEVICE_TOKEN,config:process.env.TELEGATE_CONFIG};
  process.env.TELEGATE_DEVICE_TOKEN='fixture-only-token';process.env.TELEGATE_CONFIG='/private/fixture/config.json';
  t.after(()=>{for(const [key,value] of [['TELEGATE_DEVICE_TOKEN',before.token],['TELEGATE_CONFIG',before.config]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
  const result=await runTask(task,{kind:'command',command:process.execPath,cwd:process.cwd(),args:['-e','console.log(JSON.stringify({token:!!process.env.TELEGATE_DEVICE_TOKEN,config:!!process.env.TELEGATE_CONFIG,path:!!process.env.PATH}))']});
  assert.equal(result.status,'completed');
  assert.deepEqual(JSON.parse(result.result),{token:false,config:false,path:true});
});
