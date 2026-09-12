import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,stat,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configuration,writeConfiguration } from './configure.mjs';

test('DIY configuration preserves HTTPS and produces a unique valid app identity',()=>{
  const first=configuration({service:'https://relay.example.test:8443',teamID:'ABCDEFGHIJ'});
  assert.match(first,/https:\/\$\(\)\/relay.example.test:8443/);
  assert.match(first,/DEVELOPMENT_TEAM = ABCDEFGHIJ/);
  assert.match(first,/TELEGATE_APP_ID = app\.telegate\.community\.t[a-f0-9]{12}/);
  assert.notEqual(first,configuration({service:'https://relay.example.test:8443',teamID:'ABCDEFGHIJ'}));
});
test('DIY setup rejects unsafe service/config injection and preserves an existing configuration',async()=>{
  for(const service of ['http://relay.example.test','https://localhost','https://user:pass@relay.example.test','https://relay.example.test/path','https://relay.example.test?key=secret','https://relay.example.test#anything','https://$(inherited).test'])assert.throws(()=>configuration({service}));
  assert.throws(()=>configuration({service:'https://relay.example.test',teamID:'ABC\nSETTING=bad'}));
  const dir=await mkdtemp(join(tmpdir(),'telegate-config-'));const path=join(dir,'Config.local.xcconfig');
  try{
    await writeConfiguration(path,{service:'https://relay.example.test'});const original=await readFile(path,'utf8');
    await assert.rejects(writeConfiguration(path,{service:'https://other.example.test'}),{code:'EEXIST'});
    assert.equal(await readFile(path,'utf8'),original);
    if(process.platform!=='win32')assert.equal((await stat(path)).mode&0o777,0o600);
  }finally{await rm(dir,{recursive:true,force:true});}
});
