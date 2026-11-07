import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {accountConfig,originMatches,setRecoveryProof,hasRecoveryProof} from '../functions/_lib/account.js';
import {onRequestGet as accountGet,onRequestPost as accountPost} from '../functions/api/account.js';
import {onRequestGet as stateGet,onRequestPut as statePut} from '../functions/api/account/state.js';
import {makeInitialData,makeNewUserData} from '../src/data.js';

const env={
  SUPABASE_URL:'https://project-abc.supabase.co',
  SUPABASE_PUBLISHABLE_KEY:'sb_publishable_testtesttesttesttesttesttesttest',
  ACCOUNTS_ENABLED:'true',ACCOUNT_REGISTRATION_ENABLED:'true',
  TURNSTILE_SITE_KEY:'test-sitekey-abcdefghijkl',TURNSTILE_SECRET_KEY:'test-secret-abcdefghijkl',
  AUTH_FLOW_SECRET:'test-signing-key-should-have-more-than-32-characters-2026'
};
const id='11111111-2222-3333-4444-555555555555';
const user={id,email:'person@example.com',email_confirmed_at:'2026-11-07T06:00:00Z',user_metadata:{display_name:'الضيف'}};
const origin='https://rihlati-quran.pages.dev';
const request=(path='',method='GET',body,originHeader=origin,cookie='')=>new Request(origin+'/api/account'+path,{
  method,headers:{...(method!=='GET'?{'Content-Type':'application/json',Origin:originHeader}:{}),
    ...(cookie?{Cookie:cookie}:{})},
  ...(body!==undefined?{body:JSON.stringify(body)}:{})
});
const mockResponse=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const withFetch=async(stub,fn)=>{
  const original=globalThis.fetch;globalThis.fetch=stub;
  try{return await fn()}finally{globalThis.fetch=original;}
};

test('public mode is safely disabled until owner provisions the backend',async()=>{
  const config=accountConfig({});
  assert.equal(config.enabled,false);
  assert.equal(config.registrationEnabled,false);
  const r=await accountGet({request:request(),env:{}});
  assert.equal(r.status,200);
  const body=await r.json();
  assert.equal(body.authenticated,false);
  assert.equal(body.enabled,false);
});
test('signup requires correct origin, enabled bot protection and never emits an unconfirmed cookie',async()=>{
  assert.equal(originMatches(request('', 'POST',{action:'login'},'https://evil.example')),false);
  assert.equal((await accountPost({request:request('','POST',{action:'signup'},'https://evil.example'),env})).status,403);
  const r=await withFetch(async()=>mockResponse({user:{id,email:'new@example.com'},access_token:'unexpected'}),async()=>
    accountPost({request:request('','POST',{action:'signup',email:'new@example.com',password:'strong-passphrase-123',
      displayName:'احمد',captchaToken:'test-captcha-token-long-enough'}),env}));
  const result=await r.json();
  assert.equal(result.verificationRequired,true);
  assert.equal(r.headers.has('Set-Cookie'),false);
  assert.equal(accountConfig({...env,TURNSTILE_SECRET_KEY:''}).registrationEnabled,false);
});
test('user log in sets Secure HttpOnly SameSite cookies, not bearer tokens in response body',async()=>{
  const cookiePayload={access_token:'jwt-secret-not-for-js',refresh_token:'refresh-secret-not-for-js',
    expires_in:3600,user};
  const r=await withFetch(async(url)=>{assert.match(String(url),/grant_type=password/);return mockResponse(cookiePayload);},async()=>
    accountPost({request:request('','POST',{action:'login',email:user.email,password:'strong-passphrase',
      captchaToken:'test-captcha-token-long-enough'}),env}));
  assert.equal(r.status,200);
  const publicResult=await r.clone().json();
  assert.equal(publicResult.authenticated,true);
  const cookies=r.headers.get('Set-Cookie');
  assert.match(cookies,/HttpOnly/);
  assert.match(cookies,/Secure/);
  assert.match(cookies,/SameSite=Lax/);
  assert.doesNotMatch(JSON.stringify(publicResult),/jwt-secret/);
});
test('new accounts get NO personal Quran historical data or seed completions',()=>{
  const original=makeInitialData(),fresh=makeNewUserData({stage:'tabarak',dailyMinutes:25});
  assert.equal(original.units.length,2);
  assert.ok(original.sessions.length>0);
  for(const key of ['units','revisions','attempts','sessions','tasks','activities','quizAttempts','studyPlan'])
    assert.deepEqual(fresh[key],[],key);
  assert.equal(fresh.settings.simpleStage,'tabarak');
  assert.equal(fresh.settings.dailyMinutes,25);
  assert.equal(fresh.onboardingDone,true);
});
test('private state refuses all anonymous access and POST write without Origin',async()=>{
  const unauth=await stateGet({request:request('/state'),env});
  assert.equal(unauth.status,401);
  const denied=await statePut({request:request('/state','PUT',{expectedRevision:0,payload:makeNewUserData()},'https://evil.example'),env});
  assert.equal(denied.status,403);
});
test('RLS-backed POST receives the user ID solely from verified Supabase session, never request body',async()=>{
  let stored=null;
  const stub=async(url,opts)=>{
    if(String(url).endsWith('/auth/v1/user'))return mockResponse(user);
    if(String(url).endsWith('/rest/v1/user_state')){
      stored=JSON.parse(opts.body);
      assert.equal(stored.user_id,id);
      assert.equal(opts.headers.get('Authorization'),'Bearer mock-token');
      return mockResponse([{revision:1}]);
    }
    throw Error('unexpected '+url);
  };
  const payload=makeNewUserData();
  const r=await withFetch(stub,async()=>statePut({request:request('/state','PUT',
    {expectedRevision:0,payload,user_id:'ffffffff-ffff-ffff-ffff-ffffffffffff'},origin,'__Host-rihlati-access=mock-token'),env}));
  assert.equal(r.status,200);
  assert.equal((await r.json()).revision,1);
  assert.equal(stored.user_id,id);
});
test('concurrent state update is rejected, with no overwrite or automatic revision reset',async()=>{
  const stub=async(url)=>{
    if(String(url).endsWith('/auth/v1/user'))return mockResponse(user);
    if(String(url).includes('/rest/v1/user_state?'))return mockResponse([]);
    throw Error('unexpected '+url);
  };
  const r=await withFetch(stub,async()=>statePut({request:request('/state','PUT',
    {expectedRevision:4,payload:makeNewUserData()},origin,'__Host-rihlati-access=mock-token'),env}));
  assert.equal(r.status,409);
  assert.equal((await r.json()).code,'REVISION_CONFLICT');
});
test('server verifies owner through Supabase for each account read',async()=>{
  const stub=async(url)=>{
    if(String(url).endsWith('/auth/v1/user'))return mockResponse(user);
    if(String(url).includes('/rest/v1/user_state?')){
      assert.match(String(url),new RegExp('user_id=eq\\.'+id));
      return mockResponse([{revision:8,payload:makeNewUserData()}]);
    }
    throw Error('unexpected URL '+url);
  };
  const r=await withFetch(stub,async()=>stateGet({request:request('/state','GET',undefined,origin,
    '__Host-rihlati-access=mock-token'),env}));
  assert.equal(r.status,200);
  const body=await r.json();
  assert.equal(body.revision,8);
  assert.equal(body.payload.units.length,0);
});
test('Postgres table grants no anonymous reads and RLS protects every mutation',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/001_user_state.sql',import.meta.url),'utf8');
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/revoke all on table public\.user_state from public, anon, authenticated/i);
  assert.match(sql,/grant select, insert, update on table public\.user_state to authenticated/i);
  assert.match(sql,/for select to authenticated/i);
  assert.match(sql,/for insert to authenticated/i);
  assert.match(sql,/for update to authenticated/i);
  assert.match(sql,/with check \(user_id = \(select auth\.uid\(\)\)\)/);
  assert.doesNotMatch(sql,/grant .* to anon;/i);
});
test('account client is isolated from guest localStorage and prompts explicit import',()=>{
  const client=readFileSync(new URL('../src/account-ui.js',import.meta.url),'utf8');
  assert.match(client,/makeNewUserData/);
  assert.match(client,/data-account-action="import-guest"/);
  assert.match(client,/أنقل سجلات هالجهاز/);
  assert.match(client,/expectedRevision:revision/);
  assert.match(client,/revision=result\.revision/);
  assert.doesNotMatch(client,/localStorage\.setItem/);
});

test('normal signed-in browser cannot set a new password without a verified recovery OTP',async()=>{
  const stub=async(url)=>{
    if(String(url).endsWith('/auth/v1/user'))return mockResponse(user);
    throw Error('password update reached Supabase without OTP: '+url);
  };
  const r=await withFetch(stub,async()=>accountPost({request:request('','POST',
    {action:'set-password',password:'a-valid-new-password-123'},origin,
    '__Host-rihlati-access=mock-token'),env}));
  assert.equal(r.status,403);
  assert.match((await r.json()).error,/رمز الاستعادة/);
});

test('recovery proof is HMAC signed, expires and cannot be reused for another user',async()=>{
  const h=new Headers();await setRecoveryProof(h,env,id);
  const cookie=(h.get('Set-Cookie')||'').split(';')[0];
  const req=new Request(origin+'/api/account',{headers:{Cookie:cookie}});
  assert.equal(await hasRecoveryProof(req,env,id),true);
  assert.equal(await hasRecoveryProof(req,env,'22222222-2222-2222-2222-222222222222'),false);
  const forged=new Request(origin+'/api/account',{headers:{Cookie:'__Host-rihlati-recovery=1.1'}});
  assert.equal(await hasRecoveryProof(forged,env,id),false);
  assert.equal(accountConfig({...env,AUTH_FLOW_SECRET:'short'}).enabled,false);
});
test('brand-new visitors never load the original author\'s old memorization seed',()=>{
  const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  assert.match(app,/loadData\(localStorage,STORE,makeNewUserData,DEFAULT_SETTINGS\)/);
  assert.match(app,/const STORE='rihlati-quran-v1'/);
  assert.doesNotMatch(app,/localStorage\.clear\(\)/);
});
