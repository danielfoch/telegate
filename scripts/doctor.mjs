import { spawnSync } from 'node:child_process';
const phone=process.argv.includes('--phone'), server=process.argv.includes('--server');
let failed=false;
const check=(label,command,args,required=true)=>{
  const r=spawnSync(command,args,{encoding:'utf8',timeout:12000});
  const ok=r.status===0;
  console.log(`${ok?'✓':required?'✗':'○'} ${label}${ok?'':required?' — required tool unavailable':' — optional for this check'}`);
  if(!ok&&required)failed=true;
};
const nodeOK=Number(process.versions.node.split('.')[0])>=24;
console.log(`${nodeOK?'✓':'✗'} Node ${process.versions.node} (24+ required)`);failed ||= !nodeOK;
check('Git','git',['--version']);
if(server){check('Docker daemon','docker',['info','--format','{{.ServerVersion}}']);check('Docker Compose','docker',['compose','version']);}
if(phone){
  if(process.platform!=='darwin'){console.log('✗ iPhone builds require a Mac with Xcode. You can host the relay on this computer.');failed=true;}
  else{check('Xcode iPhone SDK','xcrun',['--sdk','iphoneos','--show-sdk-path']);check('XcodeGen (needed only when regenerating the project)','xcodegen',['--version'],false);}
}
if(!phone&&!server)console.log('Use --phone for iPhone build requirements or --server for Docker hosting requirements.');
console.log('This checks local tools, not Apple signing, physical-phone readiness, DNS, HTTPS reachability, or paid model access.');
process.exitCode=failed?1:0;
