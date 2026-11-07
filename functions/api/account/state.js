import {
  accountConfig,originMatches,json,readJson,fail,supabase,supabaseData,requireUser,accountResponse
} from '../../_lib/account.js';
import {migrateData} from '../../../src/storage.js';
import {DEFAULT_SETTINGS} from '../../../src/data.js';

const caps={units:3000,revisions:15000,attempts:8000,sessions:3000,tasks:12000,
  activities:20000,quizAttempts:8000,studyPlan:5000,scheduledSessions:5000,weeklyGoals:3000};
function safeState(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))
    throw Object.assign(new Error('ملف بيانات الحساب غير صالح.'),{status:400});
  let clean;
  try{clean=migrateData(raw,DEFAULT_SETTINGS)}
  catch{throw Object.assign(new Error('صيغة الحفظ غير متوافقة مع الموقع.'),{status:400})}
  for(const [k,limit] of Object.entries(caps))
    if(!Array.isArray(clean[k])||clean[k].length>limit)
      throw Object.assign(new Error('عدد السجلات كبير جدًا.'),{status:413});
  if(!clean.settings||typeof clean.settings!=='object'||Array.isArray(clean.settings))
    throw Object.assign(new Error('الإعدادات غير صالحة.'),{status:400});
  if(JSON.stringify(clean).length>480000)
    throw Object.assign(new Error('تجاوزت البيانات الحد المسموح. صدّر نسخة وراجع حجمها.'),{status:413});
  return clean;
}
const identity=id=>typeof id==='string'&&/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id);

async function fetchOwnState(env,session){
  if(!identity(session.user.id))throw Object.assign(new Error('جلسة غير صالحة.'),{status:401});
  return supabase(env,'/rest/v1/user_state?user_id=eq.'+session.user.id+'&select=payload,revision&limit=1',{
    headers:{Authorization:'Bearer '+session.token}
  });
}
export async function onRequestGet({request,env}){
  if(!accountConfig(env).enabled)return json({error:'الحسابات غير جاهزة بعد.'},503);
  try{
    const session=await requireUser(request,env);
    if(!session.user)return accountResponse({error:'يلزم تسجيل الدخول.'},401,session.headers);
    const r=await fetchOwnState(env,session);
    if(!r.ok)return accountResponse({error:'تعذر قراءة بيانات حسابك. تحقق من تفعيل RLS وSQL.'},503,session.headers);
    const rows=await supabaseData(r);
    const item=Array.isArray(rows)?rows[0]:null;
    if(!item)return accountResponse({revision:0,payload:null},200,session.headers);
    return accountResponse({revision:item.revision,payload:item.payload},200,session.headers);
  }catch(err){return fail(err)}
}
export async function onRequestPut({request,env}){
  if(!originMatches(request))return json({error:'مصدر الطلب غير موثوق.'},403);
  if(!accountConfig(env).enabled)return json({error:'الحسابات غير جاهزة بعد.'},503);
  try{
    const session=await requireUser(request,env);
    if(!session.user)return accountResponse({error:'يلزم تسجيل الدخول.'},401,session.headers);
    const body=await readJson(request,525000);
    if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0)
      return accountResponse({error:'رقم المراجعة غير صالح.'},400,session.headers);
    const payload=safeState(body.payload),expected=body.expectedRevision;
    const userId=session.user.id,now=new Date().toISOString();
    const options={method:expected===0?'POST':'PATCH',
      headers:{Authorization:'Bearer '+session.token,Prefer:'return=representation'},
      body:expected===0
        ?{user_id:userId,payload,revision:1,updated_at:now}
        :{payload,revision:expected+1,updated_at:now}};
    const path=expected===0?'/rest/v1/user_state':
      '/rest/v1/user_state?user_id=eq.'+userId+'&revision=eq.'+expected;
    const result=await supabase(env,path,options);
    if(result.status===409||result.status===23505)
      return accountResponse({error:'تغيّر الحساب من جهاز آخر؛ لم يتم استبدال بياناتك.',code:'REVISION_CONFLICT'},409,session.headers);
    if(!result.ok)return accountResponse({error:'تعذر حفظ تقدمك في الحساب. لم يتم تأكيد المزامنة.'},503,session.headers);
    const rows=await supabaseData(result);
    if(!Array.isArray(rows)||rows.length!==1)
      return accountResponse({error:'تم تعديل الحساب من جهاز آخر. احتفظ بنسخة من التغييرات المحلية.',code:'REVISION_CONFLICT'},409,session.headers);
    return accountResponse({saved:true,revision:rows[0].revision},200,session.headers);
  }catch(error){return fail(error);}
}
