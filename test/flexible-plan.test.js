import test from 'node:test';
import assert from 'node:assert/strict';
import {makeInitialData,DEFAULT_SETTINGS} from '../src/data.js';
import {migrateData} from '../src/storage.js';
import {
  planEntries,savePlanEntry,movePlanEntry,removePlanEntry,startSuggestedPlan,
  completedEvidence,planItemState,dailyPlanStats
} from '../src/flexible-plan.js';

const ids=()=>{let n=0;return ()=>'plan-'+(++n);};
const base=()=>makeInitialData();

test('initial suggestion starts tomorrow with intended reviews and no fabricated achievements',()=>{
  const data=base(),actualBefore={activities:data.activities.length,sessions:data.sessions.length,revisions:data.revisions.length};
  const items=startSuggestedPlan(data,'2026-11-07',ids());
  assert.deepEqual(items.map(x=>[x.date,x.surah,x.kind]),[
    ['2026-11-07',78,'review'],['2026-11-07',79,'review'],['2026-11-07',80,'review'],['2026-11-08',81,'review']
  ]);
  assert.equal(data.activities.length,actualBefore.activities);
  assert.equal(data.sessions.length,actualBefore.sessions);
  assert.equal(data.revisions.length,actualBefore.revisions);
  assert.equal(items.every(x=>x.status==='planned'),true);
  assert.equal(items.every(x=>!completedEvidence(data,x)),true);
  assert.equal(data.studyPlan.length,4);
});
test('a missed day stays uncompleted until real evidence is recorded',()=>{
  const d=base();
  const item=savePlanEntry(d,{date:'2026-11-06',surah:78,kind:'review',minutes:15},ids());
  assert.equal(planItemState(d,item,'2026-11-07'),'missed');
  assert.equal(d.activities.length,0);
  assert.equal(dailyPlanStats(d,'2026-11-07').missed,1);
  movePlanEntry(d,item.id,'2026-11-08');
  assert.equal(item.date,'2026-11-08');
  assert.equal(dailyPlanStats(d,'2026-11-07').missed,0);
  assert.equal(planItemState(d,item,'2026-11-07'),'upcoming');
});
test('study plan allows any Surah without changing fixed phases or claiming completion',()=>{
  const d=base(),old=structuredClone(d.settings.phases);
  const item=savePlanEntry(d,{date:'2026-11-09',surah:36,kind:'memorize',minutes:20,fromAyah:1,toAyah:8},ids());
  assert.equal(item.surah,36);
  assert.equal(item.toAyah,8);
  assert.deepEqual(d.settings.phases,old);
  assert.equal(d.units.some(x=>x.surah===36),false);
});
test('calendar dates can be edited, entries can be removed without touching Quran history',()=>{
  const d=base(),activityId='real-activity';
  d.activities.push({id:activityId,completed:true,date:'2026-11-07',type:'revision'});
  const item=savePlanEntry(d,{date:'2026-11-07',surah:80,kind:'review',minutes:20},ids());
  const edited=savePlanEntry(d,{...item,date:'2026-11-10',minutes:30,id:item.id});
  assert.equal(edited.minutes,30);
  assert.equal(edited.date,'2026-11-10');
  assert.equal(planEntries(d).length,1);
  removePlanEntry(d,item.id);
  assert.equal(planEntries(d).length,0);
  assert.equal(d.activities[0].id,activityId);
});
test('actual completed Surah review confirms only matching planned date and Surah',()=>{
  const d=base();
  const item=savePlanEntry(d,{date:'2026-11-07',surah:78,kind:'review',minutes:20},ids());
  const unit={id:'confirmed-surat',surah:78,method:'surah'};
  d.units.push(unit);
  d.activities.push({id:'r1',completed:true,date:'2026-11-06',type:'revision',unitId:unit.id});
  assert.equal(completedEvidence(d,item),false);
  d.activities.push({id:'r2',completed:true,date:'2026-11-07',type:'revision',unitId:unit.id});
  assert.equal(completedEvidence(d,item),true);
  assert.equal(planItemState(d,item,'2026-11-08'),'done');
});
test('invalid or duplicated plan records do not overwrite another plan',()=>{
  const d=base();
  const entry={date:'2026-11-07',surah:78,kind:'review',minutes:20};
  savePlanEntry(d,entry,ids());
  assert.throws(()=>savePlanEntry(d,entry,ids()),/مسجّل/);
  assert.throws(()=>savePlanEntry(d,{...entry,surah:999},ids()),/سورة/);
  assert.throws(()=>savePlanEntry(d,{...entry,date:'2026-02-31'},ids()),/صحيح/);
  assert.throws(()=>savePlanEntry(d,{...entry,minutes:0},ids()),/مدة/);
  assert.throws(()=>movePlanEntry(d,'no-id','2026-11-08'),/مو موجود/);
});
test('migration leaves existing Quran memorization intact and adds empty optional plan',()=>{
  const d=base();delete d.studyPlan;
  d.activities.push({id:'review-1',date:'2026-11-05',completed:true,type:'revision'});
  const restored=migrateData(d,DEFAULT_SETTINGS);
  assert.deepEqual(restored.studyPlan,[]);
  assert.equal(restored.activities[0].id,'review-1');
  assert.equal(restored.units.length,2);
  assert.equal(restored.version,2);
});
test('changing simple plan never marks seed Juz 29 or 30 as memorized',()=>{
  const d=base();startSuggestedPlan(d,'2026-11-07',ids());
  assert.equal(d.units.filter(u=>u.legacy).length,2);
  assert.equal(d.units.some(u=>Number(u.surah)>0),false);
  assert.equal(d.revisions.length,0);
});
