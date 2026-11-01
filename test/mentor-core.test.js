import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInitialData } from '../src/data.js';
import { todayKey,addDays } from '../src/logic.js';
import { buildMentorSnapshot,generateMentorPlan,answerMentorLocally,mentorModelPayload } from '../src/mentor-core.js';

const data=()=>makeInitialData();
const date=todayKey();
test('a fresh Juz-history user gets honest, zero-mastery recommendations',()=>{
  const d=data(),s=buildMentorSnapshot(d,date);
  assert.equal(s.trackedSurahs,0);
  assert.equal(s.due.length,0);
  assert.equal(s.quizAttempts,0);
  assert.ok(generateMentorPlan(s)[0].reason.includes('ليس إثباتًا'));
  assert.match(answerMentorLocally(s,'كيف عم يتقدم حفظي؟'),/0 سور/);
  assert.match(answerMentorLocally(s,'شو لازم راجع اليوم؟'),/اقتراحي/);
});
test('due weak surahs and quiz mistakes get prioritized without fake Quran mastery',()=>{
  const d=data();
  const u={id:'u80',method:'surah',surah:80,status:'يحتاج تثبيت',lastRating:'ضعيف'};
  d.units.push(u);
  d.activities.push({id:'a1',type:'revision',date,unitId:u.id,completed:true});
  d.revisions.push({id:'r1',unitId:u.id,dueDate:addDays(date,-1),done:false});
  d.quizAttempts=[{surah:80,startAyah:1,endAyah:5,mistakeAyahs:[2,4]},{surah:80,startAyah:1,endAyah:5,mistakeAyahs:[2]}];
  const s=buildMentorSnapshot(d,date),plan=generateMentorPlan(s);
  assert.equal(s.trackedSurahs,1);
  assert.equal(s.due.length,1);
  assert.equal(s.weakAyahs[0].ayah,2);
  assert.equal(s.weakAyahs[0].count,2);
  assert.equal(plan[0].type,'weak');
  assert.ok(plan.some(x=>x.type==='review'));
  assert.match(answerMentorLocally(s,'وين أخطائي؟'),/الآية 2/);
});
test('without a completed review, a simpleTrack placeholder does not count',()=>{
  const d=data();
  d.units.push({id:'draft',method:'surah',surah:78,simpleTrack:true,status:'محفوظ سابقًا ويحتاج مراجعة'});
  const s=buildMentorSnapshot(d,date);
  assert.equal(s.trackedSurahs,0);
  assert.equal(s.due.length,0);
});
test('planned teacher session appears as actual future date with no invented time',()=>{
  const d=data();
  d.scheduledSessions.push({id:'g',date:addDays(date,2),surahs:[78,79],teacher:'Private teacher name'});
  const s=buildMentorSnapshot(d,date);
  assert.equal(s.nextSession.surahs.length,2);
  assert.match(answerMentorLocally(s,'شو موعد التسميع؟'),/النبأ/);
  const payload=mentorModelPayload(s,'رتبلي خطة التسميع');
  assert.equal(JSON.stringify(payload).includes('Private teacher name'),false);
});
test('cloud AI context is whitelisted and never includes private notes or raw activity IDs',()=>{
  const d=data();
  d.units.push({id:'private-unit-token',method:'surah',surah:80,notes:'private medical secret',status:'محفوظ حديثًا'});
  d.activities.push({id:'private-activity',completed:true,type:'revision',unitId:'private-unit-token',date,note:'private diary'});
  const snapshot=buildMentorSnapshot(d,date);
  const packet=mentorModelPayload(snapshot,'ممكن تعطيني برنامج؟');
  const serialized=JSON.stringify(packet);
  assert.equal(serialized.includes('private diary'),false);
  assert.equal(serialized.includes('private-unit-token'),false);
  assert.equal(serialized.includes('private medical secret'),false);
  assert.equal(packet.question,'ممكن تعطيني برنامج؟');
  assert.ok(Object.keys(packet.context).length<=9);
});
test('stage transitions and incomplete memory preserve honest context',()=>{
  const d=data();d.settings.simpleStage='tabarak';
  const s=buildMentorSnapshot(d,date);
  assert.equal(s.stage.newMemorization,false);
  assert.match(answerMentorLocally(s,'شو أحفظ بكرا؟'),/تثبيت المحفوظ/);
});
