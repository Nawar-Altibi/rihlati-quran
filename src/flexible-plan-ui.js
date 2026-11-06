import { SURAH_NAMES } from './data.js';
import { addDays, todayKey } from './logic.js';
import {planEntries,savePlanEntry,movePlanEntry,removePlanEntry,startSuggestedPlan,planItemState,dailyPlanStats,surahLabel} from './flexible-plan.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatDate=day=>new Intl.DateTimeFormat('ar',{weekday:'long',day:'numeric',month:'short'}).format(new Date(day+'T12:00:00'));
const kindName={review:'مراجعة',memorize:'حفظ جديد',recitation:'تحضير تسميع'};
const stateName={done:'تم تسجيل الإنجاز',today:'اليوم',upcoming:'قادم',missed:'فات موعده — قابل للترحيل'};
const stateClass={done:'done',today:'today',upcoming:'upcoming',missed:'missed'};
const B=(a,t,id='',cls='secondary small-btn')=>'<button type="button" class="'+cls+'" data-action="'+a+'"'+(id?' data-id="'+esc(id)+'"':'')+'>'+t+'</button>';

export function createFlexiblePlanUI({getData,persist,render,toast,openModal,openReview,openMemorize,openRecitation,openMushafSurah}) {
  let guideOpen=false;
  const d=()=>getData();
  const all=()=>planEntries(d());
  const find=id=>all().find(x=>x.id===id);
  const onSave=msg=>{
    if(!persist())return false;
    document.querySelector('#modal-root').innerHTML='';
    render();toast(msg);return true;
  };
  function itemCard(entry) {
    const state=planItemState(d(),entry);
    const range=entry.fromAyah===1&&entry.toAyah===SURAH_NAMES[entry.surah-1]?.ayahs?
      'السورة كاملة':'الآيات '+entry.fromAyah+'–'+entry.toAyah;
    const isDone=state==='done';
    return '<article class="journey-entry '+(isDone?'is-done':'')+'">'+
      '<div class="journey-entry-mark" aria-hidden="true">'+(entry.kind==='review'?'◷':entry.kind==='memorize'?'✦':'◉')+'</div>'+
      '<div class="journey-entry-body"><div class="journey-entry-head"><strong>سورة '+esc(surahLabel(entry.surah))+'</strong><span class="journey-pill '+stateClass[state]+'">'+stateName[state]+'</span></div>'+
      '<p>'+kindName[entry.kind]+' · '+range+' · '+entry.minutes+' دقيقة · '+formatDate(entry.date)+'</p>'+
      (entry.notes?'<small>'+esc(entry.notes)+'</small>':'')+
      '<div class="journey-entry-actions">'+B('journey-open-surah','افتح المصحف',entry.id)+
      (!isDone?B('journey-log','سجّل الإنجاز',entry.id,'primary small-btn')+
      B('journey-edit','تعديل',entry.id)+B('journey-tomorrow','رحّل لبكرا',entry.id)+
      B('journey-remove','حذف الورد',entry.id,'journey-delete small-btn'):'')+'</div></div></article>';
  }
  function guide() {
    if(!guideOpen)return '';
    return '<section class="journey-guide" aria-label="دليل الاستخدام">'+
      '<div class="journey-guide-header"><div><span class="journey-eyebrow">دليل مصوّر مبسّط</span><h3>كيف تستخدم رحلتك بـ3 خطوات؟</h3></div>'+B('journey-guide','إخفاء الدليل')+'</div>'+
      '<div class="journey-guide-grid">'+
      '<article><div class="journey-mini-visual"><span class="journey-mini-date">السبت · ٧ نوفمبر</span><span class="journey-mini-card">◷ سورة النبأ</span><span class="journey-mini-card">◷ سورة النازعات</span><span class="journey-mini-card">◷ سورة عبس</span></div><b>١. حضّر وردك</b><p>ضيف سورة أو مقطعًا لأي يوم. فيك تغيّر الترتيب والمدة والتاريخ بلا حدود ثابتة.</p></article>'+
      '<article><div class="journey-mini-visual"><span class="journey-mini-card strong">◈ افتح المصحف</span><span class="journey-mini-verse">﴿ وَعَمَّ يَتَسَاءَلُونَ ﴾</span><span class="journey-mini-card">اكشف الآية عند الاختبار</span></div><b>٢. راجع واختبر نفسك</b><p>اقرأ بالمصحف أو أخفِ الآيات واكشفها بـEnter لتتأكد من حفظك.</p></article>'+
      '<article><div class="journey-mini-visual"><span class="journey-mini-card strong">✓ سجّل المراجعة</span><span class="journey-mini-meter"><i></i></span><span class="journey-mini-card">تقدّمك من سجلاتك الحقيقية</span></div><b>٣. سجّل إنجازك الفعلي</b><p>الورد المخطط ما بينحسب منجز حتى تسجّل الحفظ أو المراجعة أو التسميع فعلًا.</p></article>'+
      '</div><p class="journey-guide-note">الرسومات توضيحية. سجلاتك محفوظة على هذا المتصفح، والأفضل تصدّر نسخة احتياطية من الإعدادات.</p></section>';
  }
  function emptyState(){
    const start=addDays(todayKey(),1);
    return '<section class="journey-start"><span class="journey-start-star">✧</span><div><h3>ابدأ بخطة خفيفة تناسبك</h3>'+
      '<p>بما إنك حابب ترجع تثبّت جزء عمّ من الصفر، فينا نقترح '+formatDate(start)+' مراجعة النبأ والنازعات وعبس، وبعدها التكوير في اليوم التالي. هي مجرد خطة، مو إنجاز مسجّل؛ فيك تغيّر كل تفصيل.</p>'+
      '<div class="simple-actions">'+B('journey-template','اعتمد الخطة المبدئية','','primary')+B('journey-add','أبدأ بخطة من عندي')+'</div></div></section>';
  }
  function today() {
    const date=todayKey(),stats=dailyPlanStats(d(),date),todayItems=all().filter(x=>x.date===date);
    const missed=all().filter(x=>x.date<date&&planItemState(d(),x)==='missed');
    return '<section class="journey-today"><div class="journey-today-header"><div><span class="journey-eyebrow">وردك على راحتك</span><h2>خطة اليوم المرنة</h2><p>الورِد بيتغير مع ظروفك، واليوم اللي ما تقدر تراجع فيه ما بينحسب إنجاز.</p></div>'+B('journey-add','＋ أضف وردًا','','primary small-btn')+'</div>'+
      '<div class="journey-today-metrics"><span><b>'+stats.total+'</b> مهام مخططة</span><span><b>'+stats.done+'</b> مكتملة فعلًا</span><span><b>'+stats.minutes+'</b> دقيقة مقترحة</span></div>'+
      (todayItems.length?'<div class="journey-today-items">'+todayItems.map(itemCard).join('')+'</div>':(all().length?'<p class="simple-muted">ما حددت ورد لليوم بعد. أضف أي سورة أو افتح الخطة ورحّل ورد سابق.</p>':emptyState()))+
      (missed.length?'<div class="journey-carry"><b>في '+missed.length+' ورد فات موعده، وما سجّلناه منجز.</b><span>مو لازم تعوّض الكل مرة وحدة؛ رحّل اللي يناسبك فقط.</span>'+B('journey-open-plan','شوف المهام القديمة')+'</div>':'')+
      '<div class="journey-today-footer">'+B('journey-open-plan','خصص خطتك')+B('journey-guide','؟ كيف بستخدم الموقع؟')+'</div>'+guide()+'</section>';
  }
  function plan() {
    const entries=all(),todayKeyValue=todayKey(),nextEnd=addDays(todayKeyValue,13);
    const old=entries.filter(x=>x.date<todayKeyValue&&planItemState(d(),x)==='missed');
    const future=entries.filter(x=>x.date>=todayKeyValue&&x.date<=nextEnd)
      .sort((a,b)=>a.date.localeCompare(b.date)||a.surah-b.surah);
    const later=entries.filter(x=>x.date>nextEnd).sort((a,b)=>a.date.localeCompare(b.date));
    const stats=dailyPlanStats(d());
    const groups=arr=>{
      if(!arr.length)return '';
      const dates=[...new Set(arr.map(x=>x.date))];
      return dates.map(date=>'<div class="journey-date-group"><div class="journey-date-title"><b>'+formatDate(date)+'</b><span>'+arr.filter(x=>x.date===date).length+' أوراد</span></div>'+
        arr.filter(x=>x.date===date).map(itemCard).join('')+'</div>').join('');
    };
    return '<section class="journey-planner"><div class="journey-planner-head"><div><span class="journey-eyebrow">خطة قابلة للتغيير في أي وقت</span><h2>خُطتي على مزاجي</h2><p>حدد شو بدك تحفظ أو تراجع، وإيمتى. ما في ترتيب إجباري، ولا ورد مخطط بينحسب إنجاز.</p></div><div class="journey-planner-cta">'+B('journey-guide','؟ دليل الاستخدام')+B('journey-add','＋ أضف وردًا','','primary')+'</div></div>'+guide()+
      '<div class="journey-planner-metrics"><span><b>'+entries.length+'</b> أوراد بالخطة</span><span><b>'+stats.missed+'</b> تحتاج إعادة جدولة</span><span><b>'+stats.minutes+'</b> دقيقة اليوم</span></div>'+
      (!entries.length?emptyState():'')+
      (old.length?'<section class="journey-group"><h3>أوراد فات موعدها <small>غيّرها بدون تسجيل إنجاز وهمي</small></h3>'+groups(old)+'</section>':'')+
      '<section class="journey-group"><h3>الأيام القادمة <small>14 يوم من اليوم</small></h3>'+
      (future.length?groups(future):'<p class="simple-muted">ما في مهام محددة بالفترة القادمة؛ اضغط «أضف وردًا» لتبدأ.</p>')+'</section>'+
      (later.length?'<section class="journey-group"><h3>لاحقًا</h3>'+groups(later)+'</section>':'')+'</section>';
  }
  function edit(id=null){
    const existing=id?find(id):null;
    if(id&&!existing)return toast('ما لقينا الورد المطلوب.');
    const v=existing||{date:todayKey(),kind:'review',surah:78,minutes:20,fromAyah:1,toAyah:40,notes:''};
    const count=SURAH_NAMES[v.surah-1]?.ayahs||40;
    const whole=Number(v.fromAyah||1)===1&&Number(v.toAyah||count)===count;
    openModal(existing?'تعديل الورد':'إضافة ورد لخُطتك','<input name="journeyPlanForm" type="hidden" value="1">'+
      '<input type="hidden" name="id" value="'+esc(existing?.id||'')+'">'+
      '<div class="journey-modal-tip">هنا عم تخطط فقط؛ ما رح نسجّل أي سورة محفوظة أو مراجَعة إلا إذا أكدت إنجازها بعدين.</div>'+
      '<div class="journey-modal-grid"><label class="field"><span>إيمتى؟</span><input class="input" name="date" type="date" value="'+esc(v.date)+'" required></label>'+
      '<label class="field"><span>نوع الورد</span><select class="select" name="kind">'+
      Object.entries(kindName).map(([k,t])=>'<option value="'+k+'"'+(v.kind===k?' selected':'')+'>'+t+'</option>').join('')+'</select></label>'+
      '<label class="field"><span>السورة</span><select class="select" name="surah" id="journey-surah">'+
      SURAH_NAMES.map(s=>'<option value="'+s.number+'"'+(s.number===v.surah?' selected':'')+'>'+s.number+' · '+esc(s.name)+'</option>').join('')+'</select></label>'+
      '<label class="field"><span>وقت تقريبي (دقيقة)</span><input class="input" name="minutes" type="number" min="5" max="180" step="5" value="'+v.minutes+'"></label>'+
      '<label class="field"><span>من الآية</span><input class="input" name="fromAyah" type="number" min="1" max="'+count+'" value="'+(v.fromAyah||1)+'"></label>'+
      '<label class="field"><span>إلى الآية</span><input class="input" name="toAyah" type="number" min="1" max="'+count+'" value="'+(v.toAyah||count)+'"></label></div>'+
      '<div class="journey-modal-tip">السورة كاملة؟ خلي البداية 1 والنهاية '+count+'. لتقسيم السورة، اختار نطاق الآيات اللي بناسبك.</div>'+
      '<label class="field"><span>ملاحظة لإلك (اختياري)</span><textarea class="textarea" name="notes" rows="2" maxlength="500" placeholder="مثلاً: ركّز على أول 5 آيات">'+esc(v.notes||'')+'</textarea></label>');
  }
  function action(action,id){
    try{
      switch(action){
        case 'journey-guide':guideOpen=!guideOpen;render();return true;
        case 'journey-open-plan':return false; // handled by simple navigation layer
        case 'journey-add':edit();return true;
        case 'journey-edit':edit(id);return true;
        case 'journey-template':{
          const count=startSuggestedPlan(d());
          if(onSave('تمت إضافة '+count.length+' أوراد إلى خطتك. فيك تعدّل أي واحدة.'))return true;
          return true;
        }
        case 'journey-remove':{
          const item=find(id);if(!item)return true;
          if(confirm('تحذف هذا الورد المخطط فقط؟ إنجازات الحفظ والمراجعة ما بتتأثر.')){
            removePlanEntry(d(),id);onSave('تم حذف الورد من الخطة فقط.');
          }return true;
        }
        case 'journey-tomorrow':{
          const item=find(id);if(!item)return true;
          if(planItemState(d(),item)==='done'){toast('الإنجاز المسجّل ما بينترحّل.');return true;}
          movePlanEntry(d(),id,addDays(todayKey(),1));onSave('رحّلنا الورد لبكرا بدون تسجيل أي إنجاز.');return true;
        }
        case 'journey-open-surah':{const item=find(id);if(item)openMushafSurah(item.surah);return true;}
        case 'journey-log':{const item=find(id);if(item){
          if(item.kind==='review')openReview([item.surah]);
          else if(item.kind==='memorize')openMemorize(item.surah);
          else openRecitation([item.surah]);
        }return true;}
      }
    }catch(error){toast(error.message);return true;}
    return false;
  }
  function submit(fd){
    if(!fd.has('journeyPlanForm'))return false;
    try{
      savePlanEntry(d(),{
        id:String(fd.get('id')||'')||undefined,
        date:String(fd.get('date')),kind:String(fd.get('kind')),
        surah:Number(fd.get('surah')),fromAyah:Number(fd.get('fromAyah')),
        toAyah:Number(fd.get('toAyah')),minutes:Number(fd.get('minutes')),
        notes:String(fd.get('notes')||'')
      });
      onSave('تم حفظ الورد في خطتك بدون تسجيل إنجاز.');
    }catch(error){toast(error.message);}
    return true;
  }
  function input(e){
    if(e.target.id!=='journey-surah')return false;
    const meta=SURAH_NAMES.find(s=>s.number===Number(e.target.value));
    if(!meta)return true;
    const modal=e.target.closest('.modal');
    const from=modal?.querySelector('[name="fromAyah"]'),to=modal?.querySelector('[name="toAyah"]');
    if(from){from.max=String(meta.ayahs);from.value='1';}
    if(to){to.max=String(meta.ayahs);to.value=String(meta.ayahs);}
    return true;
  }
  return {today,plan,action,submit,input};
}
