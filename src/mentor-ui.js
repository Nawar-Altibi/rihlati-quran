import { buildMentorSnapshot, generateMentorPlan, answerMentorLocally, mentorModelPayload, MENTOR_SUGGESTIONS } from './mentor-core.js';

const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const label=t=>escapeHTML(t);
const modeText=t=>t==='ai'?'إجابة نموذج AI':'من سجلاتك، بدون إرسال بيانات';
const SESSION_KEY='rihlati-mentor-private-access';

export function createMentorUI({getData,render,navigate,openSurah,openReview,startQuiz,toast}){
  let messages=[],busy=false,cloudOptIn=false;
  function sessionKey(){try{return sessionStorage.getItem(SESSION_KEY)||'';}catch{return '';}}
  function saveSessionKey(key){try{sessionStorage.setItem(SESSION_KEY,key);return true;}catch{return false;}}
  function snapshot(){return buildMentorSnapshot(getData());}
  function view(){
    const s=snapshot(),plan=generateMentorPlan(s);
    const cards=plan.length?plan.map((t,i)=>
      '<article class="mentor-task"><span class="mentor-step">'+(i+1)+'</span><div><strong>'+label(t.title)+'</strong><small>'+label(t.reason)+' · '+t.minutes+' دقيقة</small></div>'+
      (t.surah?'<button class="secondary small-btn" data-action="mentor-open-surah" data-surah="'+t.surah+'">افتح السورة</button>':'')+'</article>'
    ).join(''):'<p class="simple-muted">ما في مراجعات مستحقة مؤكدة. سجّل مراجعاتك لتحصل على اقتراحات أدق.</p>';
    const conversation=messages.length?messages.slice(-12).map(x=>
      '<div class="mentor-message mentor-message-'+(x.role==='user'?'user':'assistant')+'"><div class="mentor-message-meta">'+
      (x.role==='user'?'سؤالك':'مساعد رحلتي · '+modeText(x.mode))+'</div><p>'+label(x.text)+'</p></div>'
    ).join(''):'<p class="simple-muted">اسألني عن مراجعات اليوم، مواضع أخطائك، التسميع، أو تقدمك. عندي وصول لسجلاتك المحلية للقراءة فقط.</p>';
    return '<header class="simple-page-heading mentor-heading"><div><div class="simple-kicker">مساعدك في الرحلة</div><h1>مساعد رحلتي</h1><p>خطة مبنية على تسجيلاتك، بدون اختلاق إتقان أو تعديل بياناتك.</p></div></header>'+
      '<div class="mentor-grid"><section class="simple-panel mentor-plan"><div class="mentor-plan-title"><h2>ورد اليوم المقترح</h2><span>يتحدّث تلقائيًا مع سجلّك</span></div>'+
      '<div class="mentor-facts"><span>المرحلة: '+label(s.stage.title)+'</span><span>'+s.due.length+' مراجعات مستحقة</span><span>'+s.weakAyahs.length+' مواضع أخطاء معروفة</span></div>'+
      '<div class="mentor-tasks">'+cards+'</div><div class="simple-actions">'+
      '<button class="secondary small-btn" data-action="mentor-review">＋ سجّل مراجعة</button>'+
      '<button class="secondary small-btn" data-action="mentor-quiz">⚡ اختبر حفظك</button></div></section>'+
      '<section class="simple-panel mentor-chat"><div class="mentor-plan-title"><h2>اسأل المساعد</h2><span>يجيب حسب البيانات الفعلية</span></div>'+
      '<div class="mentor-suggestions">'+MENTOR_SUGGESTIONS.map((q,i)=>'<button class="secondary small-btn" type="button" data-action="mentor-suggest" data-index="'+i+'">'+label(q)+'</button>').join('')+'</div>'+
      '<div id="mentor-messages" class="mentor-conversation" aria-live="polite">'+conversation+'</div>'+
      '<form id="mentor-question-form" class="mentor-composer"><label class="mushaf-visually-hidden" for="mentor-question">سؤالك للمساعد</label><input id="mentor-question" name="question" class="input" type="text" maxlength="320" autocomplete="off" placeholder="مثلاً: شو لازم راجع بكرا؟" required'+(busy?' disabled':'')+'><button class="primary" type="submit"'+(busy?' disabled':'')+'>'+(busy?'جارٍ التفكير...':'اسأل')+'</button></form>'+
      '<div class="mentor-privacy"><label><input type="checkbox" id="mentor-use-cloud"'+(cloudOptIn?' checked':'')+'> استخدم نموذج AI السحابي لهذا السؤال (اختياري)</label>'+
      '<p>بدون تفعيل الخيار، الإجابات محلية بالكامل. عند تفعيله يُرسَل سؤالك وملخص محدود من إحصائياتك إلى Cloudflare؛ لا تُرسل الملاحظات الخاصة أو كامل سجل الحفظ أو المحادثات. يتطلب ضبط خدمة AI ورمز وصول خاص في Cloudflare.</p>'+
      (cloudOptIn?'<div class="mentor-secret"><label for="mentor-passcode">رمز الوصول الخاص للخدمة (يحفظ مؤقتًا في هذه الجلسة فقط)</label><input id="mentor-passcode" class="input" type="password" autocomplete="off" placeholder="رمز مفعّل من إعدادات Cloudflare" value=""><span>'+(sessionKey()?'يوجد رمز محفوظ لهذه الجلسة':'لم يُدخَل رمز بعد')+'</span></div>':'')+
      '</div></section></div>'+
      '<p class="mentor-disclaimer">المساعد يقدّم اقتراحات تنظيمية فقط، وليس شيخًا أو مصححًا للتجويد أو جهة اعتماد للإجازة. لا يغيّر سجلاتك أو مواعيدك من تلقاء نفسه.</p>';
  }
  function append(role,text,mode='local'){
    messages.push({role,text:String(text).slice(0,2200),mode});
    messages=messages.slice(-16);
  }
  function send(question){
    const q=String(question||'').trim();
    if(!q||busy)return;
    if(q.length>320){toast('السؤال طويل؛ اكتبه بشكل أقصر.');return;}
    const snap=snapshot(),local=answerMentorLocally(snap,q);
    append('user',q);
    if(!cloudOptIn){
      append('assistant',local,'local');
      render();scrollChat();return;
    }
    const key=document.querySelector('#mentor-passcode')?.value.trim()||sessionKey();
    if(key && key.length>=16)saveSessionKey(key);
    if(!key || key.length<16){
      append('assistant','حتى تستخدم نموذج AI، فعّل خدمة Cloudflare من إعدادات المشروع وأدخل رمز وصولها الخاص. رح أعطيك هلق الإجابة المحلية: '+local,'local');
      render();scrollChat();return;
    }
    busy=true;render();scrollChat();
    const payload=mentorModelPayload(snap,q);
    fetch('/api/mentor',{
      method:'POST',headers:{'Content-Type':'application/json','X-Mentor-Token':key},
      body:JSON.stringify(payload),cache:'no-store',credentials:'omit'
    }).then(async response=>{
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||'الخدمة غير متاحة حاليًا.');
      if(typeof result.answer!=='string'||!result.answer.trim())throw new Error('الرد غير مكتمل.');
      append('assistant',result.answer,'ai');
    }).catch(err=>append('assistant','تعذّر استخدام نموذج AI: '+err.message+'\nالاقتراح المحلي: '+local,'local'))
      .finally(()=>{busy=false;if(document.querySelector('#mentor-question-form')){render();scrollChat();}});
  }
  function scrollChat(){
    const feed=document.querySelector('#mentor-messages');if(feed)feed.scrollTop=feed.scrollHeight;
  }
  function handleAction(action,target){
    switch(action){
      case 'mentor-open-surah':if(Number(target.dataset.surah))openSurah(Number(target.dataset.surah));return true;
      case 'mentor-review':openReview();return true;
      case 'mentor-quiz':startQuiz('random');return true;
      case 'mentor-suggest':{
        const q=MENTOR_SUGGESTIONS[Number(target.dataset.index)];if(q)send(q);
        return true;
      }
    }
    return false;
  }
  function handleChange(event){
    if(event.target.id==='mentor-use-cloud'){
      cloudOptIn=event.target.checked;
      render();return true;
    }
    return false;
  }
  function handleSubmit(event){
    if(event.target.id!=='mentor-question-form')return false;
    event.preventDefault();
    const form=event.target,question=form.elements.question.value;
    send(question);return true;
  }
  return {view,handleAction,handleChange,handleSubmit};
}
