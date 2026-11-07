import {
  accountConfig,originMatches,json,readJson,fail,setSessionCookies,clearSessionCookies,
  supabase,supabaseData,requireUser,publicUser,accountResponse,
  hasRecoveryProof,setRecoveryProof,clearRecoveryProof
} from '../_lib/account.js';

const emailValid=s=>typeof s==='string'&&s.length<=254&&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
const emailOf=s=>String(s||'').trim().toLowerCase();
const passwordValid=s=>typeof s==='string'&&s.length>=12&&s.length<=128;
const codeValid=s=>typeof s==='string'&&/^\d{6,8}$/.test(s.trim());

function errorMessage(res,action){
  if(res.status===429)return 'تم الوصول لحد المحاولات مؤقتًا. جرّب بعد قليل.';
  if(action==='login')return 'البريد أو كلمة المرور غير صحيحة، أو البريد لم يُؤكّد بعد.';
  if(action==='verify')return 'رمز التحقق غير صحيح أو انتهت صلاحيته.';
  if(action==='set-password')return 'تعذر تحديث كلمة المرور. تأكد من طولها وحاول ثانية.';
  return 'تعذرت العملية. راجع المدخلات وحاول مجددًا.';
}
function requiredCaptcha(payload,settings){
  if(!settings.captchaSiteKey)return null;
  const token=payload.captchaToken;
  if(typeof token!=='string'||token.length<20||token.length>4096)
    throw Object.assign(new Error('أكمل التحقق الأمني أولًا.'),{status:400});
  return {gotrue_meta_security:{captcha_token:token}};
}

export async function onRequestGet({request,env}){
  const settings=accountConfig(env);
  if(!settings.enabled)return json({enabled:false,registrationEnabled:false,authenticated:false});
  try{
    const session=await requireUser(request,env);
    return accountResponse({
      enabled:true,registrationEnabled:settings.registrationEnabled,
      captchaSiteKey:settings.captchaSiteKey,authenticated:!!session.user,
      user:publicUser(session.user)
    },200,session.headers);
  }catch{return json({enabled:true,authenticated:false,error:'تعذر الاتصال بالحساب حاليًا.'},503);}
}

export async function onRequestPost({request,env}){
  if(!originMatches(request))return json({error:'طلب من مصدر غير موثوق.'},403);
  const settings=accountConfig(env);
  try{
    const body=await readJson(request,8200);
    const action=body.action;
    if(action==='logout'){
      const h=new Headers();
      if(settings.enabled){
        try{
          const session=await requireUser(request,env);
          if(session.token)await supabase(env,'/auth/v1/logout',{method:'POST',headers:{Authorization:'Bearer '+session.token}});
        }catch{ /* destroy local cookie even on provider outage */ }
      }
      clearSessionCookies(h);
      return json({authenticated:false,loggedOut:true},200,h);
    }
    if(!settings.enabled)return json({error:'ميزة الحسابات غير مفعّلة بعد.'},503);
    if(!['signup','login','verify','recover','set-password'].includes(action))
      return json({error:'العملية غير معروفة.'},400);
    if(action==='set-password'){
      if(!passwordValid(body.password))return json({error:'كلمة المرور لازم تكون 12 حرفًا على الأقل.'},400);
      const session=await requireUser(request,env);
      if(!session.user)return json({error:'انتهت جلسة إعادة التعيين. اطلب رمزًا جديدًا.'},401,session.headers);
      if(!(await hasRecoveryProof(request,env,session.user.id)))
        return json({error:'لتغيير كلمة المرور لازم تأكيد رمز الاستعادة من البريد أولًا.'},403,session.headers);
      const result=await supabase(env,'/auth/v1/user',{
        method:'PUT',headers:{Authorization:'Bearer '+session.token},body:{password:body.password}
      });
      if(!result.ok)return json({error:errorMessage(result,action)},result.status===429?429:400,session.headers);
      clearRecoveryProof(session.headers);
      return json({ok:true,authenticated:true,user:publicUser(session.user)},200,session.headers);
    }

    const email=emailOf(body.email);
    if(!emailValid(email))return json({error:'اكتب بريدًا إلكترونيًا صالحًا.'},400);
    if(action==='signup'){
      if(!settings.registrationEnabled)return json({error:'تسجيل حسابات جديدة غير متاح حاليًا.'},403);
      if(!passwordValid(body.password))return json({error:'كلمة المرور لازم تكون 12 حرفًا على الأقل.'},400);
      const name=String(body.displayName||'').trim();
      if(name.length<2||name.length>50)return json({error:'اكتب اسمًا بين حرفين و50 حرفًا.'},400);
      const captcha=requiredCaptcha(body,settings);
      const result=await supabase(env,'/auth/v1/signup',{
        method:'POST',body:{email,password:body.password,data:{display_name:name},...captcha}
      });
      if(!result.ok)return json({error:errorMessage(result,action)},result.status===429?429:400);
      // Email verification must be ON in Supabase project; never adopt a
      // signup session immediately if owner misconfigures confirmation.
      return json({ok:true,verificationRequired:true,
        message:'أرسلنا رسالة تحقق إلى بريدك (إذا لم يكن الحساب مسجّلًا مسبقًا).'});
    }
    if(action==='recover'){
      if(!settings.registrationEnabled)return json({error:'إعادة تعيين كلمة المرور غير مفعّلة بعد.'},403);
      const captcha=requiredCaptcha(body,settings);
      const result=await supabase(env,'/auth/v1/recover',{
        method:'POST',body:{email,...captcha}
      });
      if(result.status===429)return json({error:errorMessage(result,action)},429);
      // Avoid email enumeration whether the account exists or not.
      return json({ok:true,message:'إذا كان البريد مسجّلًا، رح يصلك رمز إعادة التعيين.'});
    }
    if(action==='verify'){
      if(!codeValid(body.code))return json({error:'اكتب رمز التحقق الموجود بالبريد.'},400);
      const type=body.purpose==='recovery'?'recovery':'email';
      const result=await supabase(env,'/auth/v1/verify',{
        method:'POST',body:{email,token:body.code.trim(),type}
      });
      if(!result.ok)return json({error:errorMessage(result,action)},result.status===429?429:400);
      const verified=await supabaseData(result);
      if(!verified?.access_token||!verified?.refresh_token||!verified?.user?.id)
        return json({error:'لم تكتمل عملية التحقق. حاول تسجيل الدخول.'},400);
      const h=new Headers();setSessionCookies(h,verified);
      if(type==='recovery')await setRecoveryProof(h,env,verified.user.id);
      return json({authenticated:true,user:publicUser(verified.user),purpose:type},200,h);
    }
    if(action==='login'){
      if(typeof body.password!=='string'||!body.password)return json({error:'اكتب كلمة المرور.'},400);
      const captcha=requiredCaptcha(body,settings);
      const result=await supabase(env,'/auth/v1/token?grant_type=password',{
        method:'POST',body:{email,password:body.password,...captcha}
      });
      if(!result.ok)return json({error:errorMessage(result,action)},result.status===429?429:401);
      const session=await supabaseData(result);
      if(!session?.user?.id||!session?.user?.email_confirmed_at)
        return json({error:'أكد بريدك الإلكتروني قبل تسجيل الدخول.'},403);
      const h=new Headers();setSessionCookies(h,session);
      return json({authenticated:true,user:publicUser(session.user)},200,h);
    }
  }catch(error){return fail(error);}
  return json({error:'الطلب غير صالح.'},400);
}
