import {makeNewUserData,DEFAULT_SETTINGS} from './data.js';
import {migrateData} from './storage.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const cloudRoot='/api/account';
const STAGES=[['amma','جزء عمّ'],['tabarak','جزء تبارك'],['qad','جزء قد سمع'],['baqarah','سورة البقرة']];
function readableError(error,fallback='حصل خطأ بالاتصال. حاول مرة ثانية.'){
  return typeof error?.message==='string'&&error.message?error.message:fallback;
}
async function api(path,options={}){
  const response=await fetch(cloudRoot+path,{
    credentials:'same-origin',cache:'no-store',...options
  });
  const body=await response.json().catch(()=>({error:'تعذرت قراءة استجابة الخادم.'}));
  if(!response.ok){
    const e=new Error(body.error||'تعذر إكمال الطلب.');
    e.status=response.status;e.code=body.code;
    throw e;
  }
  return body;
}
const post=(action,payload={})=>api('',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({action,...payload})});
const safeSessionKey=id=>'rihlati-pending-'+String(id).replace(/[^\w-]/g,'');
const counts=doc=>({
  memorize:(doc?.units||[]).filter(u=>!u.legacy).length,
  reviews:(doc?.activities||[]).filter(a=>a.completed&&a.type==='revision').length,
  planned:(doc?.studyPlan||[]).length,
  sessions:(doc?.sessions||[]).filter(x=>x.date).length
});

export function createAccountClient({getData,setData,guestData,restoreGuest,toast}){
  let available=false,registration=false,siteKey=null,mode='guest',user=null,revision=0;
  let modal='',email='',purpose='email',busy=false,error='',sending=false,pending=null,blocked=false;
  let pendingRecovery=null,captchaToken='',turnstileWidgetId=null;
  const button=document.getElementById('account-entry');
  const root=document.getElementById('account-root');
  const escUser=()=>esc(user?.displayName||user?.email||'حسابي');
  const inAccount=()=>mode==='account'&&!!user;
  const logUser=()=>user;
  const statusText=()=>blocked?'⚠ تعارض مزامنة':pending||sending?'⟳ جاري الحفظ':'☁ محفوظ بالسحابة';

  function buttonView(){
    if(!button)return;
    if(!available)button.textContent='حسابي · قريبًا';
    else if(user)button.textContent=(user.displayName||'حسابي')+' · '+(inAccount()?statusText():'إكمال الإعداد');
    else button.textContent='تسجيل الدخول / حساب جديد';
    button.title=available?'إدارة الحساب والمزامنة':'حسابات المستخدمين غير مفعّلة بعد';
  }
  const hint=()=>{
    if(error)return '<p class="account-notice account-notice-error" role="alert">'+esc(error)+'</p>';
    return '';
  };
  const htmlInput=(name,label,type='text',placeholder='',props='')=>
    '<label class="account-field"><span>'+label+'</span><input class="input" name="'+name+'" type="'+type+'" placeholder="'+placeholder+'" '+props+'></label>';
  function captcha(){
    if(!siteKey)return '';
    return '<div class="account-captcha"><div id="account-turnstile"></div><small>تحقّق أمني لحماية الحسابات من الطلبات الآلية.</small></div>';
  }
  function page(){
    const title={login:'أهلًا بعودتك',signup:'أنشئ رحلتك الخاصة',verify:'أكّد بريدك',recover:'استعادة كلمة المرور',
      password:'كلمة مرور جديدة',setup:'ابدأ رحلتك',dashboard:'حسابي ومزامنة التقدم',disabled:'حسابات رِحلتي'}[modal]||'حسابي';
    const intro={
      login:'سجّل دخولك حتى تلاقي خطتك ومراجعاتك على أجهزتك.',
      signup:'كل شخص إله سجل حفظ ومراجعات وخطة مستقلة تمامًا.',
      verify:'اكتب الرمز الذي وصل إلى بريدك. ما رح نسجّل أي إنجاز تلقائيًا.',
      recover:'أرسلنا لك رمزًا إذا كان البريد مسجّلًا.',
      setup:'كيف بتحب تبدأ؟ خطتك الجديدة لحالها، أو تنقل سجلات هالجهاز بإذنك.',
      dashboard:'تقدمك مرتبط بحسابك، وما في حدا تاني بيقدر يشوفه.'
    }[modal]||'';
    let content='';
    const formButton=(title,action)=>'<button type="submit" class="primary account-submit" '+(busy?'disabled':'')+'>'+title+'</button>';
    const emailInput=htmlInput('email','البريد الإلكتروني','email','example@email.com','required autocomplete="email" value="'+esc(email)+'"');
    if(modal==='disabled')content='<p class="account-notice">ميزة الحسابات قيد الإعداد. الموقع شغّال حاليًا كضيف بدون ما يغيّر بياناتك.</p>';
    if(modal==='login')content='<form class="account-form" data-account-form="login">'+emailInput+
      htmlInput('password','كلمة المرور','password','••••••••••••','required autocomplete="current-password"')+
      captcha()+formButton('تسجيل الدخول')+'</form>'+
      '<div class="account-links"><button type="button" data-account-action="signup">إنشاء حساب جديد</button>'+
      '<button type="button" data-account-action="recover">نسيت كلمة المرور؟</button></div>';
    if(modal==='signup')content='<form class="account-form" data-account-form="signup">'+
      htmlInput('displayName','شو بتحب نناديك؟','text','اسمك الأول','required minlength="2" maxlength="50" autocomplete="name"')+
      emailInput+htmlInput('password','كلمة مرور قوية (12 حرفًا على الأقل)','password','••••••••••••',
        'required minlength="12" maxlength="128" autocomplete="new-password"')+
      captcha()+formButton('إنشاء الحساب')+'</form>'+
      '<p class="account-help">رح تحتاج تؤكد بريدك قبل استخدام الحساب. لا تشارك رمز التأكيد مع أي شخص.</p>'+
      '<div class="account-links"><button type="button" data-account-action="login">عندي حساب بالفعل</button></div>';
    if(modal==='verify')content='<form class="account-form" data-account-form="verify">'+
      '<p class="account-mail-note">البريد: <b dir="ltr">'+esc(email)+'</b></p>'+
      htmlInput('code','رمز التحقق من البريد','text','000000','required pattern="[0-9]{6,8}" minlength="6" maxlength="8" inputmode="numeric" autocomplete="one-time-code"')+
      formButton('تأكيد الرمز')+'</form><div class="account-links"><button type="button" data-account-action="login">العودة للدخول</button></div>';
    if(modal==='recover')content='<form class="account-form" data-account-form="recover">'+emailInput+captcha()+
      formButton('أرسل رمز الاستعادة')+'</form>'+
      '<div class="account-links"><button type="button" data-account-action="login">العودة لتسجيل الدخول</button></div>';
    if(modal==='password')content='<form class="account-form" data-account-form="set-password">'+
      htmlInput('password','كلمة المرور الجديدة','password','12 حرفًا أو أكثر','required minlength="12" maxlength="128" autocomplete="new-password"')+
      formButton('تغيير كلمة المرور')+'</form>';
    if(modal==='setup'){
      const current=guestData(),s=counts(current);
      content='<div class="account-setup-actions"><form class="account-form account-setup-form" data-account-form="new">'+
        '<h3>ابدأ بخطة جديدة من الصفر</h3><p>ما رح نفترض إنك حافظ أي سورة؛ كل ورد تضيفه بإيدك.</p>'+
        '<label class="account-field"><span>على شو حابب تركز أول شي؟</span>'+
        '<select class="select" name="stage">'+STAGES.map(([v,t])=>'<option value="'+v+'">'+t+'</option>').join('')+'</select></label>'+
        htmlInput('dailyMinutes','قديش وقتك بالدقائق يوميًا؟','number','','required min="10" max="180" value="30"')+
        formButton('ابدأ رحلتي الجديدة')+'</form>'+
        '<div class="account-import-option"><h3>عندي تقدم على هالجهاز</h3>'+
        '<p>'+s.memorize+' حفظ، '+s.reviews+' مراجعة، '+s.planned+' أوراد مخططة، '+s.sessions+' جلسات تسميع.</p>'+
        '<button type="button" class="secondary" data-account-action="import-guest">أنقل سجلات هالجهاز لحسابي</button>'+
        '<small>النقل اختياري وبموافقتك فقط. النسخة المحلية رح تبقى موجودة.</small></div>'+
        '<button type="button" class="account-logout" data-account-action="logout">أكمل كضيف · تسجيل الخروج</button></div>';
    }
    if(modal==='dashboard')content='<div class="account-dashboard"><div class="account-user">'+
      '<span class="account-avatar">'+esc((user?.displayName||user?.email||'ق').trim()[0])+'</span>'+
      '<div><b>'+escUser()+'</b><small dir="ltr">'+esc(user?.email||'')+'</small></div></div>'+
      '<div class="account-cloud-state">'+statusText()+'</div>'+
      '<p>تقدم الحساب محفوظ في السحابة ومتاح بعد الدخول من جهاز آخر. نسخة الضيف على هالجهاز محفوظة بشكل منفصل.</p>'+
      (blocked?'<div class="account-notice account-notice-error">في تغييرات غير متزامنة. ما رح نكتب فوق بيانات الجهاز الآخر. صدّر نسخة احتياطية من التغييرات قبل المتابعة.</div>':'')+
      '<div class="account-dashboard-actions">'+
      '<button type="button" class="secondary" data-account-action="sync">حاول مزامنة الآن</button>'+
      '<button type="button" class="secondary" data-account-action="export">صدّر نسخة احتياطية</button>'+
      '<button type="button" class="account-logout" data-account-action="'+(pending||sending||blocked?'export-and-logout':'logout')+'">'+
      (pending||sending||blocked?'تنزيل نسخة احتياطية ثم الخروج':'تسجيل الخروج')+'</button></div></div>';
    if(!registration&&modal==='login')content+='<p class="account-help">إنشاء الحسابات الجديدة غير متاح حتى إكمال إعدادات الأمان وإرسال البريد.</p>';
    return '<div class="account-overlay" data-account-close><section class="account-dialog" role="dialog" aria-modal="true" aria-label="'+title+'">'+
      '<div class="account-dialog-head"><div class="account-kicker">رِحلتي مع القرآن</div>'+
      '<button class="account-close" type="button" data-account-action="close" aria-label="إغلاق">×</button></div>'+
      '<div class="account-dialog-lead"><span class="account-ornament">۞</span><h2>'+title+'</h2><p>'+intro+'</p></div>'+
      hint()+content+'</section></div>';
  }
  function renderModal(){
    if(!root)return;
    root.innerHTML=modal?page():'';
    if(['signup','login','recover'].includes(modal))void mountCaptcha();
    const emailField=root.querySelector('[name="email"]');
    if(emailField&&email)emailField.value=email;
  }
  async function mountCaptcha(){
    if(!siteKey)return;
    captchaToken='';
    const mount=root?.querySelector('#account-turnstile');
    if(!mount)return;
    if(!window.turnstile){
      if(!document.querySelector('#account-turnstile-script')){
        const script=document.createElement('script');
        script.id='account-turnstile-script';
        script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async=true;script.defer=true;
        document.head.appendChild(script);
      }
      for(let n=0;n<16&&!window.turnstile&&root?.querySelector('#account-turnstile')===mount;n++)
        await new Promise(r=>setTimeout(r,200));
    }
    if(!window.turnstile||root?.querySelector('#account-turnstile')!==mount){
      error='تعذر تحميل التحقق الأمني. تحقق من الإنترنت وحاول مجددًا.';return;
    }
    turnstileWidgetId=window.turnstile.render(mount,{
      sitekey:siteKey,theme:document.body.classList.contains('dark')?'dark':'light',
      callback:token=>{captchaToken=token;},'expired-callback':()=>{captchaToken='';}
    });
  }
  function open(next='login'){modal=available?next:'disabled';error='';renderModal();}
  function close(){modal='';error='';root.innerHTML='';}
  function saveCopy(payload=getData()){
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='rihlati-account-backup-'+new Date().toISOString().slice(0,10)+'.json';
    link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function savePendingLocally(){
    if(!user||!pending)return;
    try{
      sessionStorage.setItem(safeSessionKey(user.id),JSON.stringify({expectedRevision:revision,payload:pending}));
    }catch{ /* Server saving remains the primary persistence target. */ }
  }
  function showCloudWarning(msg){
    toast(msg);if(!modal)open('dashboard');else {error=msg;renderModal();}
  }
  async function sync(){
    if(!inAccount()||sending||blocked||!pending)return;
    sending=true;buttonView();
    try{
      while(pending&&inAccount()&&!blocked){
        const snapshot=pending;pending=null;
        const result=await api('/state',{method:'PUT',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({expectedRevision:revision,payload:snapshot})});
        revision=result.revision;
        if(!pending)sessionStorage.removeItem(safeSessionKey(user.id));
        else savePendingLocally();
        buttonView();
      }
    }catch(e){
      pending=pending||getData();
      savePendingLocally();
      if(e.status===409){blocked=true;showCloudWarning('في تعديل أحدث من جهاز آخر؛ وقفنا المزامنة حتى ما نضيّع البيانات. صدّر نسخة حسابك قبل المتابعة.');}
      else showCloudWarning('البيانات لسه مو محفوظة بالسحابة؛ احتفظ بالتبويب مفتوحًا أو صدّر نسخة احتياطية.');
    }finally{sending=false;buttonView();}
  }
  function save(doc){
    if(!inAccount())return false;
    if(blocked){showCloudWarning('المزامنة متوقفة بسبب تعارض بيانات. صدّر نسخة من تغييراتك.');return false;}
    pending=structuredClone(doc);savePendingLocally();buttonView();void sync();return true;
  }
  async function loadState(){
    const state=await api('/state');
    revision=Number(state.revision)||0;
    let cached=null;
    try{cached=JSON.parse(sessionStorage.getItem(safeSessionKey(user.id))||'null');}catch{}
    if(state.payload){
      const cleaned=migrateData(state.payload,DEFAULT_SETTINGS);
      setData(cleaned);
      mode='account';
      if(cached?.payload){
        pendingRecovery=cached;
        blocked=true;
        error='في تغييرات من جلسة سابقة ما تأكد حفظها. ما رح ننقلها فوق التقدم الموجود بالسحابة تلقائيًا. اختر تصدير نسخة من الخيارات.';
        open('dashboard');buttonView();return;
      }
      close();buttonView();return;
    }
    // No rows for this user yet: explicit choice between brand-new data and
    // the separate legacy guest copy. Never import localStorage silently.
    mode='setup';open('setup');buttonView();
  }
  async function begin(payload){
    const state=await api('/state',{method:'PUT',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({expectedRevision:0,payload})});
    revision=state.revision;pending=null;blocked=false;
    setData(payload);mode='account';close();buttonView();
    toast('أهلًا في رحلتك! صار فيك تخصص خطتك وتحفظ تقدمك بحسابك.');
  }
  async function authenticatedSession(session,recovery=false){
    user=session.user;buttonView();
    if(recovery){mode='setup';open('password');}
    else await loadState();
  }
  async function handleForm(form){
    if(busy)return;
    const kind=form.dataset.accountForm,fd=new FormData(form);
    busy=true;error='';
    const submitButton=form.querySelector('[type="submit"]');
    if(submitButton)submitButton.disabled=true;
    const verifiedCaptchaToken=captchaToken;
    try{
      if(kind==='new'){
        const mins=Number(fd.get('dailyMinutes')),stage=String(fd.get('stage')||'amma');
        if(!Number.isInteger(mins)||mins<10||mins>180)throw new Error('حدد وقتًا يوميًا بين 10 و180 دقيقة.');
        await begin(makeNewUserData({stage,dailyMinutes:mins}));
        return;
      }
      const payload={email:String(fd.get('email')||email).trim().toLowerCase(),
        password:String(fd.get('password')||''),displayName:String(fd.get('displayName')||''),
        captchaToken:verifiedCaptchaToken};
      email=payload.email||email;
      const result=await post(kind,payload.code?payload:{...payload,
        ...(kind==='verify'?{code:String(fd.get('code')||''),purpose}:{} )});
      if(kind==='signup'){purpose='email';open('verify');toast('تحقق من بريدك للحصول على رمز التأكيد.');}
      else if(kind==='recover'){purpose='recovery';open('verify');toast('إذا كان البريد موجودًا، رح يصلك رمز إعادة التعيين.');}
      else if(kind==='verify')await authenticatedSession(result,purpose==='recovery');
      else if(kind==='login')await authenticatedSession(result);
      else if(kind==='set-password'){await loadState();toast('تم تعديل كلمة المرور.');}
    }catch(e){error=readableError(e);}
    finally{busy=false;renderModal();buttonView();}
  }
  async function handleAction(action){
    if(action==='close'){close();return;}
    if(action==='login'||action==='signup'||action==='recover'){
      if(action==='signup'&&!registration){error='إنشاء الحسابات غير مفعّل حتى إكمال حماية البريد والتحقق.';renderModal();return;}
      open(action);return;
    }
    if(action==='import-guest'){
      const original=guestData();
      if(!original){error='تعذر قراءة بيانات هالجهاز. ما غيّرنا شيئًا.';renderModal();return;}
      if(!confirm('متأكد إنك بدك تنقل نسخة هالجهاز إلى حسابك؟ النقل لا يحذف النسخة المحلية، ولا يتم دمج البيانات تلقائيًا.'))return;
      busy=true;renderModal();
      try{await begin(migrateData(original,DEFAULT_SETTINGS));}
      catch(e){error=readableError(e);renderModal();}
      finally{busy=false;}
      return;
    }
    if(action==='sync'){if(blocked){error='تضارب التعديل يحتاج نسخة احتياطية قبل الحل. لن نستبدل سجلات جهاز آخر تلقائيًا.';renderModal();return;}await sync();return;}
    if(action==='export'){
      saveCopy(pendingRecovery?.payload||pending||getData());
      toast('جُهزت نسخة احتياطية من تقدم هذا المتصفح.');
      return;
    }
    if(action==='logout'||action==='export-and-logout'){
      if(sending){error='ما زالت مزامنة جارية. حاول بعد انتهاء العملية.';renderModal();return;}
      if(action==='export-and-logout'){
        if(!confirm('في تغييرات غير مؤكدة بالسحابة. رح ننزّل نسخة منها على جهازك، وبعدين نخرج من الحساب بدون الكتابة فوق بياناته. متابعة؟'))return;
        saveCopy(pendingRecovery?.payload||pending||getData());
      }else if(pending||blocked){
        error='لديك تغييرات غير محفوظة؛ نزّل نسخة احتياطية أولًا.';
        renderModal();return;
      }
      busy=true;renderModal();
      try{
        await post('logout');
        if(user)sessionStorage.removeItem(safeSessionKey(user.id));
        user=null;mode='guest';revision=0;blocked=false;pending=null;pendingRecovery=null;
        restoreGuest();close();buttonView();toast('تم تسجيل الخروج. رجعت لبيانات الضيف الموجودة على هالجهاز.');
      }catch(e){error=readableError(e);renderModal();}
      finally{busy=false;}
    }
  }
  async function start(){
    button?.addEventListener('click',()=>open(user?(inAccount()?'dashboard':'setup'):'login'));
    root?.addEventListener('click',e=>{
      if(e.target?.matches('[data-account-close]'))close();
      const control=e.target.closest('[data-account-action]');
      if(control)void handleAction(control.dataset.accountAction);
    });
    root?.addEventListener('submit',e=>{
      const form=e.target.closest('[data-account-form]');
      if(form){e.preventDefault();void handleForm(form);}
    });
    window.addEventListener('online',()=>{if(inAccount()&&pending&&!blocked)void sync();});
    buttonView();
    try{
      const session=await api('');
      available=Boolean(session.enabled);
      registration=Boolean(session.registrationEnabled);
      siteKey=typeof session.captchaSiteKey==='string'?session.captchaSiteKey:null;
      if(available&&session.authenticated&&session.user){
        user=session.user;await loadState();
      }
    }catch{available=false; /* Accounts unavailable; keep guest app safe. */ }
    buttonView();
  }
  return {start,open,save,isAccount:inAccount,user:logUser};
}
