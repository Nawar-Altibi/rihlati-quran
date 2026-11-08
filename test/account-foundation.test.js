import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {accountConfig,originMatches,setRecoveryProof,hasRecoveryProof,storeRecoveryProof,consumeRecoveryProof,readOAuthFlow,setOAuthFlow,supabase} from '../functions/_lib/account.js';
import {onRequestGet as accountGet,onRequestPost as accountPost} from '../functions/api/account.js';
import {onRequestPost as googleStart} from '../functions/api/account/google/start.js';
import {onRequestGet as googleCallback} from '../functions/api/account/google/callback.js';
import {onRequestGet as stateGet,onRequestPut as statePut} from '../functions/api/account/state.js';
import {passwordsMatch} from '../src/account-ui.js';
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

test('Supabase requests use Workers-compatible redirect handling and reject unexpected redirects',async()=>{
  await withFetch(async(url,options)=>{
    assert.equal(options.redirect,'manual');
    return new Response(null,{status:302,headers:{Location:'https://unexpected.example/'}});
  },async()=>{
    await assert.rejects(()=>supabase(env,'/auth/v1/token?grant_type=pkce',{method:'POST',body:{auth_code:'test'}}),/Unexpected Supabase redirect/);
    const response=await supabase(env,'/auth/v1/settings',{redirect:'manual'});
    assert.equal(response.status,302);
  });
});

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
  assert.match(sql,/create table if not exists public\.account_recovery_proofs/i);
  assert.match(sql,/for delete to authenticated/i);
  assert.doesNotMatch(sql,/grant .* to anon;/i);
});
test('account client is isolated from guest localStorage and prompts explicit import',()=>{
  const client=readFileSync(new URL('../src/account-ui.js',import.meta.url),'utf8');
  assert.match(client,/makeNewUserData/);
  const wizard=readFileSync(new URL('../src/onboarding.js',import.meta.url),'utf8');
  assert.match(wizard,/data-account-action="import-guest"/);
  assert.match(wizard,/أنقل سجلات هالجهاز/);
  assert.match(client,/expectedRevision:revision/);
  assert.match(client,/revision=result\.revision/);
  assert.doesNotMatch(client,/localStorage\.setItem/);
});

test('signup requires matching password confirmation before calling Auth',()=>{
  const client=readFileSync(new URL('../src/account-ui.js',import.meta.url),'utf8');
  assert.match(client,/htmlInput\('passwordConfirm'/);
  assert.match(client,/kind==='signup'&&!passwordsMatch\(payload\.password,String\(fd\.get\('passwordConfirm'\)\|\|''\)\)/);
  assert.match(client,/كلمتا المرور غير متطابقتين/);
  assert.equal(passwordsMatch('long-safe-password','long-safe-password'),true);
  assert.equal(passwordsMatch('long-safe-password','different-password'),false);
  assert.equal(passwordsMatch('',''),false);
});

test('first-time account setup hides guest data and cannot dismiss into guest storage',()=>{
  const client=readFileSync(new URL('../src/account-ui.js',import.meta.url),'utf8');
  assert.match(client,/setData\(makeNewUserData\(\)\);\s*preferences=null;lastSavedAt=null;\s*onboarding=createOnboardingDraft\(\);\s*mode='setup';open\('setup'\)/);
  assert.match(client,/\['setup','loading'\]\.includes\(modal\)&&user\)\{await handleAction\('logout'\);return;\}/);
  assert.match(client,/isAccount:\(\)=>Boolean\(user\)/);
});

test('authenticated account state is hidden while loading and offers retry on failure',()=>{
  const client=readFileSync(new URL('../src/account-ui.js',import.meta.url),'utf8');
  assert.match(client,/async function loadState\(\)\{\s*mode='loading';\s*setData\(makeNewUserData\(\)\);\s*open\('loading'\);\s*const state=await api\('\/state'\)/);
  assert.match(client,/data-account-action="retry-state"/);
  assert.match(client,/if\(action==='retry-state'\)/);
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
  assert.match(h.get('Set-Cookie'),/Max-Age=900/);
  const cookie=(h.get('Set-Cookie')||'').split(';')[0];
  const req=new Request(origin+'/api/account',{headers:{Cookie:cookie}});
  assert.equal(await hasRecoveryProof(req,env,id),true);
  assert.equal(await hasRecoveryProof(req,env,'22222222-2222-2222-2222-222222222222'),false);
  const forged=new Request(origin+'/api/account',{headers:{Cookie:'__Host-rihlati-recovery=1.1'}});
  assert.equal(await hasRecoveryProof(forged,env,id),false);
  assert.equal(accountConfig({...env,AUTH_FLOW_SECRET:'short'}).enabled,false);
});

test('recovery proof is stored for its owner and consumed atomically once',async()=>{
  const headers=new Headers(),proof=await setRecoveryProof(headers,env,id);
  const cookie=(headers.get('Set-Cookie')||'').split(';')[0];
  const req=new Request(origin+'/api/account',{headers:{Cookie:cookie+'; __Host-rihlati-access=mock-token'}});
  let stored=null,deleted=false;
  const stub=async(url,options)=>{
    if(String(url).includes('/rest/v1/account_recovery_proofs')&&options.method==='POST'){
      stored=JSON.parse(options.body);
      assert.equal(stored.user_id,id);
      assert.equal(stored.nonce_hash,proof.nonceHash);
      assert.equal(options.headers.get('Authorization'),'Bearer mock-recovery-token');
      return new Response(null,{status:201});
    }
    if(String(url).includes('/rest/v1/account_recovery_proofs')&&options.method==='DELETE'){
      if(deleted)return mockResponse([]);
      deleted=true;return mockResponse([{user_id:id,nonce_hash:proof.nonceHash}]);
    }
    throw Error('unexpected URL '+url);
  };
  await withFetch(stub,async()=>{
    assert.equal(await storeRecoveryProof(env,{user,access_token:'mock-recovery-token'},proof),true);
    assert.equal(await consumeRecoveryProof(req,env,id,'mock-token'),true);
    assert.equal(await consumeRecoveryProof(req,env,id,'mock-token'),false);
  });
  assert.ok(stored.expires_at);
});

test('password recovery endpoint rejects replay after the one-time proof is consumed',async()=>{
  const headers=new Headers();await setRecoveryProof(headers,env,id);
  const proofCookie=(headers.get('Set-Cookie')||'').split(';')[0];
  const cookie='__Host-rihlati-access=mock-token; '+proofCookie;
  let consumed=false,updates=0;
  const stub=async(url,options={})=>{
    if(String(url).endsWith('/auth/v1/user')&&options.method==='GET')return mockResponse(user);
    if(String(url).endsWith('/auth/v1/user')&&options.method==='PUT'){updates++;return mockResponse(user);}
    if(String(url).includes('/rest/v1/account_recovery_proofs')&&options.method==='DELETE'){
      if(consumed)return mockResponse([]);
      consumed=true;return mockResponse([{user_id:id}]);
    }
    throw Error('unexpected '+url);
  };
  const response=()=>request('','POST',{action:'set-password',password:'a-valid-new-password-123'},origin,cookie);
  await withFetch(stub,async()=>{
    const first=await accountPost({request:response(),env});
    assert.equal(first.status,200);
    const replay=await accountPost({request:response(),env});
    assert.equal(replay.status,403);
  });
  assert.equal(updates,1);
});

test('signup OTP resend uses Supabase Auth and Turnstile without claiming delivery',async()=>{
  let sent;
  const r=await withFetch(async(url,options)=>{
    assert.match(String(url),/\/auth\/v1\/resend$/);
    sent=JSON.parse(options.body);
    return mockResponse({});
  },async()=>accountPost({request:request('','POST',{action:'resend',email:'new@example.com',purpose:'email',
    captchaToken:'test-captcha-token-long-enough'}),env}));
  assert.equal(r.status,200);
  assert.equal(sent.type,'signup');
  assert.equal(sent.email,'new@example.com');
  assert.equal(sent.gotrue_meta_security.captcha_token,'test-captcha-token-long-enough');
  assert.match((await r.json()).message,/لا نستطيع تأكيد وصول الرسالة/);
});

test('password recovery resend stays generic and sends through Supabase Auth',async()=>{
  let sent;
  const r=await withFetch(async(url,options)=>{
    assert.match(String(url),/\/auth\/v1\/recover$/);
    sent=JSON.parse(options.body);
    return mockResponse({});
  },async()=>accountPost({request:request('','POST',{action:'resend',email:'person@example.com',purpose:'recovery',
    captchaToken:'test-captcha-token-long-enough'}),env}));
  assert.equal(r.status,200);
  assert.equal(sent.email,'person@example.com');
  assert.equal(sent.gotrue_meta_security.captcha_token,'test-captcha-token-long-enough');
  assert.match((await r.json()).message,/لا نستطيع تأكيد وصول الرسالة/);
});

test('password recovery remains available while public registration stays disabled',async()=>{
  let called=false;
  const closed={...env,ACCOUNT_REGISTRATION_ENABLED:'false'};
  const r=await withFetch(async(url)=>{
    called=true;assert.match(String(url),/\/auth\/v1\/recover$/);return mockResponse({});
  },async()=>accountPost({request:request('','POST',{action:'recover',email:'person@example.com',
    captchaToken:'test-captcha-token-long-enough'}),env:closed}));
  assert.equal(called,true);
  assert.equal(r.status,200);
  assert.match((await r.json()).message,/لا نستطيع تأكيد وصول الرسالة/);
});

test('resend requires CAPTCHA and hides signup rate limits to avoid address enumeration',async()=>{
  let called=false;
  const missingCaptcha=await withFetch(async()=>{called=true;return mockResponse({});},async()=>
    accountPost({request:request('','POST',{action:'resend',email:'person@example.com',purpose:'email'}),env}));
  assert.equal(missingCaptcha.status,400);
  assert.equal(called,false);
  const payload={action:'resend',email:'person@example.com',purpose:'email',captchaToken:'test-captcha-token-long-enough'};
  const upstreamResponses=[mockResponse({}),mockResponse({msg:'invalid'},400),
    mockResponse({msg:'rate limit'},429),mockResponse({msg:'smtp unavailable'},500)];
  const publicResponses=[];
  for(const upstream of upstreamResponses){
    publicResponses.push(await withFetch(async()=>upstream,async()=>
      accountPost({request:request('','POST',payload),env})));
  }
  publicResponses.push(await withFetch(async()=>{throw Error('network unavailable');},async()=>
    accountPost({request:request('','POST',payload),env})));
  const bodies=[];
  for(const response of publicResponses){assert.equal(response.status,200);bodies.push(await response.json());}
  for(const body of bodies.slice(1))assert.deepEqual(body,bodies[0]);
  assert.match(bodies[0].message,/لا نستطيع تأكيد وصول الرسالة/);
});

test('password recovery hides provider failures without claiming the message was delivered',async()=>{
  const payload={action:'recover',email:'person@example.com',captchaToken:'test-captcha-token-long-enough'};
  const responseFor=async(mock)=>withFetch(async()=>mock,async()=>
    accountPost({request:request('','POST',payload),env}));
  const deliveredRequest=await responseFor(mockResponse({}));
  const failedRequest=await responseFor(mockResponse({msg:'smtp unavailable'},500));
  const rateLimitedRequest=await responseFor(mockResponse({msg:'rate limit'},429));
  const networkFailure=await withFetch(async()=>{throw Error('network unavailable');},async()=>
    accountPost({request:request('','POST',payload),env}));
  assert.equal(deliveredRequest.status,200);
  assert.equal(failedRequest.status,deliveredRequest.status);
  assert.equal(rateLimitedRequest.status,deliveredRequest.status);
  assert.equal(networkFailure.status,deliveredRequest.status);
  const delivered=await deliveredRequest.json(),failed=await failedRequest.json(),limited=await rateLimitedRequest.json();
  assert.deepEqual(failed,delivered);
  assert.deepEqual(limited,delivered);
  assert.deepEqual(await networkFailure.json(),delivered);
  assert.doesNotMatch(delivered.message,/تم الإرسال|أرسلنا/);
  assert.match(delivered.message,/لا نستطيع تأكيد وصول الرسالة/);
});

test('wrong or expired OTP returns a friendly error without creating an authenticated session',async()=>{
  const r=await withFetch(async(url)=>{
    assert.match(String(url),/\/auth\/v1\/verify$/);
    return mockResponse({msg:'Token has expired or is invalid'},400);
  },async()=>accountPost({request:request('','POST',{action:'verify',email:'person@example.com',code:'123456',purpose:'email'}),env}));
  assert.equal(r.status,400);
  assert.match((await r.json()).error,/غير صحيح أو انتهت صلاحيته/);
  assert.equal(r.headers.has('Set-Cookie'),false);
});

test('a previously consumed OTP cannot create a second session',async()=>{
  let consumed=false;
  const stub=async(url)=>{
    assert.match(String(url),/\/auth\/v1\/verify$/);
    if(consumed)return mockResponse({msg:'Token has expired or is invalid'},400);
    consumed=true;return mockResponse({access_token:'first-token',refresh_token:'first-refresh',expires_in:3600,user});
  };
  await withFetch(stub,async()=>{
    const first=await accountPost({request:request('','POST',{action:'verify',email:user.email,code:'123456',purpose:'email'}),env});
    assert.equal(first.status,200);
    assert.equal(first.headers.has('Set-Cookie'),true);
    const replay=await accountPost({request:request('','POST',{action:'verify',email:user.email,code:'123456',purpose:'email'}),env});
    assert.equal(replay.status,400);
    assert.match((await replay.json()).error,/غير صحيح أو انتهت صلاحيته/);
    assert.equal(replay.headers.has('Set-Cookie'),false);
  });
});

test('failed signup email request is surfaced instead of being reported as sent',async()=>{
  const r=await withFetch(async()=>mockResponse({msg:'smtp unavailable'},500),async()=>
    accountPost({request:request('','POST',{action:'signup',email:'new@example.com',password:'strong-passphrase-123',
      displayName:'احمد',captchaToken:'test-captcha-token-long-enough'}),env}));
  assert.equal(r.status,503);
  const body=await r.json();
  assert.equal(body.verificationRequired,undefined);
  assert.match(body.error,/تعذر الاتصال بخدمة الحساب/);
});

test('OTP templates are Arabic RTL with token, expiry, privacy warning, and no external assets',()=>{
  const confirm=readFileSync(new URL('../supabase/templates/confirm-signup.html',import.meta.url),'utf8');
  const recovery=readFileSync(new URL('../supabase/templates/reset-password.html',import.meta.url),'utf8');
  for(const template of [confirm,recovery]){
    assert.match(template,/<html lang="ar" dir="rtl">/);
    assert.match(template,/\{\{ \.Token \}\}/);
    assert.match(template,/10 دقائق/);
    assert.doesNotMatch(template,/<script\b|<img\b|https?:\/\//i);
  }
  assert.match(confirm,/لا تشارك هذا الرمز/);
  assert.match(recovery,/إذا لم تطلب استعادة كلمة المرور/);
});

test('verification screen exposes OTP resend with a sixty-second cooldown',()=>{
  const client=readFileSync(new URL('../src/account-ui.js',import.meta.url),'utf8');
  assert.match(client,/data-account-action="resend"/);
  assert.match(client,/resendUntil=Date\.now\(\)\+60000/);
  assert.match(client,/post\('resend',\{email,purpose,captchaToken:verifiedCaptchaToken\}\)/);
});
test('brand-new visitors never load the original author\'s old memorization seed',()=>{
  const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  assert.match(app,/loadData\(localStorage,STORE,makeNewUserData,DEFAULT_SETTINGS\)/);
  assert.match(app,/const STORE='rihlati-quran-v1'/);
  assert.doesNotMatch(app,/localStorage\.clear\(\)/);
});

const googleEnv={...env,ACCOUNT_REGISTRATION_ENABLED:'false',GOOGLE_SIGNIN_ENABLED:'true'};
const googleUser={...user,user_metadata:{full_name:'Google Learner'},identities:[{provider:'google'}]};
function requestAt(path,method='GET',headers={}){
  return new Request(origin+path,{method,headers:{...(method==='POST'?{Origin:origin}:{}),...headers}});
}
function cookiePair(response){return response.headers.get('Set-Cookie')?.split(';',1)[0]||'';}
async function startOAuth(){
  return withFetch(async()=>{throw new Error('OAuth start must redirect the browser to Supabase');},
    ()=>googleStart({request:requestAt('/api/account/google/start','POST'),env:googleEnv}));
}

test('Google availability is independent of email registration and fails closed when both provider checks fail',async()=>{
  assert.equal(accountConfig(googleEnv).registrationEnabled,false);
  assert.equal(accountConfig(googleEnv).googleSignInEnabled,true);
  assert.equal(accountConfig({...googleEnv,GOOGLE_SIGNIN_ENABLED:'false'}).googleSignInEnabled,false);
  const response=await withFetch(async(url)=>String(url).endsWith('/auth/v1/settings')
    ?mockResponse({external:{google:false}})
    :mockResponse({},400),()=>accountGet({request:request(),env:googleEnv}));
  assert.equal((await response.json()).googleSignInEnabled,false);
});

test('Google availability falls back to the authorization endpoint when provider settings are stale',async()=>{
  const response=await withFetch(async(url)=>{
    if(String(url).endsWith('/auth/v1/settings'))return mockResponse({external:{google:false}});
    const authorize=new URL(String(url));
    assert.equal(authorize.searchParams.get('provider'),'google');
    assert.equal(new URL(authorize.searchParams.get('redirect_to')).pathname,'/api/account/google/callback');
    return new Response(null,{status:302,headers:{Location:'https://accounts.google.com/o/oauth2/v2/auth'}});
  },()=>accountGet({request:request(),env:googleEnv}));
  assert.equal((await response.json()).googleSignInEnabled,true);
});

test('Google OAuth initiation uses a fixed callback, signed HttpOnly PKCE cookie, state, and Google-only scopes',async()=>{
  const response=await startOAuth();
  assert.equal(response.status,303);
  const authorize=new URL(response.headers.get('Location'));
  assert.equal(authorize.origin,'https://project-abc.supabase.co');
  assert.equal(authorize.pathname,'/auth/v1/authorize');
  assert.equal(authorize.searchParams.get('provider'),'google');
  assert.equal(authorize.searchParams.get('scopes'),'openid email profile');
  assert.equal(authorize.searchParams.get('prompt'),'select_account');
  assert.equal(authorize.searchParams.get('code_challenge_method'),'s256');
  const cookie=response.headers.get('Set-Cookie');
  assert.match(cookie,/__Host-rihlati-oauth-flow=/);
  assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Lax/);assert.match(cookie,/Max-Age=600/);
  const value=cookiePair(response);
  const flow=await readOAuthFlow(new Request(origin,{headers:{Cookie:value}}),googleEnv);
  assert.ok(flow?.state);assert.equal(flow.verifier.length,43);
  const redirect=new URL(authorize.searchParams.get('redirect_to'));
  assert.equal(redirect.origin,origin);
  assert.equal(redirect.pathname,'/api/account/google/callback');
  assert.equal(redirect.searchParams.get('flow_id'),flow.state);
  assert.equal(redirect.searchParams.has('state'),false);
  const challenge=authorize.searchParams.get('code_challenge');
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(flow.verifier)));
  assert.equal(challenge,btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''));
});

test('Google OAuth flow cookie expires and cannot be forged by changing its signed payload',async()=>{
  const headers=new Headers(),realNow=Date.now;
  try{
    Date.now=()=>realNow()-20*60000;
    await setOAuthFlow(headers,googleEnv,{state:'A'.repeat(43),verifier:'B'.repeat(43)});
  }finally{Date.now=realNow;}
  const cookie=headers.get('Set-Cookie').split(';',1)[0];
  assert.equal(await readOAuthFlow(new Request(origin,{headers:{Cookie:cookie}}),googleEnv),null);
  const started=await startOAuth(),pair=cookiePair(started),[name,value]=pair.split('=');
  const pieces=value.split('.');pieces[0]=(pieces[0][0]==='A'?'B':'A')+pieces[0].slice(1);
  assert.equal(await readOAuthFlow(new Request(origin,{headers:{Cookie:name+'='+pieces.join('.')}}),googleEnv),null);
});

test('Google OAuth rejects bad origin, missing flow_id, and mismatched flow_id without exchanging a code',async()=>{
  const badOrigin=new Request(origin+'/api/account/google/start',{method:'POST',headers:{Origin:'https://attacker.example'}});
  assert.equal((await googleStart({request:badOrigin,env:googleEnv})).status,403);
  let tokenCalls=0;
  const missing=await withFetch(async()=>mockResponse({external:{google:true}}),()=>googleCallback({
    request:requestAt('/api/account/google/callback?code=auth-code&flow_id=missing'),env:googleEnv
  }));
  assert.match(missing.headers.get('Location'),/account-auth=google-flow-error/);
  const started=await startOAuth(),cookie=cookiePair(started);
  const mismatch=await withFetch(async(url)=>{
    if(String(url).endsWith('/auth/v1/settings'))return mockResponse({external:{google:true}});
    tokenCalls++;return mockResponse({},400);
  },()=>googleCallback({request:requestAt('/api/account/google/callback?code=auth-code&flow_id=wrong','GET',{Cookie:cookie}),env:googleEnv}));
  assert.match(mismatch.headers.get('Location'),/account-auth=google-flow-error/);
  assert.equal(tokenCalls,0);
  const tampered=await startOAuth(),pair=cookiePair(tampered),[name,value]=pair.split('=');
  const tamperedFlow=await readOAuthFlow(new Request(origin,{headers:{Cookie:pair}}),googleEnv);
  const altered=value.slice(0,-1)+(value.endsWith('A')?'B':'A');
  const wrongVerifier=await withFetch(async(url)=>{
    if(String(url).endsWith('/auth/v1/settings'))return mockResponse({external:{google:true}});
    tokenCalls++;return mockResponse({},400);
  },()=>googleCallback({request:requestAt('/api/account/google/callback?code=auth-code&flow_id='+
    tamperedFlow.state,'GET',{Cookie:name+'='+altered}),env:googleEnv}));
  assert.match(wrongVerifier.headers.get('Location'),/account-auth=google-flow-error/);
  assert.equal(tokenCalls,0);
});

test('Google OAuth callback exchanges PKCE server-side, sets protected app cookies, strips the code, and rejects replay',async()=>{
  const started=await startOAuth();
  const cookie=cookiePair(started);
  const flow=await readOAuthFlow(new Request(origin,{headers:{Cookie:cookie}}),googleEnv);
  let tokenCalls=0;
  const stub=async(url,options)=>{
    if(String(url).endsWith('/auth/v1/settings'))return mockResponse({external:{google:true}});
    assert.match(String(url),/\/auth\/v1\/token\?grant_type=pkce$/);
    const body=JSON.parse(options.body);
    assert.equal(body.auth_code,'single-use-code');assert.equal(body.code_verifier,flow.verifier);
    tokenCalls++;
    if(tokenCalls>1)return mockResponse({msg:'code already used'},400);
    return mockResponse({access_token:'supabase-access-token',refresh_token:'supabase-refresh-token',expires_in:3600,user:googleUser});
  };
  // Supabase/Google may append a separate provider state parameter. It must not override ours.
  const callbackRequest=()=>requestAt('/api/account/google/callback?code=single-use-code&flow_id='+flow.state+'&state=provider-reserved-value','GET',{Cookie:cookie});
  const first=await withFetch(stub,()=>googleCallback({request:callbackRequest(),env:googleEnv}));
  assert.equal(first.status,303);assert.match(first.headers.get('Location'),/account-auth=google-success/);
  assert.doesNotMatch(first.headers.get('Location'),/single-use-code|access_token|refresh_token/);
  const cookies=first.headers.getSetCookie?.()||[first.headers.get('Set-Cookie')||''];
  const sessionCookies=cookies.filter(value=>value.includes('__Host-rihlati-access=')||value.includes('__Host-rihlati-refresh='));
  assert.equal(sessionCookies.length,2);
  for(const value of sessionCookies){assert.match(value,/HttpOnly/);assert.match(value,/Secure/);assert.match(value,/SameSite=Lax/);}
  const replay=await withFetch(stub,()=>googleCallback({request:callbackRequest(),env:googleEnv}));
  assert.match(replay.headers.get('Location'),/account-auth=google-error/);
  assert.equal(tokenCalls,2);
  assert.doesNotMatch(replay.headers.get('Set-Cookie')||'',/__Host-rihlati-access=/);
});

test('Google cancellation clears its temporary flow cookie without creating a session',async()=>{
  const started=await startOAuth(),cookie=cookiePair(started);
  const flow=await readOAuthFlow(new Request(origin,{headers:{Cookie:cookie}}),googleEnv);
  const response=await withFetch(async(url)=>{
    assert(String(url).endsWith('/auth/v1/settings'));
    return mockResponse({external:{google:true}});
  },()=>googleCallback({request:requestAt('/api/account/google/callback?error=access_denied&flow_id='+flow.state,'GET',{Cookie:cookie}),env:googleEnv}));
  assert.match(response.headers.get('Location'),/account-auth=google-cancelled/);
  assert.match(response.headers.get('Set-Cookie'),/__Host-rihlati-oauth-flow=;.*Max-Age=0/);
  const providerError=await withFetch(async()=>mockResponse({external:{google:true}}),()=>googleCallback({
    request:requestAt('/api/account/google/callback?error=server_error&flow_id='+flow.state,'GET',{Cookie:cookie}),env:googleEnv
  }));
  assert.match(providerError.headers.get('Location'),/account-auth=google-error/);
});

test('Google sessions use the existing refresh and logout endpoints and protected cookie attributes',async()=>{
  const cookie='__Host-rihlati-access=expired; __Host-rihlati-refresh=refresh-value';
  let refreshes=0,logouts=0;
  const refresh=await withFetch(async(url,options)=>{
    if(String(url).endsWith('/auth/v1/user'))return mockResponse({},401);
    if(String(url).includes('/auth/v1/token?grant_type=refresh_token')){
      refreshes++;assert.deepEqual(JSON.parse(options.body),{refresh_token:'refresh-value'});
      return mockResponse({access_token:'new-access',refresh_token:'new-refresh',expires_in:3600,user:googleUser});
    }
    if(String(url).endsWith('/auth/v1/settings'))return mockResponse({external:{google:true}});
    throw new Error('Unexpected refresh request: '+url);
  },()=>accountGet({request:requestAt('/api/account','GET',{Cookie:cookie}),env:googleEnv}));
  assert.equal(refreshes,1);
  assert.equal((await refresh.json()).authenticated,true);
  assert.match(refresh.headers.get('Set-Cookie')||'',/__Host-rihlati-access=new-access/);
  const logout=await withFetch(async(url)=>{
    if(String(url).endsWith('/auth/v1/user'))return mockResponse(googleUser);
    if(String(url).endsWith('/auth/v1/logout')){logouts++;return new Response(null,{status:204});}
    throw new Error('Unexpected logout request: '+url);
  },()=>accountPost({request:request('','POST',{action:'logout'},origin,cookie),env:googleEnv}));
  assert.equal(logouts,1);assert.equal(logout.status,200);
  assert.match(logout.headers.get('Set-Cookie')||'',/__Host-rihlati-access=;.*Max-Age=0/);
  assert.match(logout.headers.get('Set-Cookie')||'',/__Host-rihlati-oauth-flow=;.*Max-Age=0/);
});

test('Google sign-in UI is mobile-safe, flag-gated, and retains explicit onboarding and logout flows',()=>{
  const client=readFileSync(new URL('../src/account-ui.js',import.meta.url),'utf8');
  const googleStart=readFileSync(new URL('../functions/api/account/google/start.js',import.meta.url),'utf8');
  const styles=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
  assert.match(client,/googleSignIn/);
  assert.match(client,/المتابعة باستخدام Google/);
  assert.doesNotMatch(client,/أو المتابعة بالبريد الإلكتروني/);
  const wizard=readFileSync(new URL('../src/onboarding.js',import.meta.url),'utf8');
  assert.match(wizard,/data-account-action="import-guest"/);
  const center=readFileSync(new URL('../src/account-center.js',import.meta.url),'utf8');
  assert.match(center,/button\('switch-account','الخروج والدخول بحساب آخر'/);
  assert.match(client,/if\(action==='logout'\|\|action==='export-and-logout'\|\|action==='switch-account'\)/);
  assert.match(client,/if\(switching\)\{busy=false;open\('login'\)/);
  assert.match(client,/google-cancelled/);
  assert.match(client,/google-flow-error/);
  assert.match(googleStart,/authorize\.searchParams\.set\('prompt','select_account'\)/);
  assert.match(styles,/\.account-dashboard-actions \.account-switch\{grid-column:1\/-1\}/);
  assert.match(styles,/\.account-google-button\{[\s\S]*?width:100%/);
  assert.match(styles,/@media\(max-width:600px\)[\s\S]*?\.account-google-button/);
});
