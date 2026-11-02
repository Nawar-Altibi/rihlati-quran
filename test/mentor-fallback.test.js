import test from 'node:test';
import assert from 'node:assert/strict';
import {makeInitialData} from '../src/data.js';
import {createMentorUI} from '../src/mentor-ui.js';

test('429 quota exhaustion automatically renders the local answer without another question',async()=>{
  const data=makeInitialData();
  const prev={document:globalThis.document,fetch:globalThis.fetch,localStorage:globalThis.localStorage};
  const calls=[];
  globalThis.document={querySelector:selector=>selector==='#mentor-question-form'?{}:null};
  globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
  globalThis.fetch=async(url,options)=>{
    calls.push({url,options});
    if(url==='/api/mentor/session')return new Response(JSON.stringify({authenticated:true}),{status:200,headers:{'Content-Type':'application/json'}});
    if(url==='/api/mentor')return new Response(JSON.stringify({error:'انتهت الحصة اليومية'}),{status:429,headers:{'Content-Type':'application/json'}});
    throw Error('unexpected');
  };
  let ui,markup='',tick=()=>new Promise(r=>setTimeout(r,15));
  const render=()=>{markup=ui.view();};
  ui=createMentorUI({getData:()=>data,render,navigate:()=>{},openSurah:()=>{},openReview:()=>{},startQuiz:()=>{},toast:()=>{}});
  try{
    ui.afterRender();await tick();
    ui.handleSubmit({target:{id:'mentor-question-form',elements:{question:{value:'شو لازم راجع اليوم؟'}}},preventDefault(){}});
    await tick();
    assert.match(markup,/اكتملت حصة الذكاء الاصطناعي/);
    assert.match(markup,/انتقلت تلقائيًا للمساعد المحلي/);
    assert.match(markup,/اقتراحي لوردك اليوم/);
    assert.equal(calls.filter(c=>c.url==='/api/mentor').length,1);
    assert.equal(calls.filter(c=>c.url==='/api/mentor')[0].options.credentials,'same-origin');
    assert.equal(JSON.stringify(calls).includes('X-Mentor-Token'),false);
  }finally{
    globalThis.document=prev.document;globalThis.fetch=prev.fetch;globalThis.localStorage=prev.localStorage;
  }
});
