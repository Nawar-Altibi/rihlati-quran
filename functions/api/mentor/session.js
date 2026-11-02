import {createMentorCookie,clearMentorCookie,hasMentorSession,tokenMatches,sameOrigin} from '../../_lib/mentor-auth.js';

const json=(body,status=200,cookie)=>new Response(JSON.stringify(body),{
  status,headers:{
    'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
    ...(cookie?{'Set-Cookie':cookie}:{})
  }
});
export async function onRequestGet({request,env}){
  if(!sameOrigin(request))return json({authenticated:false},403);
  return json({authenticated:await hasMentorSession(request,env?.MENTOR_ACCESS_TOKEN)});
}
export async function onRequestPost({request,env}){
  if(!sameOrigin(request))return json({error:'الطلب غير مسموح.'},403);
  if(!env?.MENTOR_ACCESS_TOKEN)return json({error:'خدمة AI غير مهيّأة.'},503);
  const token=request.headers.get('X-Mentor-Token');
  if(!(await tokenMatches(token,env.MENTOR_ACCESS_TOKEN)))
    return json({error:'رمز التفعيل غير صحيح.'},403);
  const cookie=await createMentorCookie(env.MENTOR_ACCESS_TOKEN);
  return json({authenticated:true,expiresInDays:30},200,cookie);
}
export async function onRequestDelete({request}){
  if(!sameOrigin(request))return json({error:'الطلب غير مسموح.'},403);
  return json({authenticated:false},200,clearMentorCookie());
}
