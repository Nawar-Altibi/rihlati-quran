import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const darkStart=css.indexOf('/* Night Forest — accessible, consistent dark theme.');
const dark=css.slice(darkStart);
const light=css.slice(0,darkStart);
const hexToRgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
const luminance=h=>hexToRgb(h).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4)
  .reduce((acc,c,i)=>acc+c*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{
  const x=luminance(a),y=luminance(b);
  return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
};
function tokens(){
  const root=dark.match(/body\.dark\s*\{([^}]+)\}/);
  assert.ok(root,'body.dark token block missing');
  return Object.fromEntries([...root[1].matchAll(/(--[\w-]+):\s*(#[\da-f]{6})/ig)].map(x=>[x[1],x[2]]));
}
test('dark mode uses an independent, harmonious palette without altering the light palette',()=>{
  assert.ok(darkStart>0);
  assert.match(light,/:root\{--bg:/);
  const p=tokens();
  for(const key of ['--bg','--surface','--surface2','--text','--muted','--line','--green','--green2','--green-soft','--gold','--gold-soft','--red'])assert.ok(p[key],key);
  assert.notEqual(p['--bg'],'#f6f4ec');
  assert.equal(p['--bg'],'#101a17');
  assert.match(dark,/body\.dark\{\s*color-scheme:dark;/);
  assert.doesNotMatch(dark,/localStorage|migrateData|activityId/);
});
test('dark-mode copy, labels, accents and data statuses meet WCAG AA 4.5:1 color contrast',()=>{
  const p=tokens();
  for(const [name,a,b] of [
    ['page text','--text','--bg'],['card text','--text','--surface'],
    ['page secondary text','--muted','--bg'],['card secondary text','--muted','--surface'],
    ['card green accent','--green','--surface'],['soft green accent','--green','--green-soft'],
    ['gold accent','--gold','--surface'],['warning tint','--gold','--gold-soft'],
    ['error tint','--red','--surface']
  ])assert.ok(contrast(p[a],p[b])>=4.5,name+': '+contrast(p[a],p[b]).toFixed(2)+':1');
  assert.ok(contrast('#ffffff','#29744d')>=4.5,'green action button must support white text');
  assert.ok(contrast('#ede4cf','#24342d')>=7,'Quran text must meet AAA 7:1');
  assert.ok(contrast('#d8f6db','#30583b')>=4.5,'checked weekdays');
  assert.ok(contrast('#f3d99d','#493b25')>=4.5,'missed review pill');
  assert.ok(contrast('#c3f2cf','#294b35')>=4.5,'completed review pill');
});
test('dark styles cover every primary screen and colored Quran reader state',()=>{
  for(const selector of [
    'body.dark .sidebar','body.dark .topbar','body.dark .primary',
    'body.dark .secondary','body.dark .input','body.dark .journey-carry',
    'body.dark .journey-pill.missed','body.dark .journey-pill.done',
    'body.dark .settings-day-chip input:checked+span','body.dark .settings-hero',
    'body.dark .settings-theme-row','body.dark .mushaf-paper',
    'body.dark .mushaf-verse.selected','body.dark .mushaf-test-panel',
    'body.dark .mushaf-verses.is-test-mode .mushaf-verse.is-testing-current',
    'body.dark .modal','body.dark .nav-item.active'
  ])assert.ok(dark.includes(selector),'Missing dark mode override '+selector);
  assert.match(dark,/prefers-reduced-motion:reduce/);
});
