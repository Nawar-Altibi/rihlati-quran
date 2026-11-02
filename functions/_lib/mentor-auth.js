// Signed 30-day, HttpOnly, same-origin access session for the Quran mentor.
// No access secret stored in browser JavaScript or repository files.
const COOKIE='rihlati_mentor_session';
const THIRTY_DAYS=30*24*60*60;
const encoder=new TextEncoder();
const enc=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
const dec=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));

async function key(secret){
  return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
export async function tokenMatches(input,expected){
  if(typeof input!=='string'||typeof expected!=='string'||input.length<24||input.length>256||expected.length<24)return false;
  const [got,want]=await Promise.all([
    crypto.subtle.digest('SHA-256',encoder.encode(input)),
    crypto.subtle.digest('SHA-256',encoder.encode(expected))
  ]);
  const a=new Uint8Array(got),b=new Uint8Array(want);
  let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
  return diff===0;
}
export function sameOrigin(request){
  const origin=request.headers.get('Origin'),site=request.headers.get('Sec-Fetch-Site');
  return (!origin||origin===new URL(request.url).origin)&&(!site||site==='same-origin'||site==='none');
}
export async function createMentorCookie(secret,now=Date.now()){
  const nonce=enc(crypto.getRandomValues(new Uint8Array(12)));
  const payload='v1.'+Math.floor(now/1000+THIRTY_DAYS)+'.'+nonce;
  const signature=enc(await crypto.subtle.sign('HMAC',await key(secret),encoder.encode(payload)));
  return COOKIE+'='+payload+'.'+signature+'; Path=/api/mentor; Max-Age='+THIRTY_DAYS+'; HttpOnly; Secure; SameSite=Strict';
}
export function clearMentorCookie(){return COOKIE+'=; Path=/api/mentor; Max-Age=0; HttpOnly; Secure; SameSite=Strict';}
export async function hasMentorSession(request,secret,now=Date.now()){
  if(typeof secret!=='string'||secret.length<24)return false;
  const found=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));
  if(!found)return false;
  const value=found.slice(COOKIE.length+1),parts=value.split('.');
  if(parts.length!==4||parts[0]!=='v1')return false;
  const expiry=Number(parts[1]);
  if(!Number.isSafeInteger(expiry)||expiry<=Math.floor(now/1000)||expiry>Math.floor(now/1000)+THIRTY_DAYS+60)return false;
  const payload=parts.slice(0,3).join('.');
  try{
    return await crypto.subtle.verify('HMAC',await key(secret),dec(parts[3]),encoder.encode(payload));
  }catch{return false;}
}
