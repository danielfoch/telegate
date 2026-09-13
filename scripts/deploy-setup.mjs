import { createInterface } from 'node:readline/promises';
import { writeFile, access } from 'node:fs/promises';
import { stdin, stdout } from 'node:process';
import { randomBytes } from 'node:crypto';
const rl=createInterface({input:stdin,output:stdout});
try {
  try{await access('.env');throw new Error('.env already exists. Edit the existing configuration instead.');}catch(e){if(e.code!=='ENOENT')throw e;}
  const domain=(await rl.question('Hostname you control for the Telegate relay: ')).trim().toLowerCase();
  if(!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(domain))throw new Error('Enter a DNS hostname without a path.');
  await writeFile('.env',`TELEGATE_DOMAIN=${domain}\nCALLBACK_SIGNING_KEY=${randomBytes(32).toString('base64url')}\nPUSH_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}\n`,{mode:0o600,flag:'wx'});
  console.log('Saved .env with relay secrets. Account creation does not require an invitation. Point this hostname to your server, then run docker compose up -d --build. Keep .env private.');
}finally{rl.close();}
