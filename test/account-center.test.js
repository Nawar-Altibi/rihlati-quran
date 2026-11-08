import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeNewUserData} from '../src/data.js';
import {buildOnboardingPayload,createOnboardingDraft,toggleKnownSurah} from '../src/onboarding.js';
import {
  createSettingsDraft,validateSettingsDraft,buildSettingsUpdate,toggleAccountSurah,
  searchAccountSurahs,renderAccountSurahMatches,renderPreferences,
  renderAccountCenter,formatSavedAt
} from '../src/account-center.js';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('account center displays cloud status and clear working navigation, including logout',()=>{
  const options={user:{displayName:'مستخدم',email:'example@gmail.com'},status:'☁ محفوظ بالسحابة',
    lastSavedAt:'2026-11-08T08:30:00Z',revision:7,blocked:false,pending:false};
  const home=renderAccountCenter('dashboard',options);
  for(const x of ['center-plan','center-sync','center-privacy','switch-account','logout'])
    assert.match(home,new RegExp('data-account-action="'+x+'"'));
  assert.match(home,/حسابك في رِحلتي/);
  assert.doesNotMatch(home,/example@gmail.com.*<script>/);
  const sync=renderAccountCenter('sync',options);
  assert.match(sync,/revision|مراجعة بيانات الحساب/i);
  assert.match(sync,/#7/);
  assert.match(sync,/data-account-action="sync"/);
  const privacy=renderAccountCenter('privacy',options);
  assert.match(privacy,/حذف الحساب — غير متاح حاليًا/);
  assert.match(privacy,/disabled aria-disabled="true"/);
  assert.match(privacy,/data-account-action="export"/);
});
test('preferences update only settings while preserving Quran records and study plan',()=>{
  const onboarding=createOnboardingDraft();onboarding.stage='tabarak';toggleKnownSurah(onboarding,67);
  const original=buildOnboardingPayload(onboarding,'2026-11-08');
  original.activities.push({id:'revision1',date:'2026-11-08',completed:true});
  original.units.push({id:'unit1',surah:67});
  original.sessions.push({id:'s1',date:'2026-11-08'});
  const snapshot=structuredClone(original);
  const d=createSettingsDraft(original);
  d.stage='baqarah';d.level='mixed';d.goal='memorize';d.dailyMinutes=35;
  d.days=[1,3,5];d.revisionDays=[0,2,4,6];d.recitationDay=5;
  toggleAccountSurah(d,78);
  d.knownSurahs.find(s=>s.surah===78).toAyah=12;
  const next=buildSettingsUpdate(original,d);
  assert.equal(next.settings.simpleStage,'baqarah');
  assert.equal(next.settings.dailyMinutes,35);
  assert.equal(next.settings.onboardingProfile.goal,'memorize');
  assert.deepEqual(next.settings.onboardingProfile.knownSurahs.map(x=>x.surah).sort(),[67,78]);
  assert.deepEqual(next.settings.memorizationDays,[1,3,5]);
  assert.deepEqual(next.settings.revisionDays,[0,2,4,6]);
  assert.equal(next.settings.recitationDay,5);
  for(const k of ['units','revisions','activities','sessions','attempts','studyPlan','tasks'])
    assert.deepEqual(next[k],snapshot[k],k);
  assert.deepEqual(original,snapshot);
});
test('existing account without onboarding profile can edit safely, no seeded progress',()=>{
  const state=makeNewUserData();
  const draft=createSettingsDraft(state);
  assert.equal(draft.stage,'amma');
  assert.equal(draft.goal,'mixed');
  const next=buildSettingsUpdate(state,draft);
  assert.ok(next.settings.onboardingProfile);
  assert.deepEqual(next.units,[]);
});
test('form rejects invalid days, minutes, ayah ranges, and duplicate surahs',()=>{
  const d=createSettingsDraft(makeNewUserData());
  d.days=[];
  assert.throws(()=>validateSettingsDraft(d),/يومًا واحدًا/);
  d.days=[0];d.revisionDays=[0,0];
  assert.throws(()=>validateSettingsDraft(d),/يومًا واحدًا/);
  d.revisionDays=[0];d.dailyMinutes=181;
  assert.throws(()=>validateSettingsDraft(d),/10 و180/);
  d.dailyMinutes=30;toggleAccountSurah(d,78);
  d.knownSurahs[0].fromAyah=40;d.knownSurahs[0].toAyah=1;
  assert.throws(()=>validateSettingsDraft(d),/الآيات/);
  d.knownSurahs[0].fromAyah=1;d.knownSurahs[0].toAyah=40;
  d.knownSurahs.push({...d.knownSurahs[0]});
  assert.throws(()=>validateSettingsDraft(d),/الآيات/);
  d.knownSurahs.pop();
  assert.equal(validateSettingsDraft(d),true);
});
test('surah search works in Arabic, choices are HTML escaped, and form is accessible',()=>{
  const d=createSettingsDraft(makeNewUserData());
  d.query='ملك';
  assert.deepEqual(searchAccountSurahs(d).map(s=>s.number),[67]);
  assert.match(renderAccountSurahMatches(d),/سورة الملك/);
  assert.match(renderPreferences(d),/data-account-form="preferences"/);
  assert.match(renderPreferences(d),/name="memoDays"/);
  assert.match(renderPreferences(d),/name="reviewDays"/);
  const hostile=renderAccountCenter('dashboard',{user:{displayName:'<script>alert(1)</script>',email:'a@example.com'},
    status:'ok',lastSavedAt:null,revision:0,pending:false,blocked:false});
  assert.doesNotMatch(hostile,/<script>/);
  assert.match(hostile,/&lt;script&gt;/);
  assert.match(formatSavedAt(null),/لم يتوفر/);
});
test('API surfaces authoritative updated_at and account UI gates cloud writes',()=>{
  const api=read('../functions/api/account/state.js'),client=read('../src/account-ui.js');
  assert.match(api,/select=payload,revision,updated_at/);
  assert.match(api,/updatedAt:item\.updated_at/);
  assert.match(client,/lastSavedAt=state\.updatedAt/);
  assert.match(client,/lastSavedAt=result\.updatedAt/);
  assert.match(client,/if\(kind==='preferences'\)/);
  assert.match(client,/const next=buildSettingsUpdate\(getData\(\),preferences\)/);
  assert.match(client,/if\(!save\(next\)\)/);
  assert.match(client,/if\(Number\(state\.revision\)!==revision\)/);
  assert.match(client,/blocked=true/);
  assert.match(client,/saveCopy\(pendingRecovery\?\.payload\|\|pending\|\|getData\(\)\)/);
});
