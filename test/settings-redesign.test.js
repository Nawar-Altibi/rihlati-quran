import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeInitialData,SURAH_NAMES} from '../src/data.js';
import {renderSettingsUI} from '../src/settings-ui.js';
import {uiIcon,applySidebarVectors} from '../src/ui-icons.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const view=(data=makeInitialData())=>renderSettingsUI(data.settings,{esc,SURAH_NAMES});

test('settings displays compact groups and keeps all existing auto-save control IDs',()=>{
  const html=view();
  for(const id of ['set-target','set-custom','set-minutes','set-recitation','set-tracking','set-edition','set-start','set-intervals','set-dark','import-file'])
    assert.match(html,new RegExp('id="'+id+'"'),'Missing '+id);
  assert.match(html,/class="settings-layout"/);
  assert.match(html,/class="settings-column"/);
  assert.match(html,/class="settings-weekly"/);
  assert.match(html,/name="memo-days"/);
  assert.match(html,/name="review-days"/);
  assert.match(html,/data-action="export"/);
  assert.match(html,/data-action="import"/);
});
test('advanced settings compact by default and preserve every phase/month editable input',()=>{
  const data=makeInitialData(),html=view(data);
  const count=(x,pattern)=>(x.match(pattern)||[]).length;
  assert.equal(count(html,/<details class="settings-disclosure"/g),2);
  assert.ok(count(html,/<details class="settings-disclosure/g)>=3);
  assert.doesNotMatch(html,/<details[^>]*open/);
  for(let i=0;i<data.settings.phases.length;i++)
    for(const marker of ['data-phase-title','data-phase-detail','data-phase-status'])
      assert.match(html,new RegExp(marker+'="'+i+'"'));
  for(let i=0;i<data.settings.monthlyPlan.length;i++)
    for(const marker of ['data-month-title','data-month-detail'])
      assert.match(html,new RegExp(marker+'="'+i+'"'));
  assert.match(html,/data-action="save-plans"/);
  assert.match(html,/data-action="reset"/);
});
test('control values, safe escaping, and checked weekdays survive markup refactor',()=>{
  const data=makeInitialData();
  data.settings.memorizationDays=[1,3];
  data.settings.revisionDays=[2,5];
  data.settings.mushafEdition='Test" onfocus="alert(1)';
  data.settings.phases[0].title='<script>alert("x")</script>';
  data.settings.theme='dark';
  const html=view(data);
  assert.match(html,/name="memo-days" value="1" checked/);
  assert.match(html,/name="review-days" value="5" checked/);
  assert.match(html,/id="set-dark" checked/);
  assert.equal(html.includes('<script>'),false);
  assert.match(html,/&lt;script&gt;/);
  assert.match(html,/&quot; onfocus=&quot;/);
});
test('sidebar vector icons are real valid scalable SVG with no runtime CDN dependency',()=>{
  for(const icon of ['home','book','plan','calendar','settings','shield','download','upload','target','refresh']){
    const svg=uiIcon(icon);
    assert.match(svg,/^<svg /);
    assert.match(svg,/viewBox="0 0 24 24"/);
    assert.match(svg,/<\/svg>$/);
  }
  assert.equal(uiIcon('custom-user-provided').includes('<script'),false);
  const prevDoc=globalThis.document;
  const spans=[],brand={classList:{add(){}},innerHTML:''};
  globalThis.document={querySelectorAll:()=>[
    {dataset:{view:'today'},querySelector:()=>{const x={innerHTML:''};spans.push(x);return x;}},
    {dataset:{view:'settings'},querySelector:()=>{const x={innerHTML:''};spans.push(x);return x;}}
  ],querySelector:selector=>selector==='.brand-mark'?brand:null};
  try{applySidebarVectors();assert.ok(spans.every(x=>x.innerHTML.includes('<svg')));assert.match(brand.innerHTML,/brand-vector-frame/);}
  finally{globalThis.document=prevDoc;}
});
test('styling includes responsive layout, no fixed tall whitespace and reduced-motion support',()=>{
  const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
  assert.match(css,/\.settings-layout\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/\.settings-column\{display:grid;gap:14px/);
  assert.match(css,/@media\(max-width:1070px\)/);
  assert.match(css,/@media\(max-width:380px\)/);
  assert.match(css,/prefers-reduced-motion/);
});
