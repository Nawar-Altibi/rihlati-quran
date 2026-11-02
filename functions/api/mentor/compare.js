import {hasMentorSession,sameOrigin} from '../../_lib/mentor-auth.js';
import {consumeQuota} from '../mentor.js';
import {MODEL_COMPARISON_EXAMPLE,comparisonMessages} from '../../_lib/mentor-comparison.js';

const MODEL='nvidia/nemotron-3-ultra-550b-a55b:free';
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
  'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'
}});
export async function onRequestGet({env}){
  return reply({
    available:typeof env?.OPENROUTER_API_KEY==='string'&&env.OPENROUTER_API_KEY.length>15,
    model:MODEL,scope:'fixed-fictional-comparison-only',
    privacy:'لا تُرسل بيانات المستخدم أو ملاحظاته إلى NVIDIA المجاني.'
  });
}
export async function onRequestPost({request,env}){
  if(!sameOrigin(request))return reply({error:'غير مسموح لهذا المصدر.'},403);
  if(!env?.MENTOR_ACCESS_TOKEN||!(await hasMentorSession(request,env.MENTOR_ACCESS_TOKEN)))
    return reply({error:'فعّل جلسة المساعد أولًا.'},401);
  if(!env?.OPENROUTER_API_KEY)return reply({error:'مفتاح OpenRouter غير مفعّل بعد في Cloudflare. جرب GPT-OSS الحالي.'},503);
  if(!env?.AI?.run||!env?.MENTOR_QUOTA_DB?.prepare)return reply({error:'إعداد مقارنة النماذج غير مكتمل.'},503);
  const type=request.headers.get('Content-Type')||'';
  if(!type.includes('application/json'))return reply({error:'مطلوب JSON.'},415);
  try{
    const input=await request.text();
    if(input.length>128)return reply({error:'الطلب غير صالح.'},400);
    if(JSON.parse(input)?.example!==MODEL_COMPARISON_EXAMPLE.id)return reply({error:'المقارنة تعمل على مثال وهمي ثابت فقط.'},400);
  }catch{return reply({error:'الطلب غير صالح.'},400);}
  // Two calls consume 2 of the same global D1 daily allowance, atomically.
  try{if(!(await consumeQuota(env.MENTOR_QUOTA_DB,2)))return reply({error:'انتهت حصة AI اليومية للمقارنة.'},429);}
  catch{return reply({error:'قاعدة الحد اليومي غير متاحة.'},503);}
  const outcomes=await Promise.allSettled([
    fetch('https://openrouter.ai/api/v1/chat/completions',{
      method:'POST',headers:{
        'Authorization':'Bearer '+env.OPENROUTER_API_KEY,
        'Content-Type':'application/json','HTTP-Referer':'https://rihlati-quran.pages.dev',
        'X-Title':'Rihlati Quran - Fictional Benchmark'
      },body:JSON.stringify({model:MODEL,messages:comparisonMessages,
        max_tokens:1200,temperature:0.2,stream:false})
    }).then(async r=>{
      if(!r.ok)throw Error('OpenRouter HTTP '+r.status);
      const data=await r.json();
      const answer=data?.choices?.[0]?.message?.content;
      if(typeof answer!=='string'||!answer.trim())throw Error('Nemotron did not return a complete answer.');
      return answer.trim().slice(0,4800);
    }),
    env.AI.run('@cf/openai/gpt-oss-120b',{messages:comparisonMessages,max_tokens:1700,temperature:0.2})
      .then(data=>{
        const answer=data?.choices?.[0]?.message?.content||data?.response;
        if(typeof answer!=='string'||!answer.trim())throw Error('GPT-OSS did not return a complete answer.');
        return answer.trim().slice(0,4800);
      })
  ]);
  return reply({
    example:MODEL_COMPARISON_EXAMPLE,
    nemotron:outcomes[0].status==='fulfilled'?{ok:true,answer:outcomes[0].value}:{ok:false,error:'تعذرت الإجابة من Nemotron المجاني.'},
    gptoss:outcomes[1].status==='fulfilled'?{ok:true,answer:outcomes[1].value}:{ok:false,error:'تعذرت الإجابة من GPT-OSS.'},
    privacy:'المقارنة استخدمت بيانات وهمية ثابتة؛ لم ترسل أي معلومات من سجل الموقع إلى OpenRouter أو NVIDIA.'
  });
}
