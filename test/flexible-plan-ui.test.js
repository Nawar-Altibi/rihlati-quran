import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInitialData } from '../src/data.js';
import { todayKey,addDays } from '../src/logic.js';
import { createFlexiblePlanUI } from '../src/flexible-plan-ui.js';
import { startSuggestedPlan,savePlanEntry } from '../src/flexible-plan.js';

function setup(){
  const d=makeInitialData();
  const messages=[],modals=[];
  let latest='',ui;
  const render=()=>{latest=ui.today();};
  ui=createFlexiblePlanUI({
    getData:()=>d,persist:()=>true,render,toast:msg=>messages.push(msg),
    openModal:(title,html)=>modals.push({title,html}),
    openReview:()=>{},openMemorize:()=>{},openRecitation:()=>{},
    openMushafSurah:()=>{}
  });
  return {d,ui,messages,modals,render,get latest(){return latest;}};
}
test('fresh user sees an optional 30-minute today starter without auto-writing progress',()=>{
  const {d,ui}=setup();
  const html=ui.today();
  assert.match(html,/خطة اليوم المرنة/);
  assert.match(html,/اعتمد الخطة المبدئية/);
  assert.match(html,/النبأ والنازعات وعبس/);
  assert.equal(d.activities.length,0);
  assert.equal(d.studyPlan.length,0);
});
test('after optional starter, today shows 3 tasks and tomorrow has al-Takwir',()=>{
  const {d,ui}=setup();
  startSuggestedPlan(d);
  const html=ui.today();
  assert.match(html,/3<\/b> مهام مخططة/);
  for(const surah of ['النبأ','النازعات','عبس'])assert.match(html,new RegExp('سورة '+surah));
  assert.match(ui.plan(),/التكوير/);
  assert.equal(d.studyPlan.filter(x=>x.date===todayKey()).length,3);
  assert.equal(d.studyPlan.filter(x=>x.date===addDays(todayKey(),1)).length,1);
  assert.equal(d.activities.length,0);
  assert.equal(d.revisions.length,0);
});
test('planner accepts outside-stage Surah and exposes edit/reschedule controls',()=>{
  const {d,ui}=setup();
  savePlanEntry(d,{date:todayKey(),surah:36,kind:'memorize',minutes:20,fromAyah:1,toAyah:8},()=> 'memorize-36');
  const html=ui.today();
  assert.match(html,/سورة يس/);
  assert.match(html,/الآيات 1–8/);
  assert.match(html,/data-action="journey-edit"/);
  assert.match(html,/data-action="journey-tomorrow"/);
  assert.match(html,/data-action="journey-log"/);
});
test('guide is real interactive inline guidance with three illustrations',()=>{
  const {ui}=setup();
  let count=0;const prevDoc=globalThis.document;
  globalThis.document={querySelector:()=>({innerHTML:''})};
  try{
    // For guide action render() calls only ui.today(), not storage.
    const originalHTML=ui.today();
    assert.doesNotMatch(originalHTML,/journey-guide-grid/);
    const firstAction=ui.action('journey-guide','');
    assert.equal(firstAction,true);
    // test via second render from UI state
    const guideHTML=ui.today();
    assert.match(guideHTML,/journey-guide-grid/);
    assert.match(guideHTML,/١. حضّر وردك/);
    assert.match(guideHTML,/٢. راجع واختبر نفسك/);
    assert.match(guideHTML,/٣. سجّل إنجازك الفعلي/);
  }finally{globalThis.document=prevDoc;}
});
test('editing an actual planned ayah range pre-fills a form rather than full Surah',()=>{
  const {d,ui,modals}=setup();
  savePlanEntry(d,{date:todayKey(),surah:36,kind:'memorize',minutes:20,fromAyah:1,toAyah:8},()=> 'a');
  ui.action('journey-edit','a');
  const fields=modals.at(-1);
  assert.equal(fields.title,'تعديل الورد');
  assert.match(fields.html,/name="toAyah"[^>]*value="8"/);
  assert.match(fields.html,/option value="36" selected/);
  assert.match(fields.html,/id="journey-surah-search"/);
});
