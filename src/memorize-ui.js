import { SURAH_NAMES } from './data.js';
import { todayKey } from './logic.js';
import { describeAyahRange, normalizeArabicSearch } from './quran-metadata.js';
import { recordSimpleMemorization } from './memorization.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options = (list, selected) => list.map(s=>'<option value="'+s.number+'" '+(s.number===selected?'selected':'')+'>سورة '+esc(s.name)+' ('+s.number+')</option>').join('');
const verses = (n, selected) => Array.from({length:n},(_,i)=>'<option value="'+(i+1)+'" '+(i+1===selected?'selected':'')+'>'+(i+1)+'</option>').join('');

export function createMemorizeUI({getData,persist,toast,openModal,render}) {
  const el = s => document.querySelector('#modal-root '+s);
  function refreshSummary() {
    const form=el('.modal');
    if(!form?.elements.simpleMemorization)return;
    const surah=Number(form.elements.surah.value), details=SURAH_NAMES[surah-1], box=el('#simple-auto-summary');
    if(!details) {box.textContent='اختار سورة من القائمة لعرض تفاصيلها تلقائيًا.';return;}
    const scope=form.elements.scope.value, fields=el('#simple-ayah-fields');
    fields.classList.toggle('hidden',scope!=='range');
    const from=scope==='full'?1:Number(form.elements.fromAyah.value);
    const to=scope==='full'?details.ayahs:Number(form.elements.toAyah.value);
    try{
      const m=describeAyahRange(surah,from,to);
      const juz=m.juz?'الجزء '+m.juz:'من الجزء '+m.juzStart+' إلى الجزء '+m.juzEnd;
      box.innerHTML='<h3>✓ تم تحديد التفاصيل تلقائيًا</h3>'+
        '<div><span>الجزء</span><b>'+juz+'</b></div>'+
        '<div><span>الآيات</span><b>'+m.fromAyah+'–'+m.toAyah+' ('+m.ayahCount+' آية)</b></div>'+
        '<div><span>صفحات المصحف</span><b>'+m.pageStart+(m.pageEnd===m.pageStart?'':'–'+m.pageEnd)+' ('+m.touchedPages+' صفحات)</b></div>'+
        '<div><span>مقدار الحفظ التقريبي</span><b>نحو '+m.approximatePages+' صفحة</b></div>';
    }catch(err){box.textContent=err.message;}
  }
  function updateVerseChoices() {
    const s=Number(el('#simple-mem-surah')?.value), meta=SURAH_NAMES[s-1];
    const from=el('#simple-from-ayah'), to=el('#simple-to-ayah');
    if(!meta){refreshSummary();return;}
    const a=Math.min(Math.max(1,Number(from.value)||1),meta.ayahs);
    const b=Math.min(Math.max(1,Number(to.value)||meta.ayahs),meta.ayahs);
    from.innerHTML=verses(meta.ayahs,a);
    to.innerHTML=verses(meta.ayahs,b);
    refreshSummary();
  }
  function open() {
    const stage=getData().settings.simpleStage||'amma';
    const initial=stage==='tabarak'?67:stage==='qad'?58:stage==='baqarah'?2:78;
    const count=SURAH_NAMES[initial-1].ayahs;
    openModal('سجّل حفظك الجديد','<input type="hidden" name="simpleMemorization" value="1">'+
      '<div class="simple-modal-intro">اختار السورة والآيات فقط. البرنامج يحدد الجزء والصفحات تلقائيًا. إذا كنت تثبّت محفوظًا قديمًا، استخدم زر «راجعت».</div>'+
      '<label class="field"><span>تاريخ الحفظ</span><input class="input" type="date" name="date" value="'+todayKey()+'" max="'+todayKey()+'" required></label>'+
      '<label class="field"><span>ابحث عن سورة بالاسم أو الرقم</span><input class="input" type="search" id="simple-mem-search" autocomplete="off" placeholder="مثال: المجادلة أو 58"></label>'+
      '<label class="field"><span>أو اختر السورة يدويًا من القائمة</span><select class="select" id="simple-mem-surah" name="surah" required>'+options(SURAH_NAMES,initial)+'</select></label>'+
      '<div class="field"><span>ماذا حفظت؟</span><div class="simple-scope-row"><label><input type="radio" name="scope" value="full" checked> السورة كاملة</label><label><input type="radio" name="scope" value="range"> نطاق آيات</label></div></div>'+
      '<div class="simple-ayah-range hidden" id="simple-ayah-fields"><label class="field"><span>من الآية</span><select class="select" name="fromAyah" id="simple-from-ayah">'+verses(count,1)+'</select></label><label class="field"><span>إلى الآية</span><select class="select" name="toAyah" id="simple-to-ayah">'+verses(count,count)+'</select></label></div>'+
      '<div class="simple-auto-summary" id="simple-auto-summary" aria-live="polite"></div>'+
      '<label class="field"><span>ملاحظة (اختياري)</span><textarea class="textarea" name="note" rows="2"></textarea></label>'+
      '<div class="simple-modal-hint">بيانات مصحف المدينة 604 صفحة (حفص). نطاق الصفحات دقيق، أما مقدار الحفظ فهو تقدير تقريبي بناءً على توزيع الآيات.</div>');
    refreshSummary();
  }
  function onInput(e) {
    const target=e.target;
    if(target.id==='simple-mem-search'){
      const q=normalizeArabicSearch(target.value);
      const matches=SURAH_NAMES.filter(s=>normalizeArabicSearch(s.name).includes(q)||String(s.number).includes(q));
      const select=el('#simple-mem-surah'),old=Number(select?.value);
      if(!select)return false;
      const chosen=matches.some(s=>s.number===old)?old:(matches.length===1?matches[0].number:null);
      select.innerHTML='<option value="" disabled '+(chosen?'':'selected')+'>'+(matches.length?'اختر السورة من '+matches.length+' نتيجة':'لا توجد سور مطابقة')+'</option>'+options(matches,chosen);
      if(chosen)select.value=String(chosen);
      updateVerseChoices();
      return true;
    }
    if(target.id==='simple-mem-surah'){updateVerseChoices();return true;}
    if(['simple-from-ayah','simple-to-ayah'].includes(target.id)||target.name==='scope'){refreshSummary();return true;}
    return false;
  }
  function submit(fd) {
    if(!fd.has('simpleMemorization'))return false;
    try {
      const no=Number(fd.get('surah')),scope=String(fd.get('scope'));
      const m=describeAyahRange(no,scope==='range'?Number(fd.get('fromAyah')):1,scope==='range'?Number(fd.get('toAyah')):undefined);
      const unit=recordSimpleMemorization(getData(),{surah:no,fromAyah:m.fromAyah,toAyah:m.toAyah,date:String(fd.get('date')),note:String(fd.get('note')||'')});
      if(!persist())return true;
      document.querySelector('#modal-root').innerHTML='';render();
      toast('سُجّل الحفظ: '+unit.title+'، وتم حساب الجزء والصفحات تلقائيًا.');
    } catch(err){toast(err.message);}
    return true;
  }
  return {open,onInput,submit};
}
