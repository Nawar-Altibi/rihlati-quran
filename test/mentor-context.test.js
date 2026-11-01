import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInitialData } from '../src/data.js';
import { buildDetailedMentorContext,mentorChatHistory,MAX_MENTOR_STUDY_CHARS } from '../src/mentor-context.js';

test('mentor analyzes all tracked categories without turning Juz placeholders into Surah mastery',()=>{
  const d=makeInitialData();
  d.units.push({id:'u80',surah:80,method:'ayah',startAyah:1,endAyah:6,status:'محفوظ حديثًا',memorizedAt:'2026-10-28',note:'private teacher note'});
  d.activities.push({id:'a1',unitId:'u80',date:'2026-10-29',type:'revision',completed:true,rating:'ضعيف',note:'very private'});
  d.revisions.push({id:'r1',unitId:'u80',dueDate:'2026-11-01',done:false});
  d.sessions.push({id:'s1',date:'2026-10-29',surahs:[80],result:'جيد'});
  d.quizAttempts=[{date:'2026-11-01',surah:80,mistakeAyahs:[3,5],startAyah:1,endAyah:6}];
  d.scheduledSessions=[{date:'2026-11-03',surahs:[80]}];
  d.tasks.push({date:'2026-11-01',type:'revision',title:'راجع عبس',done:false});
  d.weeklyGoals=[{date:'2026-11-01',title:'تثبيت عبس',done:false}];
  d.attempts.push({date:'2026-10-29',unitId:'u80',rating:'ضعيف'});
  const out=buildDetailedMentorContext(d,{date:'2026-11-01'});
  for(const type of ['units','activities','revisions','sessions','quizAttempts','scheduledSessions','tasks','weeklyGoals','attempts']) {
    assert.ok(Array.isArray(out.details[type]));
    assert.ok(out.totalCounts[type]>=1);
  }
  assert.equal(out.details.units.find(x=>x.surah==='عبس').startAyah,1);
  assert.equal(out.details.activities[0].rating,'ضعيف');
  assert.equal(out.details.revisions[0].surah,'عبس');
  assert.equal(out.topMistakes.find(x=>x.place==='عبس:3').count,1);
  assert.equal(out.details.units[0].note,undefined);
  assert.equal(JSON.stringify(out).includes('very private'),false);
  assert.equal(JSON.stringify(out).includes('private teacher note'),false);
  assert.equal(JSON.stringify(out).includes('u80'),false);
});
test('teacher notes are shared only after explicit extra opt-in',()=>{
  const d=makeInitialData();
  d.units.push({id:'u',method:'surah',surah:80,note:'My own written study note'});
  assert.equal(JSON.stringify(buildDetailedMentorContext(d)).includes('My own written study note'),false);
  const out=buildDetailedMentorContext(d,{includeNotes:true});
  assert.equal(out.shareNotes,true);
  assert.equal(JSON.stringify(out).includes('My own written study note'),true);
});
test('bounded history has only legitimate roles, excludes long or stale messages',()=>{
  const h=mentorChatHistory([{role:'system',text:'admin'},{role:'user',text:'أول سؤال'},{role:'assistant',text:'جواب'}, {role:'user',text:'ليش؟'}]);
  assert.deepEqual(h.map(x=>x.role),['user','assistant','user']);
  assert.equal(h.at(-1).content,'ليش؟');
});
test('oversized old study history reports omissions rather than falsely claiming full transfer',()=>{
  const d=makeInitialData();
  d.quizAttempts=Array.from({length:250},(_,i)=>({surah:80,startAyah:1,endAyah:6,date:'2026-10-29',mistakeAyahs:[1,2,3,4]}));
  const out=buildDetailedMentorContext(d,{maxChars:4800});
  assert.equal(out.totalCounts.quizAttempts,250);
  assert.ok(out.omitted.quizAttempts>0);
  assert.ok(out.details.quizAttempts.length<250);
  assert.ok(JSON.stringify(out).length<6000);
});
