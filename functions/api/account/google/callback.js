import {
  accountConfig,json,supabase,supabaseData,setSessionCookies,readOAuthFlow,clearOAuthFlow,googleProviderReady
} from '../../../_lib/account.js';

const redirectResponse=(request,status,headers=new Headers())=>{
  const target=new URL('/',request.url);
  target.searchParams.set('account-auth',status);
  headers.set('Location',target.href);
  headers.set('Cache-Control','no-store');
  headers.set('Referrer-Policy','no-referrer');
  headers.set('X-Content-Type-Options','nosniff');
  return new Response(null,{status:303,headers});
};

export async function onRequestGet({request,env}){
  const settings=accountConfig(env);
  const headers=new Headers();
  const clearFlow=()=>clearOAuthFlow(headers);
  if(!settings.googleSignInEnabled||!(await googleProviderReady(env))){
    clearFlow();return redirectResponse(request,'google-unavailable',headers);
  }

  const params=new URL(request.url).searchParams;
  const flow=await readOAuthFlow(request,env);
  const returnedState=params.get('state')||'';
  if(!flow||!returnedState||flow.state!==returnedState){
    clearFlow();return redirectResponse(request,'google-error',headers);
  }
  clearFlow();
  const providerError=params.get('error')||params.get('error_code')||'';
  if(providerError){
    return redirectResponse(request,providerError==='access_denied'?'google-cancelled':'google-error',headers);
  }
  const code=params.get('code')||'';
  if(code.length<1||code.length>2048||/[\u0000-\u0020]/.test(code))
    return redirectResponse(request,'google-error',headers);

  try{
    const result=await supabase(env,'/auth/v1/token?grant_type=pkce',{
      method:'POST',body:{auth_code:code,code_verifier:flow.verifier}
    });
    if(!result.ok)return redirectResponse(request,'google-error',headers);
    const session=await supabaseData(result);
    const user=session?.user;
    const googleIdentity=Array.isArray(user?.identities)&&user.identities.some(identity=>identity?.provider==='google');
    if(!session?.access_token||!session?.refresh_token||!user?.id||!user?.email_confirmed_at||!googleIdentity)
      return redirectResponse(request,'google-error',headers);
    setSessionCookies(headers,session);
    return redirectResponse(request,'google-success',headers);
  }catch{
    return redirectResponse(request,'google-error',headers);
  }
}

export async function onRequestPost(){
  return json({error:'الطريقة غير مدعومة.'},405);
}
