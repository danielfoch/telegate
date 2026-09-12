import { connect } from 'node:http2';
import { createPrivateKey, sign, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
export function encryptToken(value,key) {
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  const data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64');
}
export function decryptToken(value,key) {
  const raw=Buffer.from(value,'base64'),decipher=createDecipheriv('aes-256-gcm',key,raw.subarray(0,12));
  decipher.setAuthTag(raw.subarray(12,28));return Buffer.concat([decipher.update(raw.subarray(28)),decipher.final()]).toString('utf8');
}
export function createAPNsSender({keyFile,keyId,teamId,bundleId}) {
  if(!keyFile||!keyId||!teamId||!bundleId)return null;
  const privateKey=createPrivateKey(readFileSync(keyFile));
  let cachedJWT='',issued=0;const connections=new Map();
  const jwt=()=>{
    const now=Math.floor(Date.now()/1000);if(cachedJWT&&now-issued<3000)return cachedJWT;
    const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
    const unsigned=b64({alg:'ES256',kid:keyId})+'.'+b64({iss:teamId,iat:now});
    cachedJWT=unsigned+'.'+sign('sha256',Buffer.from(unsigned),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');issued=now;return cachedJWT;
  };
  const sender=async({deviceToken,environment,payload,notificationId,collapseId})=>{
    const origin=environment==='sandbox'?'https://api.sandbox.push.apple.com':'https://api.push.apple.com';
    let session=connections.get(origin);
    if(!session||session.closed||session.destroyed){session=connect(origin);connections.set(origin,session);session.on('error',()=>{connections.delete(origin);});session.on('goaway',()=>{session.close();connections.delete(origin);});}
    return new Promise((resolve,reject)=>{
      const r=session.request({':method':'POST',':path':'/3/device/'+deviceToken,'authorization':'bearer '+jwt(),'apns-topic':bundleId,'apns-push-type':'alert','apns-priority':'10','apns-expiration':String(Math.floor(Date.now()/1000)+86400),'apns-id':notificationId,'apns-collapse-id':collapseId});
      let status=0,body='';r.setEncoding('utf8');r.on('response',headers=>{status=Number(headers[':status']);});
      r.on('data',d=>{body=(body+d).slice(0,8000);});r.on('error',reject);
      r.setTimeout(15000,()=>{r.close();reject(new Error('APNs request timed out.'));});
      r.on('end',()=>{let reason;try{reason=JSON.parse(body).reason;}catch{}resolve({status,reason});});
      r.end(JSON.stringify(payload));
    });
  };
  sender.close=()=>{for(const session of connections.values())session.destroy();connections.clear();};return sender;
}
