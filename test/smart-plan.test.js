import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeNewUserData} from '../src/data.js';
import {savePlanEntry,planItemState,completedEvidence} from '../src/flexible-plan.js';
import {smartPlanSuggestions,applySmartSuggestion} from '../src/smart-plan.js';

const TODAY='2026-11-08'; // Sunday
const fresh=()=>makeNewUserData({stage:'amma',dailyMinutes:20});
let nextId=0;const id=()=>'test-'+(++nextId);

test('planning preview is pure and uses preferred weekdays without fabricating completion',()=>{
  const d=fresh();
  d.settings.revisionDays=[0,2,4];
  const missed=savePlanEntry(d,{date:'2026-11-06',surah:78,kind:'review',minutes:15},id);
  const before=structuredClone(d);
  const suggestions=smartPlanSuggestions(d,{today:TODAY});
  assert.equal(suggestions.length,1);
  assert.deepEqual(suggestions[0],{
    id:'carry:'+missed.id,action:'carry',sourceId:missed.id,
    expectedDate:'2026-11-06',date:'2026-11-08',kind:'review',
    surah:78,minutes:15,
    reason:'الورد فات موعده ولم يُسجل إنجازه. نقترح ترحيله ليوم مناسب دون تغيير الحفظ.'
  });
  assert.deepEqual(d,before);
  assert.equal(planItemState(d,missed,TODAY),'missed');
});
test('only confirmed action moves a missed item, never changes achievements',()=>{
  const d=fresh(),missed=savePlanEntry(d,{date:'2026-11-06',surah:80,kind:'review',minutes:15},id);
  d.units.push({id:'u80',surah:80,lastRating:'ضعيف'});
  d.activities.push({id:'real',date:'2026-11-06',completed:true,type:'memorization',unitId:'some-other'});
  const proof=structuredClone({activities:d.activities,units:d.units,revisions:d.revisions,sessions:d.sessions});
  const p=smartPlanSuggestions(d,{today:TODAY})[0];
  assert.match(p.reason,/ضعيف/);
  applySmartSuggestion(d,p,{today:TODAY});
  assert.equal(missed.date,TODAY);
  assert.equal(planItemState(d,missed,TODAY),'today');
  assert.equal(missed.status,'planned');
  assert.deepEqual({activities:d.activities,units:d.units,revisions:d.revisions,sessions:d.sessions},proof);
  assert.equal(completedEvidence(d,missed),false);
  assert.equal(smartPlanSuggestions(d,{today:TODAY}).some(x=>x.id===p.id),false);
});
test('daily capacity and independent review weekdays move suggestions to an available day',()=>{
  const d=fresh();d.settings.dailyMinutes=20;d.settings.revisionDays=[1,2];
  savePlanEntry(d,{date:'2026-11-09',surah:79,kind:'review',minutes:20},id);
  const missed=savePlanEntry(d,{date:'2026-11-06',surah:80,kind:'review',minutes:15},id);
  const s=smartPlanSuggestions(d,{today:TODAY}).find(x=>x.sourceId===missed.id);
  assert.equal(s.date,'2026-11-10'); // Tuesday because Monday full
});
test('review suggestions require real due revision and match exact recorded ayah range',()=>{
  const d=fresh();d.settings.revisionDays=[0,1,2];
  d.units.push({id:'recorded-unit',surah:78,method:'ayah',startAyah:2,endAyah:9,lastRating:'يحتاج مراجعة'});
  d.revisions.push({id:'rev1',unitId:'recorded-unit',dueDate:'2026-11-07',done:false});
  const before=structuredClone(d);
  const [p]=smartPlanSuggestions(d,{today:TODAY});
  assert.equal(p.id,'due:rev1');
  assert.equal(p.fromAyah,2);assert.equal(p.toAyah,9);
  assert.equal(p.date,TODAY);assert.match(p.reason,/يحتاج مراجعة/);
  assert.deepEqual(d,before);
  applySmartSuggestion(d,p,{today:TODAY,id});
  assert.equal(d.studyPlan.length,1);
  assert.deepEqual([d.studyPlan[0].fromAyah,d.studyPlan[0].toAyah],[2,9]);
  assert.equal(d.studyPlan[0].status,'planned');
  assert.equal(d.activities.length,0);
  assert.equal(d.revisions[0].done,false);
  assert.equal(smartPlanSuggestions(d,{today:TODAY}).length,0);
});
test('no review is inferred from onboarding self-reported memorization or legacy records',()=>{
  const d=fresh();
  d.settings.onboardingProfile={knownSurahs:[{surah:78,fromAyah:1,toAyah:40}]};
  d.revisions.push({id:'unlinked',unitId:'not-existing',dueDate:'2026-11-07',done:false});
  assert.deepEqual(smartPlanSuggestions(d,{today:TODAY}),[]);
});
test('existing planned review and completed work are never duplicated or moved',()=>{
  const d=fresh();
  d.units.push({id:'u78',surah:78,method:'surah'});
  d.revisions.push({id:'due',unitId:'u78',dueDate:'2026-11-07',done:false});
  savePlanEntry(d,{date:'2026-11-11',surah:78,kind:'review',minutes:10},id);
  const complete=savePlanEntry(d,{date:'2026-11-06',surah:79,kind:'review',minutes:10},id);
  d.units.push({id:'u79',surah:79});
  d.activities.push({id:'verified',type:'revision',date:'2026-11-06',unitId:'u79',completed:true});
  assert.equal(planItemState(d,complete,TODAY),'done');
  assert.deepEqual(smartPlanSuggestions(d,{today:TODAY}),[]);
});
test('stale proposals and invalid inputs refuse to rewrite existing state',()=>{
  const d=fresh();
  const missed=savePlanEntry(d,{date:'2026-11-06',surah:78,kind:'review',minutes:15},id);
  const p=smartPlanSuggestions(d,{today:TODAY})[0];
  const invalid={...p,date:'2026-11-13'};
  assert.throws(()=>applySmartSuggestion(d,invalid,{today:TODAY}),/تغيّرت/);
  const swapped={...p,surah:79};
  assert.throws(()=>applySmartSuggestion(d,swapped,{today:TODAY}),/تغيّرت/);
  missed.date='2026-11-10';
  const snapshot=structuredClone(d);
  assert.throws(()=>applySmartSuggestion(d,p,{today:TODAY}),/تغيّرت/);
  assert.deepEqual(d,snapshot);
  assert.throws(()=>smartPlanSuggestions(d,{today:'2026-02-31'}),/تاريخ/);
});
test('smart planning UI exposes explicit confirmations and keeps syncing via existing persist',()=>{
  const ui=readFileSync(new URL('../src/flexible-plan-ui.js',import.meta.url),'utf8');
  assert.match(ui,/function smartPanel\(\)/);
  assert.match(ui,/journey-smart-toggle/);
  assert.match(ui,/journey-smart-apply/);
  assert.match(ui,/if\(!confirm\(/);
  assert.match(ui,/applySmartSuggestion\(d\(\),proposal\)/);
  assert.match(ui,/if\(!onSave\(/);
  assert.match(ui,/d\(\)\.studyPlan=backup/);
  assert.match(ui,/smartPanel\(\)/);
});
