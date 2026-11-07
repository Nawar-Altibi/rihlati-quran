// Supabase edge adapter: no service-role key, no browser-readable session tokens.
// Config is intentionally fail-closed until the owner provisions Auth + SMTP + RLS.
const ACCESS='__Host-rihlati-access';
const REFRESH='__Host-rihlati-refresh';
const RESET='__Host-rihlati-recovery';
const ALLOWED_PATH=/^\/(?:auth\/v1|rest\/v1)\/[a-zA-Z0-9_/?=&.,:%-]+$/;

export function accountConfig(env={}){
  const url=String(env.SUPABASE_URL||'');
  const key=String(env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY||'');
  let valid=false;
  try{
    const p=new URL(url);
    valid=p.protocol==='https:'&&(/^[a-z0-9-]+\.supabase\.co$/.test(p.hostname))&&p.pathname==='/'&&p.username===''&&p.password==='';
  }catch{}
  const enabled=valid && key.length>18 && !key.startsWith('sb_secret_') && env.ACCOUNTS_ENABLED==='true' && String(env.AUTH_FLOW_SECRET||'').length>=32;
  const captchaConfigured=String(env.TURNSTILE_SITE_KEY||'').length>8 &&
    String(env.TURNSTILE_SECRET_KEY||'').length>8;
  return {
    enabled, registrationEnabled:enabled&&env.ACCOUNT_REGISTRATION_ENABLED==='true'&&captchaConfigured,
    captchaSiteKey:enabled?String(env.TURNSTILE_SITE_KEY||''):null
  };
}

export function originMatches(request){
  try{
    const origin=request.headers.get('Origin');
    const target=new URL(request.url);
    return Boolean(origin && origin===target.origin && target.protocol==='https:');
  }catch{return false;}
}

export function json(data,status=200,extra){
  const headers=new Headers(extra||{});
  headers.set('Content-Type','application/json; charset=utf-8');
  headers.set('Cache-Control','no-store');
  headers.set('X-Content-Type-Options','nosniff');
  headers.set('Referrer-Policy','no-referrer');
  return new Response(JSON.stringify(data),{status,headers});
}

export async function readJson(request,limit=4096){
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type')||''))
    throw Object.assign(new Error('مطلوب طلب JSON صالح.'),{status:415});
  const body=await request.text();
  if(body.length>limit)throw Object.assign(new Error('حجم الطلب كبير.'),{status:413});
  let data;
  try{data=JSON.parse(body)}catch{throw Object.assign(new Error('تنسيق JSON غير صالح.'),{status:400})}
  if(!data||typeof data!=='object'||Array.isArray(data))
    throw Object.assign(new Error('الطلب غير صالح.'),{status:400});
  return data;
}
export function fail(error,fallback='تعذر تنفيذ الطلب حاليًا.'){
  return json({error:typeof error?.message==='string'&&error?.status<500?error.message:fallback},error?.status>=400&&error.status<600?error.status:503);
}
export function parseCookies(request){
  const raw=request.headers.get('Cookie')||'';
  return Object.fromEntries(raw.split(';').map(x=>x.trim()).filter(x=>x.includes('='))
    .map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));
}
export function setSessionCookies(headers,session){
  if(!session?.access_token||!session?.refresh_token)throw new Error('Supabase did not return a session.');
  const age=Math.max(60,Math.min(3600,Math.floor(Number(session.expires_in)||3600)));
  headers.append('Set-Cookie',ACCESS+'='+encodeURIComponent(session.access_token)+'; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age='+age);
  headers.append('Set-Cookie',REFRESH+'='+encodeURIComponent(session.refresh_token)+'; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000');
}
export function clearSessionCookies(headers){
  for(const name of [ACCESS,REFRESH,RESET])
    headers.append('Set-Cookie',name+'=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
}

export async function supabase(env,path,options={}){
  if(!accountConfig(env).enabled)throw Object.assign(new Error('الحسابات غير مفعّلة بعد.'),{status:503});
  if(!ALLOWED_PATH.test(path)||path.includes('..')||path.includes('%2f'))
    throw Object.assign(new Error('مسار غير مسموح.'),{status:500});
  const headers=new Headers(options.headers||{});
  headers.set('apikey',env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY);
  if(options.body!=null)headers.set('Content-Type','application/json');
  return fetch(String(env.SUPABASE_URL).replace(/\/$/,'')+path,{
    method:options.method||'GET',headers,body:options.body==null?undefined:JSON.stringify(options.body),
    signal:AbortSignal.timeout(12000),redirect:'error',cache:'no-store'
  });
}
export async function supabaseData(response){
  try{return await response.json()}catch{return {}}
}
export async function requireUser(request,env){
  const c=parseCookies(request),h=new Headers();
  let token;
  try{token=decodeURIComponent(c[ACCESS]||'')}catch{token=''}
  if(token){
    try{
      const r=await supabase(env,'/auth/v1/user',{headers:{Authorization:'Bearer '+token}});
      if(r.ok){
        const user=await supabaseData(r);
        if(user?.id&&user?.email_confirmed_at)return {user,token,headers:h};
      }
    }catch{ /* access token may have expired: attempt refresh below */ }
  }
  let refresh;
  try{refresh=decodeURIComponent(c[REFRESH]||'')}catch{refresh=''}
  if(!refresh)return {user:null,token:null,headers:h};
  const res=await supabase(env,'/auth/v1/token?grant_type=refresh_token',{
    method:'POST',body:{refresh_token:refresh}
  });
  if(!res.ok){
    clearSessionCookies(h);
    return {user:null,token:null,headers:h};
  }
  const session=await supabaseData(res);
  if(!session?.user?.id||!session?.user?.email_confirmed_at){
    clearSessionCookies(h);return {user:null,token:null,headers:h};
  }
  setSessionCookies(h,session);
  return {user:session.user,token:session.access_token,headers:h};
}

const encode64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const decode64=encoded=>{
  const raw=atob(encoded.replace(/-/g,'+').replace(/_/g,'/'));
  return Uint8Array.from(raw,ch=>ch.charCodeAt(0));
};
async function flowKey(env){
  if(typeof env.AUTH_FLOW_SECRET!=='string'||env.AUTH_FLOW_SECRET.length<32)throw new Error('Recovery secret is not configured.');
  return crypto.subtle.importKey('raw',new TextEncoder().encode(env.AUTH_FLOW_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
export async function setRecoveryProof(headers,env,userId){
  const payload=[userId,String(Date.now()+15*60000),crypto.randomUUID()].join('|');
  const bytes=new TextEncoder().encode(payload);
  const signature=await crypto.subtle.sign('HMAC',await flowKey(env),bytes);
  headers.append('Set-Cookie',RESET+'='+encode64(bytes)+'.'+encode64(new Uint8Array(signature))+
    '; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=900');
}
export async function hasRecoveryProof(request,env,userId){
  const value=parseCookies(request)[RESET];
  if(!value||value.length>550||!value.includes('.'))return false;
  try{
    const [payload,signature]=value.split('.');
    if(!payload||!signature)return false;
    const bytes=decode64(payload);
    const [owner,expiry,nonce]=new TextDecoder().decode(bytes).split('|');
    if(owner!==userId||!nonce||nonce.length<20||!Number.isSafeInteger(Number(expiry))||Number(expiry)<Date.now())return false;
    return crypto.subtle.verify('HMAC',await flowKey(env),decode64(signature),bytes);
  }catch{return false;}
}
export function clearRecoveryProof(headers){
  headers.append('Set-Cookie',RESET+'=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');
}

export function publicUser(user){
  if(!user?.id)return null;
  return {id:user.id,email:user.email||'',displayName:String(user.user_metadata?.display_name||'').slice(0,60)};
}
export function accountResponse(data,status=200,sessionHeaders){
  return json(data,status,sessionHeaders);
}
