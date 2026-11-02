import test from 'node:test';
import assert from 'node:assert/strict';
import {MODEL_COMPARISON_EXAMPLE,comparisonMessages} from '../functions/_lib/mentor-comparison.js';
import {onRequestPost,onRequestGet} from '../functions/api/mentor/compare.js';
import {createMentorCookie} from '../functions/_lib/mentor-auth.js';

const secret='a-private-session-secret-for-Quran-benchmark';
function req(body={example:'fictional-30m'},origin='https://example.pages.dev',cookie=''){
  return new Request('https://example.pages.dev/api/mentor/compare',{
    method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
}
const mockDb=()=>({prepare(sql){return {bind(...args){return {async run(){return {};},async first(){return {calls:2};}}},async run(){return {};}}}});
test('fictional comparison does not contain any identifiable local progress, notes or activity IDs',()=>{
  const text=JSON.stringify(comparisonMessages);
  assert.equal(MODEL_COMPARISON_EXAMPLE.id,'fictional-30m');
  assert.match(text,/عبس/);
  assert.match(text,/افتراضي|اصطناعي/);
  for(const sensitive of ['localStorage','userId','notes','teacher','apiKey','privacy'])assert.equal(text.includes(sensitive),false);
});
test('comparison status is unavailable without an OpenRouter server secret',async()=>{
  const r=await onRequestGet({env:{}});
  assert.equal(r.status,200);
  assert.equal((await r.json()).available,false);
});
test('unconfigured comparison never contacts either model',async()=>{
  const cookie=(await createMentorCookie(secret)).split(';')[0];
  let called=0;
  const env={MENTOR_ACCESS_TOKEN:secret,MENTOR_QUOTA_DB:mockDb(),AI:{run:async()=>{called++;return {};}}};
  const r=await onRequestPost({request:req({example:'fictional-30m'},'https://example.pages.dev',cookie),env});
  assert.equal(r.status,503);
  assert.equal(called,0);
});
test('comparison rejects any user-supplied prompt or study data, even with a configured key',async()=>{
  const cookie=(await createMentorCookie(secret)).split(';')[0];
  const env={MENTOR_ACCESS_TOKEN:secret,OPENROUTER_API_KEY:'fake-secret-is-long-enough',MENTOR_QUOTA_DB:mockDb(),AI:{run:async()=>({})}};
  const r=await onRequestPost({request:req({example:'fictional-30m',notes:'secret personal data'},'https://example.pages.dev',cookie),env});
  assert.equal(r.status,400);
});
test('cross-origin requests and requests without a valid cookie are refused',async()=>{
  const env={MENTOR_ACCESS_TOKEN:secret,OPENROUTER_API_KEY:'test-key',MENTOR_QUOTA_DB:mockDb(),AI:{run:async()=>({})}};
  assert.equal((await onRequestPost({request:req(),env})).status,401);
  const cookie=(await createMentorCookie(secret)).split(';')[0];
  assert.equal((await onRequestPost({request:req({example:'fictional-30m'},'https://attacker.example',cookie),env})).status,403);
});
