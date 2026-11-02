import {buildMentorSnapshot,generateMentorPlan,answerMentorLocally,mentorModelPayload,MENTOR_SUGGESTIONS} from './mentor-core.js';
import {buildDetailedMentorContext,mentorChatHistory} from './mentor-context.js';
import {escapeMentorHTML,formatMentorAnswer} from './mentor-format.js';

const label=escapeMentorHTML;
const modeText=mode=>mode==='ai'?'GPT-OSS 120B':mode==='fallback'?'المساعد المحلي · انتقال تلقائي':'المساعد المحلي';
const CHAT_SESSION_KEY='rihlati-mentor-chat-session-v1';
const PREF_KEY='rihlati-mentor-preferences-v2';
const LEGACY_TOKEN='rihlati-mentor-private-access';
const defaults={cloudOptIn:true,shareStudy:true,shareNotes:true};
function readPrefs(){
  try{
    const loaded=JSON.parse(localStorage.getItem(PREF_KEY)||'null');
    if(!loaded||typeof loaded!=='object')return {...defaults};
    return Object.fromEntries(Object.keys(defaults).map(k=>[k,typeof loaded[k]==='boolean'?loaded[k]:defaults[k]]));
  }catch{return {...defaults};}
}

export function createMentorUI({getData,render,navigate,openSurah,openReview,startQuiz,toast}){
  let messages=[],busy=false,previewData=false,settingsOpen=false,comparisonBusy=false,comparison=null;
  let {cloudOptIn,shareStudy,shareNotes}=readPrefs();
  let authorized=false,authChecked=false,authCheck=null,authError='',authBusy=false;
  try{
    const saved=JSON.parse(sessionStorage.getItem(CHAT_SESSION_KEY)||'[]');
    if(Array.isArray(saved))messages=saved.filter(x=>['user','assistant'].includes(x?.role)&&typeof x?.text==='string').slice(-16);
  }catch{}
  const snapshot=()=>buildMentorSnapshot(getData());
  function savePrefs(){
    try{localStorage.setItem(PREF_KEY,JSON.stringify({cloudOptIn,shareStudy,shareNotes}));}catch{}
  }
  function savedLegacyKey(){
    try{return sessionStorage.getItem(LEGACY_TOKEN)||'';}catch{return '';}
  }
  function clearLegacyKey(){try{sessionStorage.removeItem(LEGACY_TOKEN);}catch{}}
  function refreshUI(){if(typeof document!=='undefined'&&document.querySelector('#mentor-question-form'))render();}
  function append(role,text,mode='local'){
    messages.push({role,text:String(text).slice(0,3500),mode});
    messages=messages.slice(-16);
    try{sessionStorage.setItem(CHAT_SESSION_KEY,JSON.stringify(messages));}catch{}
  }
  function view(){
    const s=snapshot(),plan=generateMentorPlan(s);
    const cards=plan.length?plan.map((t,i)=>
      '<article class="mentor-task"><span class="mentor-step">'+(i+1)+'</span><div><strong>'+label(t.title)+'</strong><small>'+label(t.reason)+' · '+t.minutes+' دقيقة</small></div>'+
      (t.surah?'<button class="secondary small-btn" data-action="mentor-open-surah" data-surah="'+t.surah+'">افتح السورة</button>':'')+'</article>'
    ).join(''):'<p class="simple-muted">ما في مراجعات مستحقة مؤكدة. سجّل مراجعاتك لتحصل على اقتراحات أدق.</p>';
    const conversation=messages.length?messages.slice(-16).map(x=>
      '<article class="mentor-message mentor-message-'+(x.role==='user'?'user':'assistant')+'"><div class="mentor-message-meta">'+
      (x.role==='user'?'سؤالك':'✦ مساعد رحلتي · '+modeText(x.mode))+'</div>'+
      (x.role==='user'?'<p>'+label(x.text)+'</p>':'<div class="mentor-response-content">'+formatMentorAnswer(x.text)+'</div>')+'</article>'
    ).join(''):'<p class="simple-muted">اسألني عن مراجعات اليوم، مواضع أخطائك، التسميع، أو تقدمك. المساعد يقرأ سجلك ولا يغيّره.</p>';
    const status=cloudOptIn?'<span class="mentor-state mentor-state-on">✦ GPT-OSS 120B افتراضي</span><span class="mentor-state">↩ تحويل تلقائي للمحلي</span>':'<span class="mentor-state">المساعد المحلي فقط</span>';
    const auth=authorized?'<div class="mentor-auth-active"><span>✓ رمز التفعيل محفوظ بأمان في المتصفح لمدة تصل إلى 30 يومًا.</span><button class="secondary small-btn" type="button" data-action="mentor-logout">إلغاء التفعيل</button></div>':
      '<div class="mentor-secret"><label for="mentor-passcode">رمز التفعيل — أدخله مرة واحدة لحفظ الجلسة بأمان</label><div class="mentor-auth-row"><input id="mentor-passcode" class="input" type="password" autocomplete="off" placeholder="رمز الوصول الخاص من Cloudflare"><button class="secondary" type="button" data-action="mentor-activate"'+(authBusy?' disabled':'')+'>'+(authBusy?'جارٍ التفعيل…':'حفظ التفعيل')+'</button></div><small>لن نخزن الرمز في localStorage. الجلسة تُحفظ بملف Cookie محميّ.</small>'+(authError?'<small class="mentor-auth-error" role="alert">'+label(authError)+'</small>':'')+'</div>';
    const comparisonCard='<div class="mentor-comparison"><h3>مقارنة النماذج بمثال وهمي</h3>'+
      '<p>قارن GPT-OSS 120B مع Nemotron المجاني على مثال افتراضي فيه مراجعة عبس 1–5 فقط. <strong>ما رح نبعت سجلاتك أو ملاحظاتك إلى Nemotron.</strong> مزوّد Nemotron المجاني يطلب عدم إرسال بيانات شخصية.</p>'+
      '<button type="button" class="secondary small-btn" data-action="mentor-compare"'+(comparisonBusy?' disabled':'')+'>'+(comparisonBusy?'جارٍ مقارنة النموذجين...':'قارن النموذجين بمثال آمن')+'</button>'+
      (comparison?'<div class="mentor-compare-grid">'+
        '<section><b>Nemotron Ultra المجاني</b>'+(comparison.nemotron?.ok?'<div class="mentor-response-content">'+formatMentorAnswer(comparison.nemotron.answer)+'</div>':'<p>'+label(comparison.nemotron?.error||comparison.error||'غير مفعّل بعد — يحتاج مفتاح OpenRouter خاصًا.')+'</p>')+'</section>'+
        '<section><b>GPT-OSS 120B</b>'+(comparison.gptoss?.ok?'<div class="mentor-response-content">'+formatMentorAnswer(comparison.gptoss.answer)+'</div>':'<p>'+label(comparison.gptoss?.error||comparison.error||'تعذرت المقارنة.')+'</p>')+'</section>'+
        '</div>':'')+'</div>';
    const settings='<section class="mentor-settings"><div class="mentor-settings-heading"><div><h3>إعدادات المساعد الذكي</h3><p>تُحفظ اختياراتك لهذا المتصفح، ويمكن تعديلها أو تعطيلها.</p></div><button class="secondary small-btn" type="button" data-action="mentor-settings-toggle">'+(settingsOpen?'إخفاء الإعدادات':'تعديل الإعدادات')+'</button></div>'+
      '<div class="mentor-status-list">'+status+'<span class="mentor-state">تحليل السجل: '+(shareStudy?'مفعّل':'متوقف')+'</span><span class="mentor-state">ملاحظات الدراسة: '+(shareNotes&&shareStudy?'مفعّلة':'متوقفة')+'</span></div>'+
      (settingsOpen?'<div class="mentor-consent-options"><label><input type="checkbox" id="mentor-use-cloud"'+(cloudOptIn?' checked':'')+'> استخدام GPT-OSS 120B افتراضيًا (عند انتهاء الحصة ينتقل للمحلي)</label>'+
      '<label><input type="checkbox" id="mentor-share-study"'+(shareStudy?' checked':'')+'> تحليل سجل رحلتي التفصيلي في الأسئلة السحابية</label>'+
      '<label><input type="checkbox" id="mentor-share-notes"'+(shareNotes?' checked':'')+(shareStudy?'':' disabled')+'> إرسال ملاحظات الدراسة المكتوبة مع السجل</label>'+
      '<button type="button" class="secondary small-btn" data-action="mentor-preview-data">'+(previewData?'إخفاء معاينة البيانات':'اعرض البيانات التي ستُرسل')+'</button>'+
      (previewData?'<pre class="mentor-data-preview" dir="ltr">'+label(JSON.stringify(shareStudy?buildDetailedMentorContext(getData(),{includeNotes:shareNotes}):mentorModelPayload(s,'سؤال تجريبي').context,null,2))+'</pre>':'')+
      '<p class="mentor-privacy-info">في كل سؤال سحابي، يرسل الموقع سؤالك وسياق الحوار وبيانات الرحلة التي سمحت بها إلى Cloudflare. إذا ما بدك مشاركة، عطّل الخيارات؛ المساعد المحلي يضل متاحًا.</p></div>':'')+
      (cloudOptIn?auth:'')+'</section>';
    return '<header class="simple-page-heading mentor-heading"><div><div class="simple-kicker">مساعدك في الرحلة</div><h1>مساعد رحلتي</h1><p>خطة مبنية على تسجيلاتك، بدون اختلاق إتقان أو تعديل بياناتك.</p></div></header>'+
      '<div class="mentor-grid"><section class="simple-panel mentor-plan"><div class="mentor-plan-title"><h2>ورد اليوم المقترح</h2><span>يتحدّث تلقائيًا مع سجلّك</span></div>'+
      '<div class="mentor-facts"><span>المرحلة: '+label(s.stage.title)+'</span><span>'+s.due.length+' مراجعات مستحقة</span><span>'+s.weakAyahs.length+' مواضع أخطاء معروفة</span></div>'+
      '<div class="mentor-tasks">'+cards+'</div><div class="simple-actions">'+
      '<button class="secondary small-btn" data-action="mentor-review">＋ سجّل مراجعة</button>'+
      '<button class="secondary small-btn" data-action="mentor-quiz">⚡ اختبر حفظك</button></div></section>'+
      '<section class="simple-panel mentor-chat"><div class="mentor-plan-title"><h2>اسأل المساعد</h2><span>GPT-OSS 120B مع انتقال تلقائي للمحلي</span></div>'+
      '<div class="mentor-suggestions">'+MENTOR_SUGGESTIONS.map((q,i)=>'<button class="secondary small-btn" type="button" data-action="mentor-suggest" data-index="'+i+'">'+label(q)+'</button>').join('')+'</div>'+
      '<div id="mentor-messages" class="mentor-conversation" aria-live="polite">'+conversation+'</div>'+
      (messages.length?'<button type="button" class="secondary small-btn mentor-clear" data-action="mentor-clear-chat">حذف محادثة هذه الجلسة</button>':'')+
      '<form id="mentor-question-form" class="mentor-composer"><label class="mushaf-visually-hidden" for="mentor-question">سؤالك للمساعد</label><input id="mentor-question" name="question" class="input" type="text" maxlength="320" autocomplete="off" placeholder="مثلاً: شو لازم راجع بكرا؟" required'+(busy?' disabled':'')+'><button class="primary" type="submit"'+(busy?' disabled':'')+'>'+(busy?'جارٍ التفكير…':'اسأل')+'</button></form>'+
      '<p class="mentor-chat-hint">المساعد لا يسجّل أي إنجاز تلقائيًا. الأسئلة السحابية تستخدم سجلّك وملاحظاتك حسب إعداداتك المحفوظة.</p></section></div>'+
      settings+comparisonCard+'<p class="mentor-disclaimer">المساعد للتنظيم والتحليل، ولا يصحّح التجويد أو يثبت الإتقان. البيانات تبقى تحت تحكّمك.</p>';
  }
  async function checkAuth(){
    if(authChecked)return authorized;
    if(authCheck)return authCheck;
    authCheck=fetch('/api/mentor/session',{credentials:'same-origin',cache:'no-store'}).then(async r=>{
      const result=await r.json().catch(()=>({}));
      authorized=Boolean(r.ok&&result.authenticated);
      authChecked=true;authError='';return authorized;
    }).catch(()=>{authChecked=true;authorized=false;return false;})
      .finally(()=>{authCheck=null;refreshUI();});
    return authCheck;
  }
  function afterRender(){if(!authChecked&&!authCheck)void checkAuth();}
  async function activate(key){
    const secret=String(key||'').trim();
    if(secret.length<24){authError='اكتب رمز التفعيل الصحيح لمرة واحدة.';refreshUI();return false;}
    authBusy=true;authError='';refreshUI();
    try{
      const response=await fetch('/api/mentor/session',{
        method:'POST',headers:{'X-Mentor-Token':secret},credentials:'same-origin',cache:'no-store'
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||'تعذّر تفعيل المساعد.');
      authorized=true;authChecked=true;clearLegacyKey();
      authError='';toast('تم حفظ التفعيل بأمان. ما رح تحتاج تدخل الرمز مع كل سؤال.');
      return true;
    }catch(error){authorized=false;authError=error.message||'تعذّر التفعيل.';return false;}
    finally{authBusy=false;refreshUI();}
  }
  async function logout(){
    try{await fetch('/api/mentor/session',{method:'DELETE',credentials:'same-origin',cache:'no-store'});}catch{}
    authorized=false;authChecked=true;clearLegacyKey();settingsOpen=true;refreshUI();
  }
  function scrollChat(){const el=typeof document!=='undefined'?document.querySelector('#mentor-messages'):null;if(el)el.scrollTop=el.scrollHeight;}
  async function send(question){
    const q=String(question||'').trim();
    if(!q||busy)return;
    if(q.length>320){toast('السؤال طويل؛ اكتبه بشكل أقصر.');return;}
    const snap=snapshot(),local=answerMentorLocally(snap,q),history=mentorChatHistory(messages);
    append('user',q);
    if(!cloudOptIn){append('assistant',local,'local');render();scrollChat();return;}
    busy=true;render();scrollChat();
    try{
      if(!authChecked)await checkAuth();
      if(!authorized){
        const input=typeof document!=='undefined'?document.querySelector('#mentor-passcode')?.value:'';
        const legacy=savedLegacyKey();
        if(input||legacy)await activate(input||legacy);
      }
      if(!authorized)throw Object.assign(new Error('فعّل رمز الوصول مرة واحدة من إعدادات المساعد.'),{status:401});
      const payload={...mentorModelPayload(snap,q),conversation:history};
      if(shareStudy)payload.study=buildDetailedMentorContext(getData(),{includeNotes:shareNotes});
      const response=await fetch('/api/mentor',{
        method:'POST',headers:{'Content-Type':'application/json'},
        credentials:'same-origin',cache:'no-store',body:JSON.stringify(payload)
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok){
        const err=new Error(result.error||'خدمة AI غير متاحة حاليًا.');err.status=response.status;throw err;
      }
      if(typeof result.answer!=='string'||!result.answer.trim())throw new Error('ما وصل جواب مكتمل من النموذج.');
      append('assistant',result.answer,'ai');
    }catch(err){
      if(err.status===401){authorized=false;authChecked=true;settingsOpen=true;authError='الجلسة غير مفعلة أو انتهت صلاحيتها.';}
      const reason=err.status===422?'اقترح النموذج مراجعة غير موثّقة؛ اعتمدت الخطة الآمنة من سجلك.':
        err.status===429?'اكتملت حصة الذكاء الاصطناعي لليوم.':
        err.status===401?'رمز التفعيل مطلوب لمرة واحدة.':'تعذّر الاتصال بالمساعد السحابي.';
      append('assistant','**'+reason+'**\n\nانتقلت تلقائيًا للمساعد المحلي.\n\n'+local,'fallback');
    }finally{
      busy=false;refreshUI();scrollChat();
    }
  }
  async function compareModels(){
    if(comparisonBusy)return;
    comparisonBusy=true;comparison=null;refreshUI();
    try{
      const response=await fetch('/api/mentor/compare',{method:'POST',credentials:'same-origin',cache:'no-store',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({example:'fictional-30m'})});
      const data=await response.json().catch(()=>({}));
      comparison=response.ok?data:{error:data.error||'المقارنة غير متاحة',nemotron:{ok:false}};
    }catch{comparison={error:'تعذر الاتصال بخدمة المقارنة'};}
    finally{comparisonBusy=false;refreshUI();}
  }
  function handleAction(action,target){
    switch(action){
      case 'mentor-open-surah':if(Number(target.dataset.surah))openSurah(Number(target.dataset.surah));return true;
      case 'mentor-review':openReview();return true;
      case 'mentor-quiz':startQuiz('random');return true;
      case 'mentor-compare':void compareModels();return true;
      case 'mentor-settings-toggle':settingsOpen=!settingsOpen;render();return true;
      case 'mentor-preview-data':previewData=!previewData;render();return true;
      case 'mentor-clear-chat':messages=[];try{sessionStorage.removeItem(CHAT_SESSION_KEY);}catch{}render();return true;
      case 'mentor-activate':void activate(document.querySelector('#mentor-passcode')?.value||'');return true;
      case 'mentor-logout':void logout();return true;
      case 'mentor-suggest':{const q=MENTOR_SUGGESTIONS[Number(target.dataset.index)];if(q)void send(q);return true;}
    }
    return false;
  }
  function handleChange(event){
    if(event.target.id==='mentor-use-cloud')cloudOptIn=event.target.checked;
    else if(event.target.id==='mentor-share-study'){shareStudy=event.target.checked;if(!shareStudy)shareNotes=false;}
    else if(event.target.id==='mentor-share-notes')shareNotes=shareStudy&&event.target.checked;
    else return false;
    savePrefs();render();return true;
  }
  function handleSubmit(event){
    if(event.target.id!=='mentor-question-form')return false;
    event.preventDefault();void send(event.target.elements.question.value);return true;
  }
  return {view,afterRender,handleAction,handleChange,handleSubmit};
}
