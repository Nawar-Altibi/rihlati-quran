import test from 'node:test';
import assert from 'node:assert/strict';
import { SURAH_NAMES, makeInitialData } from '../src/data.js';
import { todayKey } from '../src/logic.js';
import { mushafPageFor } from '../src/mushaf-core.js';
import { chooseQuizPassage, trackedQuizSurahs, buildQuizSpans, recordQuizAttempt, quizSummary, getQuizMistakeCounts } from '../src/quiz-core.js';
import { createAyahTest, revealAndAdvanceAyah, toggleQuizMistake, resetAyahTest, isTestAyahVisible } from '../src/ayah-test.js';
import { migrateData } from '../src/storage.js';
import { DEFAULT_SETTINGS } from '../src/data.js';

let count=0;
const id=()=>'quiz-'+(++count);
const empty=()=>({...makeInitialData(),quizAttempts:[]});
const unit=(surah,from=1,to=null,more={})=>({
  id:id(),surah,method:to?'ayah':'surah',startAyah:from,endAyah:to||SURAH_NAMES[surah-1].ayahs,
  status:'محفوظ حديثًا',...more
});

test('unverified Juz-wide history and historical recitation do not imply individual Surah mastery',()=>{
  const data=empty();
  assert.equal(trackedQuizSurahs(data).length,0);
  assert.equal(chooseQuizPassage(data,{rng:()=>0}),null);
  assert.equal(buildQuizSpans(data).length,0);
});
test('manual memorized Ayah range generates only its real Ayahs, no neighbors',()=>{
  const data=empty();data.units.push(unit(58,1,5));
  const selected=chooseQuizPassage(data,{rng:()=>0,length:6});
  assert.deepEqual({surah:selected.surah,start:selected.startAyah,end:selected.endAyah}, {surah:58,start:1,end:5});
  assert.equal(selected.page,mushafPageFor(58,1));
  const testState=createAyahTest(selected.page,selected);
  assert.equal(testState.ayahs.length,5);
  assert.deepEqual(testState.ayahs.map(v=>v.ayah),[1,2,3,4,5]);
  assert.equal(isTestAyahVisible(testState,58,1),false);
});
test('review-only simpleTrack placeholder needs a completed logged review',()=>{
  const data=empty();const review=unit(80,1,null,{simpleTrack:true,status:'محفوظ سابقًا ويحتاج مراجعة'});
  data.units.push(review);
  assert.equal(chooseQuizPassage(data,{rng:()=>0}),null);
  data.activities.push({id:id(),type:'revision',completed:true,unitId:review.id,date:todayKey()});
  const passage=chooseQuizPassage(data,{rng:()=>0});
  assert.equal(passage.surah,80);
});
test('unconfirmed memorization is excluded from whole Surah random testing',()=>{
  const data=empty();data.units.push(unit(66,1,null,{status:'قيد الحفظ'}));
  assert.equal(chooseQuizPassage(data,{rng:()=>0}),null);
});
test('cross-page full Surah is always limited to exactly one physical Mushaf page',()=>{
  const data=empty();data.units.push(unit(2));
  for(const rng of [()=>0,()=>0.99,()=>0.5]){
    const p=chooseQuizPassage(data,{rng,length:6});
    assert.equal(p.surah,2);
    assert.ok(p.length<=6);
    assert.equal(mushafPageFor(2,p.startAyah),p.page);
    assert.equal(mushafPageFor(2,p.endAyah),p.page);
    const s=createAyahTest(p.page,p);
    assert.equal(s.ayahs.length,p.length);
  }
});
test('weak and due filters only select ranges with matching real records',()=>{
  const data=empty();
  const strong=unit(80),weak=unit(78,1,5,{lastRating:'ضعيف'});
  data.units.push(strong,weak);
  data.revisions.push({id:id(),unitId:strong.id,dueDate:todayKey(),done:false});
  assert.equal(chooseQuizPassage(data,{mode:'weak',rng:()=>0}).surah,78);
  assert.equal(chooseQuizPassage(data,{mode:'due',rng:()=>0}).surah,80);
  assert.equal(chooseQuizPassage(empty(),{mode:'due',rng:()=>0}),null);
});
test('mistake marking is explicit and reversible without any grading',()=>{
  const data=empty();data.units.push(unit(80,1,6));
  const p=chooseQuizPassage(data,{rng:()=>0});
  let state=createAyahTest(p.page,p);
  state=revealAndAdvanceAyah(state);
  assert.equal(state.currentIndex,1);
  state=toggleQuizMistake(state);
  assert.deepEqual(state.mistakeAyahs,[1]);
  state=toggleQuizMistake(state);
  assert.deepEqual(state.mistakeAyahs,[]);
  assert.equal(state.rating,undefined);
  assert.deepEqual(data.quizAttempts,[]);
});
test('explicitly saved quiz attempt tracks errors but does not mark the Surah mastered',()=>{
  const data=empty();const u=unit(80,1,6);data.units.push(u);
  const p=chooseQuizPassage(data,{rng:()=>0});
  const before=JSON.stringify({activities:data.activities,revisions:data.revisions,units:data.units});
  const saved=recordQuizAttempt(data,p,[1,3,3],id);
  assert.deepEqual(saved.mistakeAyahs,[1,3]);
  assert.equal(saved.verifiedByTeacher,false);
  assert.equal(saved.kind,'self-assessed');
  assert.equal(data.quizAttempts.length,1);
  assert.equal(quizSummary(data).attempts,1);
  assert.equal(quizSummary(data).mistakeLocations,2);
  assert.equal(JSON.stringify({activities:data.activities,revisions:data.revisions,units:data.units}),before);
  assert.equal(data.units.at(-1).status,'محفوظ حديثًا');
  assert.throws(()=>recordQuizAttempt(data,p,[99],id),/لا تنتمي/);
});
test('weak-ayah test actively includes recorded mistaken Ayah',()=>{
  const data=empty();data.units.push(unit(80,1,12));
  const p=chooseQuizPassage(data,{rng:()=>0,length:6});
  recordQuizAttempt(data,p,[p.startAyah+2],id);
  const weak=chooseQuizPassage(data,{mode:'weak',rng:()=>0,length:6});
  assert.equal(weak.surah,80);
  assert.ok(weak.startAyah<=p.startAyah+2);
  assert.ok(weak.endAyah>=p.startAyah+2);
  assert.equal(getQuizMistakeCounts(data).get('80:'+(p.startAyah+2)),1);
});
test('self-assessed progress reports only the exact recorded mistake locations',()=>{
  const data=empty();const u=unit(80,1,6);data.units.push(u);
  const p=chooseQuizPassage(data,{rng:()=>0});
  recordQuizAttempt(data,p,[1,3],id);
  recordQuizAttempt(data,p,[3],id);
  const summary=quizSummary(data);
  assert.equal(summary.attempts,2);
  assert.equal(summary.mistakeLocations,2);
  assert.deepEqual(summary.weakLocations[0],{surah:80,ayah:3,count:2});
  assert.deepEqual(summary.weakLocations[1],{surah:80,ayah:1,count:1});
});
test('random mode can target a previously missed Ayah within a larger covered section',()=>{
  const data=empty();data.units.push(unit(80,1,20));
  const first=chooseQuizPassage(data,{rng:()=>0,length:6});
  recordQuizAttempt(data,first,[first.startAyah+4],id);
  const next=chooseQuizPassage(data,{rng:()=>0,length:6});
  assert.ok(next.startAyah<=first.startAyah+4);
  assert.ok(next.endAyah>=first.startAyah+4);
});

test('quiz attempt history survives legacy v2 data migration without replacing records',()=>{
  const data=empty();delete data.quizAttempts;
  const unitId=data.units[0].id;
  const restored=migrateData(structuredClone(data),DEFAULT_SETTINGS);
  assert.deepEqual(restored.quizAttempts,[]);
  assert.equal(restored.units[0].id,unitId);
  restored.quizAttempts.push({id:id(),surah:80,startAyah:1,endAyah:6,mistakeAyahs:[3]});
  const second=migrateData(restored,DEFAULT_SETTINGS);
  assert.equal(second.quizAttempts[0].mistakeAyahs[0],3);
});
test('reset of a targeted quiz preserves its passage but switching page clears the target',()=>{
  const data=empty();data.units.push(unit(80,1,5));
  const p=chooseQuizPassage(data,{rng:()=>0});
  let state=createAyahTest(p.page,p);
  state=revealAndAdvanceAyah(state);
  const reset=resetAyahTest(state);
  assert.equal(reset.ayahs.length,5);
  assert.equal(reset.revealed.length,0);
  const moved=resetAyahTest(state,p.page+1);
  assert.equal(moved.passage,null);
});
