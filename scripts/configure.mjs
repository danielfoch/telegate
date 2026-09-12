import { createInterface } from 'node:readline/promises';
import { writeFile, access } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function configuration({service,teamID='',bundleID='app.telegate.community.t'+randomBytes(6).toString('hex')}) {
  let url;try{url=new URL(service);}catch{throw new Error('Enter the HTTPS origin of your Telegate relay.');}
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||!['','/'].includes(url.pathname)||!/^([a-z0-9-]+\.)+[a-z0-9-]+$/i.test(url.hostname)||url.hostname.endsWith('.localhost'))throw new Error('Use an HTTPS hostname without credentials, a path, query or fragment. A phone cannot use this Mac’s localhost address.');
  if(teamID && !/^[A-Z0-9]{10}$/.test(teamID))throw new Error('An Apple team ID has 10 uppercase letters/numbers. Leave it blank to choose your team in Xcode.');
  if(!/^[A-Za-z][A-Za-z0-9-]*(\.[A-Za-z][A-Za-z0-9-]*)+$/.test(bundleID))throw new Error('Invalid bundle identifier.');
  // $() preserves the two URL slashes in Xcode's comment-aware config format.
  return `// Local Telegate setup. Do not commit. No API keys belong here.\nTELEGATE_SERVICE_URL = https:/$()/${url.host}\nTELEGATE_APP_ID = ${bundleID}\nTELEGATE_CONNECT_APP_ID = ${bundleID}.connect\n${teamID?`DEVELOPMENT_TEAM = ${teamID}\n`:''}`;
}
export async function writeConfiguration(path, options) {
  const content=configuration(options);
  await writeFile(path,content,{flag:'wx',mode:0o600});
}
async function main() {
  const path=resolve('Config.local.xcconfig');
  try{await access(path);throw new Error('Config.local.xcconfig already exists. Edit that file to preserve your app identity; this setup will not overwrite it.');}catch(e){if(e.code!=='ENOENT')throw e;}
  const rl=createInterface({input:process.stdin,output:process.stdout});
  try {
    console.log('Telegate Community — free to self-host. Your computer works; you get your day back.');
    console.log('First deploy your relay using docs/SELF-HOST.md. Never paste an OpenAI key here.');
    const service=(await rl.question('Your relay’s HTTPS address: ')).trim();
    const teamID=(await rl.question('Apple team ID, or press Return to choose your team in Xcode: ')).trim();
    await writeConfiguration(path,{service,teamID});
    console.log('Saved a private configuration with a unique app identifier.');
    console.log('Open Telegate.xcodeproj, choose TelegateDIY, choose your iPhone, select your Personal Team in Signing & Capabilities if needed, then Run.');
    console.log('DIY has no background push alerts. Results are in Tasks. Free Personal Team installs need rebuilding after seven days.');
  } finally {rl.close();}
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
