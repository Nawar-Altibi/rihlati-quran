// Lightweight embedded Mushaf reader. Quran text comes verbatim from Tanzil
// through quran-json.risanb.com (CC BY 3.0, attribution displayed in the UI).
import { SURAH_NAMES } from './data.js';
import { normalizeArabicSearch, locateAyah } from './quran-metadata.js';
import { MUSHAF_PAGE_COUNT, getMushafPageSegments, mushafPageFor, mushafPageVerses, validateMushafChapter, defaultMushafStart } from './mushaf-core.js';
import { createAyahTest, revealAndAdvanceAyah, moveTestCursor, toggleTestRevealAll, resetAyahTest, toggleQuizMistake, isTestAyahVisible, getAyahTestProgress } from './ayah-test.js';

import { chooseQuizPassage, recordQuizAttempt } from './quiz-core.js';
const SOURCE='https://quran-json.risanb.com/text/uthmani/chapters/';
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const chapterCache=new Map();
const inflight=new Map();
const surahOptions=(numbers,active)=>numbers.map(n=>'<option value="'+n+'"'+(n===active?' selected':'')+'>سورة '+escapeHTML(SURAH_NAMES[n-1].name)+'</option>').join('');

export function createMushafUI({getData,persist,toast,render,navigate,openReview}) {
  const last=getData().settings.mushafReading;
  const initialPage=Number.isInteger(Number(last?.page))&&Number(last.page)>=1&&Number(last.page)<=604 ? Number(last.page) : defaultMushafStart();
  let page=initialPage;
  const first=getMushafPageSegments(page)[0];
  let selectedSurah=Number(last?.surah)||first.surah, selectedAyah=Number(last?.ayah)||first.fromAyah;
  let error='',loadForPage=0,selfTest=null;

  function commitReading() {
    getData().settings.mushafReading={page,surah:selectedSurah,ayah:selectedAyah};
    persist();
  }
  function setPage(value,{surah,ayah}={}) {
    const n=Number(value);
    if(!Number.isInteger(n)||n<1||n>MUSHAF_PAGE_COUNT){toast('اختر رقم صفحة بين 1 و604.');return false;}
    page=n;
    if(selfTest)selfTest=resetAyahTest(selfTest,n);
    const segments=getMushafPageSegments(page),first=segments[0];
    selectedSurah=surah||first.surah;
    selectedAyah=ayah||first.fromAyah;
    error='';
    commitReading();
    navigate('mushaf');
    return true;
  }
  function goToSurah(surah,ayah=1){
    try {
      const target=mushafPageFor(Number(surah),Number(ayah));
      return setPage(target,{surah:Number(surah),ayah:Number(ayah)});
    } catch{ toast('تعذر العثور على السورة أو الآية.'); return false; }
  }
  function getPageMarkup() {
    if(error) return '<div class="mushaf-error" role="alert"><h3>تعذر تحميل النص القرآني</h3><p>'+escapeHTML(error)+'</p><button class="secondary" data-action="mushaf-retry">إعادة المحاولة</button></div>';
    const segments=getMushafPageSegments(page);
    if(segments.some(s=>!chapterCache.has(s.surah))) return '<div class="mushaf-loading" role="status"><span class="mushaf-loading-mark">۞</span><p>جارٍ تحميل آيات الصفحة...</p></div>';
    try {
      return mushafPageVerses(page,chapterCache).filter(group=>!selfTest?.passage || group.surah===selfTest.passage.surah).map(group=>{
        const title='<div class="mushaf-surah-heading"><span>۞</span><h3>سورة '+escapeHTML(group.name)+'</h3><small>الآيات '+group.fromAyah+'–'+group.toAyah+'</small></div>';
        const visibleGroup=selfTest?.passage ? group.verses.filter(v=>v.id>=selfTest.passage.startAyah&&v.id<=selfTest.passage.endAyah) : group.verses;
        const verses=visibleGroup.map(v=>{
          const testing=Boolean(selfTest && selfTest.page===page);
          const currentKey=selfTest?.ayahs[selfTest.currentIndex]?.key;
          const active=testing && currentKey===v.surah+':'+v.ayah;
          const selected=!testing && v.surah===selectedSurah&&v.ayah===selectedAyah;
          const visible=!testing || isTestAyahVisible(selfTest,v.surah,v.ayah);
          const content=visible
            ? '<span class="mushaf-verse-text" lang="ar" dir="rtl">'+escapeHTML(v.text)+'</span>'
            : '<span class="mushaf-masked-verse" aria-hidden="true">··· ··· ···</span><span class="mushaf-visually-hidden">نص الآية مخفي للاختبار</span>';
          return '<button type="button" class="mushaf-verse'+(selected?' selected':'')+(active?' is-testing-current':'')+(visible?'':' is-concealed')+'" data-action="mushaf-select-ayah" data-surah="'+v.surah+'" data-ayah="'+v.ayah+'" aria-label="سورة '+escapeHTML(group.name)+' الآية '+v.ayah+(visible?'':' — مخفية للاختبار')+'">' +
            content+'<span class="mushaf-verse-number" aria-hidden="true">۞'+new Intl.NumberFormat('ar').format(v.ayah)+'</span></button>';
        }).join('');
        return title+'<div class="mushaf-verses'+(selfTest?' is-test-mode':'')+'">'+verses+'</div>';
      }).join('');
    }catch(e){return '<div class="mushaf-error" role="alert">فشل التحقق من بيانات الآيات. لا يمكن عرض نص غير مكتمل.</div>';}
  }
  function view(){
    const segments=getMushafPageSegments(page);
    const start=segments[0],end=segments.at(-1);
    const juzFrom=locateAyah(start.surah,start.fromAyah).juz, juzTo=locateAyah(end.surah,end.toAyah).juz;
    const surahName=SURAH_NAMES[selectedSurah-1]?.name||start.name;
    const bookmark=getData().settings.mushafBookmark;
    const testProgress=getAyahTestProgress(selfTest);
    const quizControls=selfTest?.passage ? '<div class="mushaf-quiz-actions"><div><b>مقطع عشوائي · سورة '+escapeHTML(SURAH_NAMES[selfTest.passage.surah-1].name)+'</b><small>الآيات '+selfTest.passage.startAyah+'–'+selfTest.passage.endAyah+' · علّم المواضع التي أخطأت فيها بعد كشفها</small></div><button class="secondary" data-action="mushaf-quiz-mark"'+(!selfTest.lastRevealed?' disabled':'')+'>'+(selfTest.lastRevealed ? ((selfTest.mistakeAyahs||[]).includes(Number(selfTest.lastRevealed.split(':')[1]))?'تراجع عن خطأ الآية '+selfTest.lastRevealed.split(':')[1]:'أخطأت في الآية '+selfTest.lastRevealed.split(':')[1]) : 'اكشف آية أولًا')+'</button><button class="primary" data-action="mushaf-quiz-finish">إنهاء الاختبار وحفظ الأخطاء</button></div>' : '';
    const testControls=selfTest ? '<div class="mushaf-test-panel" aria-label="اختبار الحفظ الذاتي"><div class="mushaf-test-status" aria-live="polite"><b>اختبار الحفظ · الآية '+testProgress.position+' من '+testProgress.total+'</b><span>كشفت '+testProgress.revealed+' آية — اقرأ غيبًا قبل الكشف</span></div><div class="mushaf-test-actions"><button class="secondary" data-action="mushaf-test-prev"'+(testProgress.isFirst?' disabled':'')+'>الآية السابقة</button><button class="primary" data-action="mushaf-test-reveal"'+(isTestAyahVisible(selfTest,testProgress.current.surah,testProgress.current.ayah)?' disabled aria-label="هذه الآية مكشوفة بالفعل"':'')+'>اكشف الآية</button><button class="secondary" data-action="mushaf-test-next"'+(testProgress.isLast?' disabled':'')+'>الآية التالية</button><button class="secondary" data-action="mushaf-test-show-all">'+(selfTest.showAll?'إخفاء الكشف الكامل':'عرض جميع الآيات')+'</button><button class="secondary" data-action="mushaf-test-reset">ابدأ من جديد</button></div><small>'+(testProgress.isLast && isTestAyahVisible(selfTest,testProgress.current.surah,testProgress.current.ayah)?'أكملت كشف آيات هذه الصفحة. انتقل للصفحة التالية أو سجّل مراجعتك إذا انتهيت.':'اضغط زر «اكشف الآية» أو اضغط Enter على الآية المخفية؛ بتنفتح الآية وبيصير التركيز على التالية تلقائيًا. هذا تدريب ذاتي وليس تقييمًا آليًا.')+'</small>'+quizControls+'</div>' : '';
    return '<section class="mushaf-hero"><div><div class="simple-kicker">القرآن الكريم · رواية حفص</div><h1>المصحف</h1><p>اقرأ من حيث توقفت، واختبر حفظك، ثم سجّل المراجعة.</p></div><div class="mushaf-hero-symbol" aria-hidden="true">۞</div></section>'+
      '<section class="mushaf-toolbar" aria-label="أدوات التنقل بالمصحف">' +
      '<label class="mushaf-search"><span>ابحث عن السورة</span><input id="mushaf-surah-search" type="search" class="input" placeholder="اسم السورة أو رقمها" autocomplete="off"></label>'+
      '<label class="mushaf-surah-choice"><span>السورة</span><select id="mushaf-surah-select" class="select" aria-label="انتقل إلى سورة">'+surahOptions(SURAH_NAMES.map(s=>s.number),selectedSurah)+'</select></label>'+
      '<label class="mushaf-ayah-choice"><span>الآية</span><input id="mushaf-ayah-jump" type="number" class="input" min="1" max="'+SURAH_NAMES[selectedSurah-1].ayahs+'" value="'+selectedAyah+'"></label>'+
      '<button class="secondary mushaf-go" data-action="mushaf-go-ayah">اذهب للآية</button></section>'+
      '<div class="mushaf-shell"><div class="mushaf-reader">' +
      '<div class="mushaf-page-controls"><button class="secondary" data-action="mushaf-prev"'+(page===1?' disabled':'')+'>الصفحة السابقة</button>'+
      '<div class="mushaf-page-jump"><span>صفحة</span><input id="mushaf-page-number" class="input" type="number" min="1" max="604" value="'+page+'" aria-label="رقم الصفحة"/><span>من ٦٠٤</span><button class="secondary small-btn" data-action="mushaf-go-page">انتقال</button></div>'+
      '<button class="secondary" data-action="mushaf-next"'+(page===MUSHAF_PAGE_COUNT?' disabled':'')+'>الصفحة التالية</button></div>'+
      '<div class="mushaf-mode-bar"><button class="'+(selfTest?'secondary':'primary')+'" data-action="mushaf-toggle-test">'+(selfTest?'إنهاء وضع الاختبار والعودة للقراءة':'◉ ابدأ اختبار الحفظ')+'</button><span>'+(selfTest?'الآيات مخفية حتى تكشفها بنفسك':'اقرأ الصفحة أو اختبر نفسك بإخفاء الآيات')+'</span></div>'+testControls+
      '<div class="mushaf-paper" dir="rtl"><div class="mushaf-page-top"><span>الجزء '+juzFrom+(juzTo!==juzFrom?'–'+juzTo:'')+'</span><span>صفحة '+new Intl.NumberFormat('ar').format(page)+'</span></div>'+
      '<div id="mushaf-page-body">'+getPageMarkup()+'</div>'+
      '<div class="mushaf-page-foot"><span>مصحف المدينة ٦٠٤ صفحات · ترتيب آيات حفص</span><span>'+new Intl.NumberFormat('ar').format(page)+'</span></div></div>'+
      '<div class="mushaf-bottom-controls"><button class="secondary" data-action="mushaf-prev"'+(page===1?' disabled':'')+'>السابق</button><button class="secondary" data-action="mushaf-next"'+(page===604?' disabled':'')+'>التالي</button></div></div>'+
      '<aside class="mushaf-side"><div class="mushaf-side-card"><div class="simple-kicker">موضعك الحالي</div><h2>سورة '+escapeHTML(surahName)+'</h2><p>الآية '+new Intl.NumberFormat('ar').format(selectedAyah)+' · صفحة '+new Intl.NumberFormat('ar').format(page)+'</p>'+
      '<div class="mushaf-quiz-launch"><b>اختبر حفظك</b><p>مقاطع من السور التي سجّلت حفظها أو مراجعتها، وليس من الأجزاء المسجلة بشكل عام.</p><button class="secondary" data-action="mushaf-quiz-random">اختبار عشوائي</button><button class="secondary" data-action="mushaf-quiz-weak">مواضع تحتاج تثبيت</button><button class="secondary" data-action="mushaf-quiz-due">مراجعات مستحقة</button></div>'+
      '<button class="primary mushaf-review-button" data-action="mushaf-record-review">✓ أنهيت المراجعة — سجّلها</button>'+
      '<button class="secondary mushaf-bookmark-button" data-action="mushaf-save-bookmark">حفظ علامة عند هذه الآية</button>'+
      (bookmark?'<button class="secondary mushaf-bookmark-button" data-action="mushaf-go-bookmark">العودة للعلامة المحفوظة</button>':'')+
      '</div><div class="mushaf-side-card"><h3>كيف أستخدم المصحف؟</h3><p>اضغط على أي آية لتحديد موضعك. يمكنك الانتقال لسورة أو رقم صفحة ثم تسجيل المراجعة فقط بعد إتمامها فعلًا.</p><p class="mushaf-note">يُعرض النص آية آية ضمن حدود صفحات مصحف المدينة؛ هذا ليس تصويرًا مطابقًا لتوزيع الأسطر والخط في المصحف الورقي.</p></div></aside></div>'+
      '<footer class="mushaf-attribution">النص القرآني بالرسم العثماني من <a href="https://tanzil.net" target="_blank" rel="noopener noreferrer">مشروع تنزيل (Tanzil)</a> · ترخيص CC BY 3.0، ويُعرض دون تعديل للنص. توزيع الصفحات من فهرس حفص لمصحف المدينة. تحميل النص من <a href="https://quran-json.risanb.com" target="_blank" rel="noopener noreferrer">Quran JSON</a>. <a href="https://tanzil.net/docs/Text_License" target="_blank" rel="noopener noreferrer">شروط استخدام النص</a>.</footer>';
  }
  async function fetchChapter(surah) {
    if(chapterCache.has(surah)) return chapterCache.get(surah);
    if(inflight.has(surah)) return inflight.get(surah);
    const task=(async()=>{
      const response=await fetch(SOURCE+surah+'.json',{mode:'cors'});
      if(!response.ok)throw new Error('تعذر تحميل سورة '+SURAH_NAMES[surah-1].name+' (HTTP '+response.status+').');
      const chapter=await response.json();
      validateMushafChapter(chapter,surah);
      chapterCache.set(surah,chapter);
      return chapter;
    })();
    inflight.set(surah,task);
    try{return await task;}finally{inflight.delete(surah);}
  }
  function afterRender(){
    const n=++loadForPage;
    const chapters=getMushafPageSegments(page).filter(s=>!chapterCache.has(s.surah)).map(s=>s.surah);
    if(!chapters.length || error) return;
    Promise.all(chapters.map(fetchChapter)).then(()=>{
      if(n===loadForPage && document.querySelector('#mushaf-page-body')) render();
    }).catch(e=>{
      if(n===loadForPage && document.querySelector('#mushaf-page-body')) {error=e?.message||'تحقق من اتصال الإنترنت.';render();}
    });
  }
  // Restore keyboard focus after rendering replaces the verse buttons.
  // This lets a reader keep pressing Enter without returning to the mouse.
  function focusActiveTestAyah() {
    const active=document.querySelector('#mushaf-page-body .mushaf-verse.is-testing-current');
    if(!active)return;
    active.focus({preventScroll:true});
    active.scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  function startRandomQuiz(mode='random') {
    const passage=chooseQuizPassage(getData(),{mode});
    if(!passage){
      toast(mode==='weak'?'مافي أخطاء آيات أو تقييمات ضعيفة مسجلة بعد.':'مافي مقاطع موثّقة لهذا النوع من الاختبارات. سجّل مراجعة سورة أو حفظ آيات فعلًا أولًا.');
      return false;
    }
    page=passage.page;selfTest=createAyahTest(page,passage);
    const first=selfTest.ayahs[0];
    selectedSurah=first.surah;selectedAyah=first.ayah;
    error='';commitReading();navigate('mushaf');
    if(document.querySelector('#mushaf-page-body .mushaf-verse.is-testing-current'))focusActiveTestAyah();
    return true;
  }

  function handleAction(action,target) {
    switch(action) {
      case 'mushaf-prev':setPage(page-1);return true;
      case 'mushaf-next':setPage(page+1);return true;
      case 'mushaf-go-page':setPage(Number(document.querySelector('#mushaf-page-number')?.value));return true;
      case 'mushaf-go-ayah':goToSurah(Number(document.querySelector('#mushaf-surah-select')?.value),Number(document.querySelector('#mushaf-ayah-jump')?.value));return true;
      case 'mushaf-quiz-random':startRandomQuiz('random');return true;
      case 'mushaf-quiz-weak':startRandomQuiz('weak');return true;
      case 'mushaf-quiz-due':startRandomQuiz('due');return true;
      case 'mushaf-quiz-mark':
        if(selfTest?.passage){selfTest=toggleQuizMistake(selfTest);render();focusActiveTestAyah();}
        return true;
      case 'mushaf-quiz-finish':
        if(selfTest?.passage){
          if(selfTest.revealed.length<selfTest.ayahs.length){
            toast('اكشف آيات المقطع واحدة واحدة قبل حفظ نتيجة الاختبار.');
          }else{
            const result=recordQuizAttempt(getData(),selfTest.passage,selfTest.mistakeAyahs||[]);
            if(persist()){
              selfTest=null;render();
              toast('حُفظ الاختبار. مواضع تحتاج تثبيت: '+result.mistakeAyahs.length+' — ستكون لها أولوية في الاختبارات المقبلة.');
            }
          }
        }
        return true;
      case 'mushaf-toggle-test':selfTest=selfTest?null:createAyahTest(page);render();return true;
      case 'mushaf-test-reveal':
        if(selfTest){
          selfTest=revealAndAdvanceAyah(selfTest);
          const current=selfTest.ayahs[selfTest.currentIndex];
          selectedSurah=current.surah;selectedAyah=current.ayah;
          commitReading();render();
          focusActiveTestAyah();
        }
        return true;
      case 'mushaf-test-prev':
      case 'mushaf-test-next':
        if(selfTest){
          selfTest=moveTestCursor(selfTest,action==='mushaf-test-next'?1:-1);
          const current=selfTest.ayahs[selfTest.currentIndex];
          selectedSurah=current.surah;selectedAyah=current.ayah;commitReading();render();focusActiveTestAyah();
        }
        return true;
      case 'mushaf-test-show-all':
        if(selfTest){selfTest=toggleTestRevealAll(selfTest);render();}
        return true;
      case 'mushaf-test-reset':
        if(selfTest){selfTest=resetAyahTest(selfTest);const current=selfTest.ayahs[0];selectedSurah=current.surah;selectedAyah=current.ayah;commitReading();render();focusActiveTestAyah();}
        return true;
      case 'mushaf-select-ayah':{
        const s=Number(target.dataset.surah), a=Number(target.dataset.ayah);
        if(selfTest){
          const index=selfTest.ayahs.findIndex(v=>v.surah===s&&v.ayah===a);
          if(index!==-1)selfTest={...selfTest,currentIndex:index,showAll:false};
          selectedSurah=s;selectedAyah=a;commitReading();render();focusActiveTestAyah();return true;
        }
        selectedSurah=s;selectedAyah=a;commitReading();
        document.querySelectorAll('.mushaf-verse.selected').forEach(v=>v.classList.remove('selected'));
        target.classList.add('selected');
        // Update only side details to avoid scroll jumps while reading.
        const side=document.querySelector('.mushaf-side-card');
        if(side){side.querySelector('h2').textContent='سورة '+SURAH_NAMES[s-1].name;side.querySelector('p').textContent='الآية '+new Intl.NumberFormat('ar').format(a)+' · صفحة '+new Intl.NumberFormat('ar').format(page);}
        const sel=document.querySelector('#mushaf-surah-select');if(sel)sel.value=String(s);
        const jump=document.querySelector('#mushaf-ayah-jump');if(jump){jump.value=String(a);jump.max=SURAH_NAMES[s-1].ayahs;}
        return true;
      }
      case 'mushaf-record-review':openReview([selectedSurah]);return true;
      case 'mushaf-save-bookmark':
        getData().settings.mushafBookmark={page,surah:selectedSurah,ayah:selectedAyah};
        if(persist())toast('حُفظت العلامة عند سورة '+SURAH_NAMES[selectedSurah-1].name+'، الآية '+selectedAyah);
        render();return true;
      case 'mushaf-go-bookmark':{
        const b=getData().settings.mushafBookmark;
        if(b)goToSurah(b.surah,b.ayah);
        return true;
      }
      case 'mushaf-retry':error='';render();return true;
    }
    return false;
  }
  function handleChange(e){
    if(e.target.id==='mushaf-surah-select') {const n=Number(e.target.value);if(n)goToSurah(n);return true;}
    return false;
  }
  function handleInput(e){
    if(e.target.id!=='mushaf-surah-search')return false;
    const q=normalizeArabicSearch(e.target.value);
    const matches=SURAH_NAMES.filter(s=>normalizeArabicSearch(s.name).includes(q)||String(s.number).includes(q));
    const select=document.querySelector('#mushaf-surah-select');
    if(!select)return true;
    const original=selectedSurah;
    select.innerHTML='<option value="" disabled'+(matches.some(s=>s.number===original)?'':' selected')+'>'+(matches.length?'اختر من النتائج':'لا توجد نتائج')+'</option>'+surahOptions(matches.map(s=>s.number),original);
    if(matches.some(s=>s.number===original))select.value=String(original);
    return true;
  }
  function handleKeydown(e){
    if(e.key!=='Enter')return false;
    if(e.repeat && selfTest && e.target.closest?.('#mushaf-page-body .mushaf-verse')){
      e.preventDefault(); // Holding Enter must not skip multiple hidden verses.
      return true;
    }
    if(e.repeat)return false;

    // When an unrevealed Quran Ayah has keyboard focus, Enter behaves exactly
    // like pressing "اكشف الآية". Stop the button's synthesized click so the
    // next Ayah is not accidentally selected or skipped a second time.
    const verse=e.target.closest?.('#mushaf-page-body .mushaf-verse[data-action="mushaf-select-ayah"]');
    if(selfTest && verse){
      const surah=Number(verse.dataset.surah),ayah=Number(verse.dataset.ayah);
      const index=selfTest.ayahs.findIndex(v=>v.surah===surah&&v.ayah===ayah);
      if(index>=0 && !isTestAyahVisible(selfTest,surah,ayah)){
        e.preventDefault();
        selfTest={...selfTest,currentIndex:index,showAll:false};
        handleAction('mushaf-test-reveal',verse);
        return true;
      }
      // Already-revealed verses retain their normal button keyboard behavior.
      return false;
    }

    // Existing Enter shortcuts for page and Ayah number fields still work.
    if(!['mushaf-page-number','mushaf-ayah-jump'].includes(e.target.id))return false;
    e.preventDefault();
    if(e.target.id==='mushaf-page-number')setPage(Number(e.target.value));
    else goToSurah(Number(document.querySelector('#mushaf-surah-select')?.value),Number(e.target.value));
    return true;
  }
  return {view,afterRender,handleAction,handleChange,handleInput,handleKeydown,goToSurah,startRandomQuiz,open:()=>navigate('mushaf'),getPage:()=>page};
}
