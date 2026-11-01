import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost,sanitizeMentorRequest,onRequestGet } from '../functions/api/mentor.js';

const secret='private-mentor-access-test-0000123456789';
const base='https://example.pages.dev/api/mentor';
const payload={question:'شو راجع اليوم؟',context:{date:'2026-11-01',stage:'تثبيت جزء عمّ',
  trackedSurahs:1,reviewsLast7:2,quizAttempts:1,
  due:[{name:'عبس',date:'2026-11-01',rating:'ضعيف'}],
  weakSurahs:[],weakAyahs:[{name:'عبس',ayah:5,count:1}],privateNote:'do not leak'}};
const request=(data=payload,token=secret,origin='https://example.pages.dev')=>new Request(base,{
  method:'POST',headers:{'Content-Type':'application/json','Origin':origin,'X-Mentor-Token':token},body:JSON.stringify(data)
});
function mockQuota(){
  let calls=0;
  return {prepare(sql){
    return {bind(...args){return {
      async run(){return {success:true};},
      async first(){if(!sql.includes('UPDATE'))return null;if(calls>=args[1])return null;return {calls:++calls};}
    };},async run(){return {success:true};}}
  },get calls(){return calls}};
}
test('context sanitizer strips unknown private metadata and limits lengths',()=>{
  const result=sanitizeMentorRequest({...payload,context:{...payload.context,rawPersonalDiary:'never send this',due:[{name:'عبس',date:'2026-11-01',rating:'ضعيف',private:'secret'}]}});
  assert.equal(result.context.rawPersonalDiary,undefined);
  assert.equal(result.context.due[0].private,undefined);
  assert.match(JSON.stringify(result),/عبس/);
  assert.equal(JSON.stringify(result).includes('never send this'),false);
  assert.throws(()=>sanitizeMentorRequest({...payload,question:'x'.repeat(330)}),/٣٢٠/);
});
test('AI endpoint is fail-closed before configuration',async()=>{
  const r=await onRequestPost({request:request(),env:{}});
  assert.equal(r.status,503);
  assert.match((await r.json()).error,/غير مفعّلة/);
});
test('same-origin only; rejects missing/incorrect secret before spending quota',async()=>{
  const usage=mockQuota();let invoked=0;
  const env={MENTOR_QUOTA_DB:usage,MENTOR_ACCESS_TOKEN:secret,AI:{run:async()=>{invoked++;return {response:'جواب'};}}};
  const foreign=await onRequestPost({request:request(payload,secret,'https://evil.example'),env});
  assert.equal(foreign.status,403);
  const invalid=await onRequestPost({request:request(payload,'invalid'),env});
  assert.equal(invalid.status,403);
  assert.equal(usage.calls,0);assert.equal(invoked,0);
});
test('valid authenticated question consumes only one quota token and returns a short grounded response',async()=>{
  const db=mockQuota(),calls=[];
  const env={MENTOR_QUOTA_DB:db,MENTOR_ACCESS_TOKEN:secret,AI:{run:async(model,input)=>{calls.push({model,input});return {response:'راجع سورة عبس ثم قيّم نفسك.'};}}};
  const r=await onRequestPost({request:request(),env});
  assert.equal(r.status,200);
  assert.equal((await r.json()).source,'workers-ai');
  assert.equal(calls.length,1);
  assert.equal(db.calls,1);
  assert.match(calls[0].model,/llama-3.2/);
  assert.equal(JSON.stringify(calls[0]).includes('privateNote'),false);
  assert.equal(r.headers.get('Cache-Control'),'no-store, max-age=0');
});
test('global 12-call daily limit prevents a 13th AI inference even with valid token',async()=>{
  const db=mockQuota();let modelCalls=0;
  const env={MENTOR_QUOTA_DB:db,MENTOR_ACCESS_TOKEN:secret,AI:{run:async()=>{modelCalls++;return {response:'مراجعتك اليوم مفيدة.'};}}};
  for(let i=0;i<12;i++)assert.equal((await onRequestPost({request:request(),env})).status,200);
  const exhausted=await onRequestPost({request:request(),env});
  assert.equal(exhausted.status,429);
  assert.equal(modelCalls,12);
  assert.equal(db.calls,12);
});
test('no quota DB = no AI inference; GET requests are not accepted',async()=>{
  const env={MENTOR_ACCESS_TOKEN:secret,AI:{run:async()=>{throw Error('must not run');}}};
  assert.equal((await onRequestPost({request:request(),env})).status,503);
  assert.equal(onRequestGet().status,405);
});
