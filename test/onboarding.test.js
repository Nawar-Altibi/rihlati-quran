import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  createOnboardingDraft,toggleKnownSurah,updateKnownRange,searchOnboardingSurahs,
  validateOnboardingDraft,suggestedOnboardingPlan,buildOnboardingPayload,
  renderOnboardingWizard,renderSurahSearchResults
} from '../src/onboarding.js';
import {SURAH_NAMES} from '../src/data.js';
import {validatePlanInput} from '../src/flexible-plan.js';

test('wizard is a four-step draft with no initial cloud or progress records',()=>{
  const draft=createOnboardingDraft();
  assert.equal(draft.step,0);
  assert.deepEqual(draft.knownSurahs,[]);
  assert.equal(draft.dailyMinutes,20);
  assert.equal(validateOnboardingDraft(draft,3),true);
  for(let step=0;step<4;step++){
    draft.step=step;
    const html=renderOnboardingWizard(draft,{memorize:2,reviews:3,planned:1,sessions:0});
    assert.match(html,new RegExp('الخطوة '+(step+1)+' من 4'));
    assert.match(html,/data-account-action="import-guest"/);
    assert.match(html,/data-onboard-action="(next|finish)"/);
  }
});
test('surah search covers the Quran and known-ayah ranges are editable self-reports',()=>{
  const draft=createOnboardingDraft();
  draft.query='مُلْك';
  assert.deepEqual(searchOnboardingSurahs(draft).map(s=>s.number),[67]);
  draft.query='78';
  assert.deepEqual(searchOnboardingSurahs(draft).map(s=>s.name),['النبأ']);
  draft.query='';toggleKnownSurah(draft,78);
  updateKnownRange(draft,78,'fromAyah',2);
  updateKnownRange(draft,78,'toAyah',10);
  assert.deepEqual(draft.knownSurahs,[{surah:78,fromAyah:2,toAyah:10}]);
  assert.match(renderSurahSearchResults(draft),/data-onboard-action="surah"/);
  const html=renderOnboardingWizard({...draft,step:1});
  assert.match(html,/data-onboard-search/);
  assert.match(html,/data-onboard-range="fromAyah"/);
  assert.match(html,/ما رح نعتبر أي سورة متقنة/);
  assert.equal(SURAH_NAMES.length,114);
  toggleKnownSurah(draft,78);
  assert.equal(draft.knownSurahs.length,0);
});
test('new account payload has preferences and only PLANNED items, no completion records',()=>{
  const draft=createOnboardingDraft();
  draft.level='review';draft.stage='tabarak';draft.goal='mixed';
  draft.dailyMinutes=25;draft.days=[0,2,4];
  toggleKnownSurah(draft,67);
  updateKnownRange(draft,67,'toAyah',12);
  const data=buildOnboardingPayload(draft,'2026-11-08');
  assert.equal(data.version,2);
  assert.equal(data.settings.simpleStage,'tabarak');
  assert.equal(data.settings.dailyMinutes,25);
  assert.equal(data.settings.startSurah,67);
  assert.deepEqual(data.settings.memorizationDays,[0,2,4]);
  assert.deepEqual(data.settings.revisionDays,[0,2,4]);
  assert.deepEqual(data.settings.onboardingProfile.knownSurahs,[{surah:67,fromAyah:1,toAyah:12}]);
  for(const key of ['units','revisions','attempts','sessions','tasks','activities','quizAttempts'])
    assert.deepEqual(data[key],[],key);
  assert.equal(data.studyPlan.length,3);
  for(const item of data.studyPlan){
    assert.equal(item.status,'planned');
    assert.equal(item.minutes,25);
    assert.ok([0,2,4].includes(new Date(item.date+'T12:00:00').getDay()));
    validatePlanInput(item);
  }
  const plan=suggestedOnboardingPlan(draft,'2026-11-08');
  assert.deepEqual(plan.map(x=>x.date),data.studyPlan.map(x=>x.date));
  assert.equal(data.studyPlan[0].kind,'review');
  assert.equal(data.studyPlan[0].toAyah,12);
});
test('beginner can start without self-reported memorization or seeded author history',()=>{
  const draft=createOnboardingDraft();
  draft.level='beginner';draft.goal='memorize';draft.stage='baqarah';
  draft.knownSurahs=[];
  const data=buildOnboardingPayload(draft,'2026-11-08');
  assert.equal(data.settings.onboardingProfile.knownSurahs.length,0);
  assert.equal(data.studyPlan[0].surah,2);
  assert.equal(data.studyPlan[0].kind,'memorize');
  assert.equal(data.studyPlan[0].fromAyah,1);
  assert.equal(data.studyPlan[0].toAyah,5);
  assert.deepEqual(data.studyPlan.map(v=>[v.fromAyah,v.toAyah]),[[1,5],[6,10],[11,15]]);
  assert.match(data.settings.phases[0].title,/سورة البقرة/);
  assert.doesNotMatch(JSON.stringify(data.settings.monthlyPlan),/النبأ والنازعات/);
  assert.equal(data.activities.length,0);
  assert.equal(data.onboardingDone,true);
});
test('invalid setup choices are rejected before any persistence',()=>{
  const draft=createOnboardingDraft();draft.days=[];
  assert.throws(()=>buildOnboardingPayload(draft),/يومًا واحدًا/);
  draft.days=[0,0];
  assert.throws(()=>buildOnboardingPayload(draft),/يومًا واحدًا/);
  draft.days=[0,1];draft.dailyMinutes=185;
  assert.throws(()=>buildOnboardingPayload(draft),/10 و180/);
  draft.dailyMinutes=20;toggleKnownSurah(draft,78);
  updateKnownRange(draft,78,'fromAyah',40);
  updateKnownRange(draft,78,'toAyah',2);
  assert.throws(()=>buildOnboardingPayload(draft),/نطاق الآيات/);
  updateKnownRange(draft,78,'fromAyah',1);
  updateKnownRange(draft,78,'toAyah',40);
  assert.equal(validateOnboardingDraft(draft),true);
});
test('account UI commits the draft only on final confirmation and preserves explicit import',()=>{
  const source=readFileSync(new URL('../src/account-ui.js',import.meta.url),'utf8');
  assert.match(source,/onboarding=createOnboardingDraft\(\)/);
  assert.match(source,/renderOnboardingWizard\(onboarding,counts\(guestData\(\)\)\)/);
  assert.match(source,/if\(action==='finish'\)\{/);
  assert.match(source,/await begin\(payload\)/);
  assert.match(source,/buildOnboardingPayload\(onboarding\)/);
  assert.match(source,/if\(action==='import-guest'\)/);
  assert.match(source,/await begin\(migrateData\(original,DEFAULT_SETTINGS\)\)/);
  assert.match(source,/expectedRevision:0,payload/);
  assert.match(source,/if\(state\.payload\)\{/);
});
