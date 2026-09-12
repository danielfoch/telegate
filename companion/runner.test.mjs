import test from 'node:test';
import assert from 'node:assert/strict';
import { invocation, runTask, available } from './runner.mjs';
import { validateService } from './client.mjs';
const task={id:'job-1',title:'Literal prompt',prompt:'$(touch SHOULD_NOT_EXIST); `echo secret`\nKeep this literal.'};
test('untrusted prompts go to stdin and never become shell code or command arguments',async()=>{
  const call=invocation(task,{kind:'codex',command:'codex',cwd:process.cwd()});
  assert.deepEqual(call.args,['exec','--json','--approve-for-me','-']);assert.ok(!call.args.includes('--sandbox'));
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
  assert.deepEqual(invocation({...task,resumeRunId:'session-123'},adapter).args,['exec','--approve-for-me','resume','--json','session-123','-']);
  assert.deepEqual(invocation({...task,resumeRunId:'session-123'},{...adapter,kind:'claude'}).args,['--print','--output-format','stream-json','--verbose','--resume','session-123']);
  assert.throws(()=>invocation({...task,resumeRunId:'--last'},adapter),/session ID/);
});
