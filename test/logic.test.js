import test from 'node:test';
import assert from 'node:assert/strict';
import { calcProgress, nextReview, completionEstimate, addDays, streaks, unitsOverlap, validateUnit, isValidDateKey } from '../src/logic.js';
import { loadData, migrateData, STORAGE_VERSION } from '../src/storage.js';
import { SURAH_NAMES, DEFAULT_SETTINGS, makeInitialData } from '../src/data.js';

test('progress counts unique units by their current status',()=>{
  const result=calcProgress([
    {pages:2,status:'محفوظ سابقًا ويحتاج مراجعة',lastReviewed:'2026-10-01'},
    {pages:1.5,status:'متقن',lastReviewed:'2026-10-02'},
    {pages:3,status:'لم أبدأ'}
  ]);
  assert.deepEqual(result,{memorized:3.5,mastered:1.5,reviewed:3.5,total:6.5});
});

test('review scheduling adapts to rating and advances successful reviews',()=>{
  const intervals=[1,3,7,14,30], unit={stage:0};
  assert.deepEqual(nextReview(unit,'متقن','2026-10-01',intervals),{dueDate:'2026-10-04',stage:1});
  assert.deepEqual(nextReview({stage:3},'ضعيف','2026-10-01',intervals),{dueDate:'2026-10-02',stage:0});
  assert.deepEqual(nextReview({stage:3},'يحتاج مراجعة','2026-10-01',intervals),{dueDate:'2026-10-03',stage:2});
  assert.deepEqual(nextReview({stage:0},'أخطاء بسيطة','2026-10-01',intervals),{dueDate:'2026-10-03',stage:1});
});

test('completion estimate respects weekly pace and returns null for invalid pace',()=>{
  const estimate=completionEstimate(20,1,5);
  assert.equal(estimate.weeks,4);
  assert.equal(estimate.date,addDays(new Date().toISOString().slice(0,10),28));
  assert.equal(completionEstimate(10,0,5),null);
});

test('streak calculation uses completed activity dates only',()=>{
  assert.deepEqual(streaks([{date:'2026-10-24',completed:true},{date:'2026-10-25',completed:true},{date:'2026-10-26',completed:false}],'2026-10-26'),{current:2,longest:2});
});

test('same-edition page ranges are counted once and overlaps are rejected',()=>{
  const a={id:'a',method:'pages',startPage:10,endPage:12,edition:'Madinah',pages:3,status:'محفوظ حديثًا'};
  const b={id:'b',method:'pages',startPage:12,endPage:14,edition:'Madinah',pages:3,status:'متقن'};
  assert.equal(unitsOverlap(a,b),true);
  assert.equal(calcProgress([a,b]).memorized,5);
});

test('ayah ranges overlap only within the same surah',()=>{
  assert.equal(unitsOverlap({surah:2,startAyah:1,endAyah:10},{surah:2,startAyah:10,endAyah:15}),true);
  assert.equal(unitsOverlap({surah:2,startAyah:1,endAyah:10},{surah:3,startAyah:1,endAyah:10}),false);
});

test('unit validation rejects invalid ayah ranges, invalid pages, and duplicate records',()=>{
  const base={id:'new',method:'ayah',surah:78,startAyah:1,endAyah:40,pages:1,memorizedAt:'2026-10-26'};
  assert.equal(validateUnit(base,[],SURAH_NAMES),null);
  assert.match(validateUnit({...base,endAyah:40.5},[],SURAH_NAMES),/نطاق الآيات/);
  assert.match(validateUnit({...base,endAyah:41},[],SURAH_NAMES),/نطاق الآيات/);
  const old={id:'old',method:'ayah',surah:78,startAyah:20,endAyah:30};
  assert.match(validateUnit({...base,startAyah:30,endAyah:40},[old],SURAH_NAMES),/تتداخل/);
  assert.equal(validateUnit({...base,id:'old',startAyah:20,endAyah:30},[old],SURAH_NAMES),null);
});

test('page tracking validates an inclusive page range and positive date',()=>{
  const unit={id:'p1',method:'pages',startPage:12,endPage:14,edition:'مصحف المدينة (٦٠٤ صفحة)',pages:3,memorizedAt:'2026-10-26'};
  assert.equal(validateUnit(unit,[],SURAH_NAMES),null);
  assert.match(validateUnit({...unit,endPage:605},[],SURAH_NAMES),/نطاق الصفحات/);
  assert.match(validateUnit({...unit,memorizedAt:'2026-02-31'},[],SURAH_NAMES),/تاريخًا صالحًا/);
  assert.equal(isValidDateKey('2026-10-26'),true);
  assert.equal(isValidDateKey('2026-02-31'),false);
});

test('v1 migration preserves stored identifiers and does not add seed records',()=>{
  const source={version:1,units:[{id:'keep-unit',title:'saved',pages:2,status:'محفوظ حديثًا'}],revisions:[{id:'keep-review'}],sessions:[{id:'keep-session',factual:true}],tasks:[],activities:[],attempts:[],settings:{theme:'dark'}};
  const migrated=migrateData(source,{theme:'light',reviewIntervals:[1,3]});
  assert.equal(migrated.version,STORAGE_VERSION);
  assert.equal(migrated.units[0].id,'keep-unit');
  assert.equal(migrated.revisions[0].id,'keep-review');
  assert.equal(migrated.sessions[0].id,'keep-session');
  assert.equal(migrated.settings.theme,'dark');
  assert.equal(migrated.units.length,1);
});

test('invalid saved data is not overwritten by the loader',()=>{
  const saved='{"version":99,"myRecord":"keep"}',memory={getItem:()=>saved,setItem(){throw new Error('must not write');}};
  const result=loadData(memory,'quran',makeInitialData,DEFAULT_SETTINGS);
  assert.equal(result.data,null);
  assert.ok(result.error);
});
