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
