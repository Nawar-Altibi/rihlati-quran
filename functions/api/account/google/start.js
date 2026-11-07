import {
  accountConfig,originMatches,json,supabase,setOAuthFlow,clearOAuthFlow
} from '../../../_lib/account.js';

const encode64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const randomValue=()=>{
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  return encode64(bytes);
};
const redirectResponse=(url,status=303,headers=new Headers())=>{
  headers.set('Location',url);
  headers.set('Cache-Control','no-store');
  headers.set('Referrer-Policy','no-referrer');
  headers.set('X-Content-Type-Options','nosniff');
  return new Response(null,{status,headers});
};
const appRedirect=(request,status)=>new URL('/?account-auth='+status,request.url).href;

export async function onRequestPost({request,env}){
  if(!originMatches(request))return json({error:'طلب من مصدر غير موثوق.'},403);
  if(!accountConfig(env).googleSignInEnabled)
    return redirectResponse(appRedirect(request,'google-unavailable'));

  const state=randomValue(),verifier=randomValue();
  const challenge=encode64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
  const callback=new URL('/api/account/google/callback',request.url);
  callback.searchParams.set('state',state);
  const authorize=new URL('/auth/v1/authorize',env.SUPABASE_URL);
  authorize.searchParams.set('provider','google');
  authorize.searchParams.set('scopes','openid email profile');
  authorize.searchParams.set('redirect_to',callback.href);
  authorize.searchParams.set('code_challenge',challenge);
  authorize.searchParams.set('code_challenge_method','s256');

  const headers=new Headers();
  await setOAuthFlow(headers,env,{state,verifier});
  try{
    const result=await supabase(env,authorize.pathname+authorize.search,{
      headers:{Accept:'text/html'},redirect:'manual'
    });
    const location=result.headers.get('Location');
    let destination;
    try{destination=new URL(location);}catch{}
    if(result.status<300||result.status>=400||destination?.protocol!=='https:'||destination?.hostname!=='accounts.google.com'){
      clearOAuthFlow(headers);
      return redirectResponse(appRedirect(request,'google-error'),303,headers);
    }
    return redirectResponse(destination.href,303,headers);
  }catch{
    clearOAuthFlow(headers);
    return redirectResponse(appRedirect(request,'google-error'),303,headers);
  }
}
