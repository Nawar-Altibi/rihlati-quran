import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ayahsOnMushafPage, createAyahTest, revealCurrentAyah, moveTestCursor,
  toggleTestRevealAll, resetAyahTest, isTestAyahVisible, getAyahTestProgress
} from '../src/ayah-test.js';

test('new self-test starts with every Ayah hidden and does not reveal text by default', () => {
  const state=createAyahTest(582);
  const p=getAyahTestProgress(state);
  assert.equal(state.page,582);
  assert.equal(p.total,30);
  assert.deepEqual(state.revealed,[]);
  assert.equal(p.position,1);
  assert.deepEqual(p.current,{surah:78,ayah:1,key:'78:1'});
  assert.equal(isTestAyahVisible(state,78,1),false);
  assert.equal(isTestAyahVisible(state,78,2),false);
});

test('reveal is explicit, unique, immutable and keeps subsequent Ayahs concealed', () => {
  const start=createAyahTest(582);
  const once=revealCurrentAyah(start),twice=revealCurrentAyah(once);
  assert.deepEqual(start.revealed,[]);
  assert.deepEqual(once.revealed,['78:1']);
  assert.deepEqual(twice.revealed,['78:1']);
  assert.equal(isTestAyahVisible(once,78,1),true);
  assert.equal(isTestAyahVisible(once,78,2),false);
  const next=moveTestCursor(once,1);
  assert.equal(next.currentIndex,1);
  assert.equal(isTestAyahVisible(next,78,2),false);
  assert.equal(isTestAyahVisible(next,78,1),true);
  assert.deepEqual(revealCurrentAyah(next).revealed,['78:1','78:2']);
});

test('page with 2 Surahs changes correctly from An-Naba to An-Naziat', () => {
  const verses=ayahsOnMushafPage(583);
  assert.equal(verses[0].key,'78:31');
  assert.equal(verses.at(-1).key,'79:15');
  assert.deepEqual(verses.filter(x=>x.surah===78).map(x=>x.ayah),[31,32,33,34,35,36,37,38,39,40]);
  let state=createAyahTest(583);
  state=moveTestCursor(state,10);
  assert.deepEqual(getAyahTestProgress(state).current,{surah:79,ayah:1,key:'79:1'});
});

test('next and previous cannot leave the available page, all-show is reversible', () => {
  const start=createAyahTest(604),count=start.ayahs.length;
  assert.equal(moveTestCursor(start,-100).currentIndex,0);
  const end=moveTestCursor(start,1000);
  assert.equal(end.currentIndex,count-1);
  assert.equal(getAyahTestProgress(end).isLast,true);
  assert.equal(moveTestCursor(end,1).currentIndex,count-1);
  const shown=toggleTestRevealAll(start);
  assert.equal(shown.showAll,true);
  assert.equal(isTestAyahVisible(shown,114,6),true);
  const hidden=toggleTestRevealAll(shown);
  assert.equal(hidden.showAll,false);
  assert.equal(isTestAyahVisible(hidden,114,6),false);
});

test('reset hides verses again, moving to another page resets separately', () => {
  const s=revealCurrentAyah(createAyahTest(585));
  assert.equal(isTestAyahVisible(s,80,1),true);
  const reset=resetAyahTest(s);
  assert.equal(reset.ayahs.length,42);
  assert.deepEqual(reset.revealed,[]);
  assert.equal(reset.currentIndex,0);
  const moved=resetAyahTest(s,586);
  assert.equal(moved.page,586);
  assert.deepEqual(moved.revealed,[]);
  assert.notEqual(moved.ayahs[0].key,'80:1');
});

test('test logic never creates activity, revision or score records', () => {
  const d={activities:[],revisions:[],settings:{mushafReading:{page:582,surah:78,ayah:1}}};
  const original=JSON.stringify(d);
  const s=toggleTestRevealAll(revealCurrentAyah(moveTestCursor(createAyahTest(582),1)));
  assert.equal(getAyahTestProgress(s).revealed,1);
  assert.equal(JSON.stringify(d),original);
  assert.equal(s.rating,undefined);
  assert.equal(s.completed,undefined);
});
