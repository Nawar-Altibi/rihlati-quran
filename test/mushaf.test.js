import test from 'node:test';
import assert from 'node:assert/strict';
import { SURAH_NAMES } from '../src/data.js';
import { mushafPageFor, getMushafPageSegments, mushafPageVerses, validateMushafChapter, clampMushafPage } from '../src/mushaf-core.js';

test('604 Hafs pages cover all 6236 Ayahs exactly once, in order',()=>{
  let counted=0,lastSurah=1,lastAyah=0;
  for(let p=1;p<=604;p++){
    const segments=getMushafPageSegments(p);
    assert.ok(segments.length>=1);
    for(const s of segments){
      assert.ok(s.fromAyah<=s.toAyah);
      assert.ok(s.surah>=lastSurah);
      if(s.surah===lastSurah) assert.equal(s.fromAyah,lastAyah+1);
      else {
        assert.equal(s.surah,lastSurah+1);
        assert.equal(s.fromAyah,1);
        assert.equal(lastAyah,SURAH_NAMES[lastSurah-1].ayahs);
      }
      counted+=s.toAyah-s.fromAyah+1;
      lastSurah=s.surah;lastAyah=s.toAyah;
      assert.equal(mushafPageFor(s.surah,s.fromAyah),p);
      assert.equal(mushafPageFor(s.surah,s.toAyah),p);
    }
  }
  assert.equal(counted,6236);
  assert.equal(lastSurah,114);
  assert.equal(lastAyah,6);
});

test('first and last pages map to known surahs and page boundaries',()=>{
  assert.deepEqual(getMushafPageSegments(1),[{surah:1,name:SURAH_NAMES[0].name,totalAyahs:7,fromAyah:1,toAyah:7}]);
  assert.equal(getMushafPageSegments(2)[0].surah,2);
  assert.equal(getMushafPageSegments(604).at(-1).surah,114);
  assert.equal(mushafPageFor(78,1),582);
  assert.equal(mushafPageFor(80,1),585);
  assert.equal(mushafPageFor(114,6),604);
});

test('chapter content must be unmodified, complete, numbered Uthmani verses',()=>{
  const fatiha={id:1,verses:Array.from({length:7},(_,i)=>({id:i+1,text:'آية تجريبية '+(i+1)}))};
  assert.equal(validateMushafChapter(fatiha,1),true);
  assert.deepEqual(mushafPageVerses(1,new Map([[1,fatiha]]) )[0].verses[0],{surah:1,ayah:1,text:'آية تجريبية 1'});
  assert.throws(()=>validateMushafChapter({id:1,verses:[]},1),/التحقق/);
  assert.throws(()=>validateMushafChapter({...fatiha,verses:[...fatiha.verses.slice(0,6),{id:9,text:'bad'}]},1),/غير مكتملة/);
});

test('invalid pages are bounded without accepting nonsensical page numbers',()=>{
  assert.equal(clampMushafPage(604),604);
  assert.equal(clampMushafPage(999),604);
  assert.equal(clampMushafPage(0),1);
  assert.throws(()=>clampMushafPage('x'),/غير صالح/);
  assert.throws(()=>mushafPageFor(2,287),/غير صالح/);
});
