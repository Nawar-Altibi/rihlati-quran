import test from 'node:test';
import assert from 'node:assert/strict';
import { createMushafUI } from '../src/mushaf-ui.js';
import { SURAH_NAMES, makeInitialData } from '../src/data.js';
import { quizSummary } from '../src/quiz-core.js';

test('Mushaf quiz UI action chain marks a revealed Ayah and persists only an explicit self-test record',()=>{
  const data=makeInitialData(),surah=58;
  data.quizAttempts=[];
  const priorActivities=data.activities.length,priorRevisions=data.revisions.length;
  const tracked={
    id:'test-mem',method:'ayah',surah,startAyah:1,endAyah:4,
    status:'محفوظ حديثًا',pages:0.5
  };
  data.units.push(tracked);
  let renders=0, persistCalls=0,markup='',viewName='',toasts=[];
  const originalDocument=globalThis.document;
  // Test the UI action controller with an isolated minimal DOM adapter; no live
  // Quran source is requested and no user's persistent storage is modified.
  globalThis.document={querySelector:()=>null};
  let ui;
  const render=()=>{renders++;markup=ui.view();};
  const persist=()=>{persistCalls++;return true;};
  const navigate=name=>{viewName=name;render();};
  try {
    ui=createMushafUI({
      getData:()=>data,persist,render,navigate,
      toast:message=>toasts.push(message),
      openReview:()=>{}
    });
    assert.equal(ui.startRandomQuiz('random'),true);
    assert.equal(viewName,'mushaf');
    assert.match(markup,/مقطع عشوائي/);
    assert.match(markup,/الآيات 1–4/);
    assert.match(markup,/الآية 1 من 4/);
    assert.equal(data.quizAttempts.length,0);
    // No partial test can be recorded as complete.
    ui.handleAction('mushaf-quiz-finish',null);
    assert.equal(data.quizAttempts.length,0);
    assert.match(toasts.at(-1),/اكشف آيات المقطع/);
    // Reveal first, auto-advance, mark the one user-reported error.
    ui.handleAction('mushaf-test-reveal',null);
    assert.match(markup,/الآية 2 من 4/);
    assert.match(markup,/أخطأت في الآية 1/);
    ui.handleAction('mushaf-quiz-mark',null);
    assert.match(markup,/تراجع عن خطأ الآية 1/);
    // Complete all 4 explicit reveal steps.
    for(let i=0;i<3;i++)ui.handleAction('mushaf-test-reveal',null);
    assert.match(markup,/الآية 4 من 4/);
    ui.handleAction('mushaf-quiz-finish',null);
    assert.equal(data.quizAttempts.length,1);
    assert.deepEqual(data.quizAttempts[0].mistakeAyahs,[1]);
    assert.equal(data.quizAttempts[0].verifiedByTeacher,false);
    assert.equal(data.activities.length,priorActivities);
    assert.equal(data.revisions.length,priorRevisions);
    assert.equal(tracked.status,'محفوظ حديثًا');
    assert.equal(quizSummary(data).weakLocations[0].surah,58);
    assert.equal(quizSummary(data).weakLocations[0].ayah,1);
    assert.ok(persistCalls>=1);
    assert.ok(renders>=5);
    // Launch weak mode: the next excerpt must contain the recorded missed Ayah.
    assert.equal(ui.startRandomQuiz('weak'),true);
    assert.match(markup,/سورة المجادلة/);
    assert.match(markup,/مقطع عشوائي/);
    assert.match(markup,/الآيات 1–4/);
  }finally{globalThis.document=originalDocument;}
});
