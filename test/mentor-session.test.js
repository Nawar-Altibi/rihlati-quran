import test from 'node:test';
import assert from 'node:assert/strict';
import {createMentorCookie,hasMentorSession,sameOrigin,clearMentorCookie} from '../functions/_lib/mentor-auth.js';
import {onRequestGet,onRequestPost,onRequestDelete} from '../functions/api/mentor/session.js';
import {onRequestPost as runMentor} from '../functions/api/mentor.js';
const secret='correct-stable-cloudflare-secret-for-test-100018';
const url='https://rihlati-quran.pages.dev/api/mentor/session';
const request=(method='GET',headers={})=>new Request(url,{method,headers:{Origin:'https://rihlati-quran.pages.dev',...headers}});
test('valid activation sets HttpOnly Secure SameSite cookie for 30 days, no plaintext token leaks',async()=>{
  const r=await onRequestPost({request:request('POST',{'X-Mentor-Token':secret}),env:{MENTOR_ACCESS_TOKEN:secret}});
  assert.equal(r.status,200);
  const cookie=r.headers.get('Set-Cookie');
  assert.match(cookie,/HttpOnly/);
  assert.match(cookie,/Secure/);
  assert.match(cookie,/SameSite=Strict/);
  assert.match(cookie,/Max-Age=2592000/);
  assert.equal(cookie.includes(secret),false);
  const cookieValue=cookie.split(';')[0];
  assert.equal(await hasMentorSession(request('GET',{Cookie:cookieValue}),secret),true);
  assert.equal((await onRequestGet({request:request('GET',{Cookie:cookieValue}),env:{MENTOR_ACCESS_TOKEN:secret}}).json()).authenticated,true);
});
test('tampering, expiry, secret rotation and malicious origins invalidate cookies',async()=>{
  const cookie=(await createMentorCookie(secret,Date.now())).split(';')[0];
  const bad=cookie.slice(0,-2)+'aa';
  assert.equal(await hasMentorSession(request('GET',{Cookie:bad}),secret),false);
  assert.equal(await hasMentorSession(request('GET',{Cookie:cookie}),secret,Date.now()+31*24*60*60*1000),false);
  assert.equal(await hasMentorSession(request('GET',{Cookie:cookie}),secret+'-ROTATED'),false);
  const evil=request('POST',{'X-Mentor-Token':secret,Origin:'https://attacker.example'});
  assert.equal((await onRequestPost({request:evil,env:{MENTOR_ACCESS_TOKEN:secret}})).status,403);
  assert.equal(sameOrigin(evil),false);
});
test('incorrect token never creates session, explicit logout revokes browser cookie',async()=>{
  assert.equal((await onRequestPost({request:request('POST',{'X-Mentor-Token':'wrong'}),env:{MENTOR_ACCESS_TOKEN:secret}})).status,403);
  const response=await onRequestDelete({request:request('DELETE')});
  assert.equal(response.status,200);
  assert.match(response.headers.get('Set-Cookie'),/Max-Age=0/);
  assert.match(clearMentorCookie(),/HttpOnly/);
});
test('signed-cookie authentication reaches AI inference without resending raw activation secret',async()=>{
  let count=0;
  const d1={prepare(sql){return {bind(...args){return {async run(){return {};},async first(){return {calls:1};}}},async run(){return {}}}}};
  const env={MENTOR_ACCESS_TOKEN:secret,MENTOR_QUOTA_DB:d1,AI:{run:async()=>{count++;return {choices:[{message:{content:'خطة مرتبة لسورة عبس'}}]};}}};
  const cookie=(await createMentorCookie(secret)).split(';')[0];
  const req=new Request('https://rihlati-quran.pages.dev/api/mentor',{
    method:'POST',headers:{Origin:'https://rihlati-quran.pages.dev',Cookie:cookie,'Content-Type':'application/json'},
    body:JSON.stringify({question:'شو راجع اليوم؟',context:{date:'2026-11-02',stage:'تثبيت جزء عم'}})
  });
  const response=await runMentor({request:req,env});
  assert.equal(response.status,200);
  assert.equal((await response.json()).answer,'خطة مرتبة لسورة عبس');
  assert.equal(count,1);
});
