import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS } from '../src/data.js';
import { SIMPLE_STAGES, getCurrentStage, recordDailyReviews, dueSurahReviews, createGroupRecitation, completeGroupRecitation, advanceSimpleStage, getSurahUnit } from '../src/simple-flow.js';

const ids = () => { let i = 0; return () => 'id-' + (++i); };
const data = () => ({
  settings: { ...structuredClone(DEFAULT_SETTINGS), simpleStage:'amma' },
  units:[{ id:'old-juz', title:'جزء عمّ', juz:30, surah:null, pages:0, status:'محفوظ سابقًا ويحتاج مراجعة', legacy:true }],
  revisions:[], attempts:[], activities:[], sessions:[], scheduledSessions:[], tasks:[]
});

test('the first daily multi-surah review is one action with three distinct records', () => {
  const d=data(), id=ids();
  const res=recordDailyReviews(d,{ surahs:[80,78,79],date:'2026-10-27',ratings:{80:'يحتاج مراجعة',78:'متقن',79:'أخطاء بسيطة'} },id);
  assert.deepEqual(res,{created:3,rated:3,duplicates:0});
  assert.equal(d.activities.length,3);
  assert.deepEqual(d.units.filter(u=>u.surah).map(u=>u.surah),[80,78,79]);
  assert.equal(d.units.find(u=>u.id==='old-juz').legacy,true);
  assert.equal(d.revisions.filter(r=>!r.done).length,3);
  assert.equal(d.revisions.filter(r=>r.done).length,3);
  assert.equal(getSurahUnit(d,78).status,'محفوظ سابقًا ويحتاج مراجعة');
});

test('user can review one Surah with no grade, without fabricating mastery or due date', () => {
  const d=data();
  const res=recordDailyReviews(d,{surahs:[78],date:'2026-10-27'},ids());
  assert.equal(res.created,1);
  assert.equal(res.rated,0);
  assert.equal(d.revisions.length,0);
  assert.equal(d.activities[0].rating,null);
  assert.equal(getSurahUnit(d,78).lastRating,undefined);
});

test('duplicate save same day does not create repeated achievements', () => {
  const d=data(), id=ids();
  recordDailyReviews(d,{surahs:[78],date:'2026-10-27',ratings:{78:'متقن'}},id);
  const res=recordDailyReviews(d,{surahs:[78],date:'2026-10-27',ratings:{78:'متقن'}},id);
  assert.equal(res.created,0);
  assert.equal(res.duplicates,1);
  assert.equal(d.activities.length,1);
  assert.equal(d.revisions.filter(r=>!r.done).length,1);
});

test('voluntary early revision updates existing due review independently by Surah', () => {
  const d=data(), id=ids();
  recordDailyReviews(d,{surahs:[78,79],date:'2026-10-26',ratings:{78:'متقن',79:'متقن'}},id);
  const oldDue=d.revisions.find(r=>!r.done&&r.unitId===getSurahUnit(d,78).id).dueDate;
  recordDailyReviews(d,{surahs:[78],date:'2026-10-27',ratings:{78:'ضعيف'}},id);
  const later=d.revisions.find(r=>!r.done&&r.unitId===getSurahUnit(d,78).id);
  assert.equal(later.dueDate,'2026-10-28');
  assert.notEqual(oldDue,later.dueDate);
  assert.equal(d.revisions.filter(r=>!r.done&&r.unitId===getSurahUnit(d,78).id).length,1);
  assert.equal(d.revisions.filter(r=>!r.done&&r.unitId===getSurahUnit(d,79).id).length,1);
});

test('teacher session schedules and completes multiple Surahs as a single session', () => {
  const d=data(),id=ids();
  d.sessions.push({id:'historical',surah:78,date:null,factual:true});
  const planned=createGroupRecitation(d,{date:'2026-10-27',surahs:[78,79,80,80],teacher:'صاحبي'},id);
  assert.deepEqual(planned.surahs,[78,79,80]);
  assert.equal(d.scheduledSessions.length,1);
  const session=completeGroupRecitation(d,planned.id,{date:'2026-10-27',result:'اجتاز',notes:'مدود'},id);
  assert.equal(d.scheduledSessions.length,0);
  assert.equal(d.sessions.length,2);
  assert.deepEqual(session.surahs,[78,79,80]);
  assert.equal(d.activities.filter(a=>a.type==='session').length,1);
  assert.equal(d.sessions[0].id,'historical');
});

test('explicit stage advance preserves previously scheduled revisions', () => {
  const d=data(),id=ids();
  recordDailyReviews(d,{surahs:[78],date:'2026-10-27',ratings:{78:'متقن'}},id);
  const pending=d.revisions.filter(r=>!r.done);
  assert.equal(getCurrentStage(d).id,'amma');
  assert.equal(advanceSimpleStage(d),true);
  assert.equal(getCurrentStage(d).id,'tabarak');
  assert.equal(d.revisions.filter(r=>!r.done).length,pending.length);
  assert.equal(SIMPLE_STAGES[2].id,'qad');
});

test('invalid empty group and invalid review selection are rejected',()=>{
  const d=data();
  assert.throws(()=>recordDailyReviews(d,{surahs:[],date:'2026-10-27'},ids()),/اختر سورة/);
  assert.throws(()=>createGroupRecitation(d,{surahs:[],date:'2026-10-27'},ids()),/اختر سورة/);
});
