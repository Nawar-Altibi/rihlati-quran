import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInitialData } from '../src/data.js';
import { createMentorUI } from '../src/mentor-ui.js';

test('mentor renders current phase and safe local plan on empty seeded history',()=>{
  const d=makeInitialData();
  const ui=createMentorUI({getData:()=>d,render:()=>{},navigate:()=>{},openSurah:()=>{},openReview:()=>{},startQuiz:()=>{},toast:()=>{}});
  const html=ui.view();
  assert.match(html,/مساعد رحلتي/);
  assert.match(html,/ورد اليوم المقترح/);
  assert.match(html,/تثبيت جزء عمّ/);
  assert.match(html,/شو لازم راجع اليوم؟/);
  assert.match(html,/GPT-OSS 120B افتراضي/);
  assert.ok(!html.includes('انتهيت من حفظ جزء عم'));
});
test('suggestions generate a local reply without mutating memorization records',()=>{
  const d=makeInitialData(),before=JSON.stringify(d);
  const originalDocument=globalThis.document;
  globalThis.document={querySelector:()=>null};
  let ui,html;
  const render=()=>{html=ui.view()};
  ui=createMentorUI({getData:()=>d,render,navigate:()=>{},openSurah:()=>{},openReview:()=>{},startQuiz:()=>{},toast:()=>{}});
  try {
    assert.equal(ui.handleAction('mentor-suggest',{dataset:{index:'0'}}),true);
    assert.match(html,/اقتراحي لوردك اليوم/);
    assert.match(html,/مساعد رحلتي · المساعد المحلي/);
    assert.equal(JSON.stringify(d),before);
  }finally{globalThis.document=originalDocument;}
});
test('mentor opens Surah, review and quiz by explicit click rather than auto-updating user data',()=>{
  const d=makeInitialData(),actions=[];
  const ui=createMentorUI({getData:()=>d,render:()=>{},navigate:()=>{},openSurah:n=>actions.push(['open',n]),
    openReview:()=>actions.push(['review']),startQuiz:mode=>actions.push(['quiz',mode]),toast:()=>{}});
  assert.equal(ui.handleAction('mentor-open-surah',{dataset:{surah:'80'}}),true);
  assert.equal(ui.handleAction('mentor-review',{}),true);
  assert.equal(ui.handleAction('mentor-quiz',{}),true);
  assert.deepEqual(actions,[['open',80],['review'],['quiz','random']]);
});
test('turning off cloud mode uses free local assistant without any network call',()=>{
  const d=makeInitialData();
  const prevDoc=globalThis.document,prevFetch=globalThis.fetch;
  globalThis.document={querySelector:()=>null};
  let calls=0,html;globalThis.fetch=()=>{calls++;throw Error('should never call network');};
  let ui;const render=()=>{html=ui.view();};
  ui=createMentorUI({getData:()=>d,render,navigate:()=>{},openSurah:()=>{},openReview:()=>{},startQuiz:()=>{},toast:()=>{}});
  try{
    assert.equal(ui.handleChange({target:{id:'mentor-use-cloud',checked:false}}),true);
    const e={target:{id:'mentor-question-form',elements:{question:{value:'شو راجع اليوم؟'}}},preventDefault:()=>{}};
    assert.equal(ui.handleSubmit(e),true);
    assert.equal(calls,0);
    assert.match(html,/المساعد المحلي/);
    assert.match(html,/اقتراحي لوردك اليوم/);
  }finally{globalThis.document=prevDoc;globalThis.fetch=prevFetch;}
});

test('strong AI and study-note sharing are enabled by default and preferences can be changed',()=>{
  const d=makeInitialData();d.units.push({id:'only-local',method:'ayah',surah:80,startAyah:1,endAyah:4,status:'محفوظ',note:'my personal note'});
  const prevDoc=globalThis.document,prevStore=globalThis.localStorage;
  const store=new Map();
  globalThis.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
  globalThis.document={querySelector:()=>null};
  let ui,html;const render=()=>{html=ui.view();};
  ui=createMentorUI({getData:()=>d,render,navigate:()=>{},openSurah:()=>{},openReview:()=>{},startQuiz:()=>{},toast:()=>{}});
  try{
    assert.match(ui.view(),/GPT-OSS 120B افتراضي/);
    assert.match(ui.view(),/ملاحظات الدراسة: مفعّلة/);
    ui.handleAction('mentor-settings-toggle',{});
    assert.match(html,/mentor-share-study" checked/);
    assert.match(html,/mentor-share-notes" checked/);
    ui.handleAction('mentor-preview-data',{});
    assert.match(html,/&quot;activities&quot;/);
    assert.match(html,/my personal note/);
    ui.handleChange({target:{id:'mentor-share-notes',checked:false}});
    assert.equal(html.includes('my personal note'),false);
    assert.match(store.get('rihlati-mentor-preferences-v2'),/"shareNotes":false/);
    ui.handleAction('mentor-clear-chat',{});
    assert.match(html,/اسألني عن مراجعات اليوم/);
    const reopened=createMentorUI({getData:()=>d,render:()=>{},navigate:()=>{},openSurah:()=>{},openReview:()=>{},startQuiz:()=>{},toast:()=>{}});
    assert.match(reopened.view(),/ملاحظات الدراسة: متوقفة/);
  }finally{globalThis.document=prevDoc;globalThis.localStorage=prevStore;}
});
