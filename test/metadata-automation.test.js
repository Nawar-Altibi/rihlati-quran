import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, SURAH_NAMES } from '../src/data.js';
import { todayKey } from '../src/logic.js';
import { PAGE_STARTS, JUZ_STARTS, locateAyah, describeAyahRange, searchSurahs } from '../src/quran-metadata.js';
import { recordSimpleMemorization } from '../src/memorization.js';

let counter=0;
const id=()=> 'test-'+(++counter);
const fresh=()=>({
  settings:structuredClone(DEFAULT_SETTINGS),
  units:[{id:'old-juz',legacy:true,juz:30,surah:null,pages:0,status:'محفوظ سابقًا ويحتاج مراجعة'}],
  activities:[],attempts:[],revisions:[],tasks:[],sessions:[],scheduledSessions:[]
});

test('source maps exactly 604 Madinah pages and 30 Juz with terminal marker',()=>{
  assert.equal(PAGE_STARTS.length,606);
  assert.equal(JUZ_STARTS.length,32);
  assert.equal(PAGE_STARTS[1],1);
  assert.equal(PAGE_STARTS.at(-1),6237);
  assert.equal(JUZ_STARTS.at(-1),6237);
  assert.deepEqual(locateAyah(1,1),{ayahId:1,page:1,juz:1});
  assert.equal(locateAyah(2,1).page,2);
  assert.equal(locateAyah(2,255).page,42);
  assert.equal(locateAyah(2,255).juz,3);
});

test('full Surahs automatically get exact page ranges and crossing-Juz metadata',()=>{
  const baqarah=describeAyahRange(2);
  assert.equal(baqarah.fromAyah,1);
  assert.equal(baqarah.toAyah,286);
  assert.equal(baqarah.pageStart,2);
  assert.equal(baqarah.pageEnd,49);
  assert.equal(baqarah.juzStart,1);
  assert.equal(baqarah.juzEnd,3);
  assert.equal(baqarah.juz,null);
  assert.ok(baqarah.approximatePages>0);
  const abasa=describeAyahRange(80);
  assert.equal(abasa.ayahCount,42);
  assert.equal(abasa.juz,30);
  assert.ok(abasa.pageStart>=580);
  assert.ok(abasa.pageEnd<=604);
});

test('all 114 Surahs have valid page and Juz boundaries in Hafs data',()=>{
  let last=0;
  for(const s of SURAH_NAMES){
    const info=describeAyahRange(s.number);
    assert.equal(info.ayahCount,s.ayahs);
    assert.ok(info.pageStart>=last);
    assert.ok(info.pageEnd>=info.pageStart && info.pageEnd<=604);
    assert.ok(info.juzStart>=1 && info.juzEnd<=30 && info.juzEnd>=info.juzStart);
    last=info.pageStart;
  }
});

test('Arabic search is accent insensitive and supports manual number selection',()=>{
  assert.equal(searchSurahs('إخلاص')[0].number,112);
  assert.equal(searchSurahs('عَبَسَ')[0].number,80);
  assert.equal(searchSurahs('58')[0].number,58);
});

test('recording memorization fills Juz/page estimates without overwriting historical Juz',()=>{
  const d=fresh();
  const unit=recordSimpleMemorization(d,{surah:58,fromAyah:1,toAyah:5,date:todayKey()},id);
  assert.equal(unit.method,'ayah');
  assert.equal(unit.juz,28);
  assert.equal(unit.pageStart,describeAyahRange(58,1,5).pageStart);
  assert.equal(unit.pageEnd,describeAyahRange(58,1,5).pageEnd);
  assert.equal(unit.pagesEstimated,true);
  assert.equal(unit.status,'محفوظ حديثًا');
  assert.equal(d.activities.length,1);
  assert.equal(d.revisions.filter(r=>!r.done).length,1);
  assert.equal(d.units[0].id,'old-juz');
});

test('overlapping Ayah memorization is rejected but independent portion is allowed',()=>{
  const d=fresh(), date=todayKey();
  recordSimpleMemorization(d,{surah:58,fromAyah:1,toAyah:5,date},id);
  assert.throws(()=>recordSimpleMemorization(d,{surah:58,fromAyah:5,toAyah:9,date},id),/تتداخل/);
  recordSimpleMemorization(d,{surah:58,fromAyah:6,toAyah:10,date},id);
  assert.equal(d.activities.length,2);
});

test('review-only zero-page unit does not block real memorization record',()=>{
  const d=fresh();
  d.units.push({id:'reviewed',method:'surah',surah:58,pages:0,simpleTrack:true,status:'محفوظ سابقًا ويحتاج مراجعة'});
  const unit=recordSimpleMemorization(d,{surah:58,fromAyah:1,toAyah:3,date:todayKey()},id);
  assert.equal(unit.startAyah,1);
  assert.equal(d.units.find(u=>u.id==='reviewed').simpleTrack,true);
});

test('invalid ayah range cannot create a memorization record',()=>{
  const d=fresh();
  assert.throws(()=>recordSimpleMemorization(d,{surah:80,fromAyah:40,toAyah:50,date:todayKey()},id),/نطاق/);
  assert.equal(d.activities.length,0);
});
