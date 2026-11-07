import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('account entry is in the sticky top bar, not hidden beneath sidebar content',()=>{
  const html=read('../index.html');
  const first=html.indexOf('id="account-entry"');
  assert.notEqual(first,-1);
  assert.equal(html.split('id="account-entry"').length-1,1);
  assert.ok(first>html.indexOf('<header class="topbar">'));
  assert.ok(first<html.indexOf('</header>'));
  const css=read('../styles.css');
  assert.match(css,/\.topbar \.account-entry\s*\{/);
  assert.match(css,/@media\(max-width:760px\)\s*\{[\s\S]*?\.topbar \.account-entry/);
});

test('public sign-in dialog offers only Google, without email or password actions',()=>{
  const source=read('../src/account-ui.js');
  const start=source.indexOf("if(modal==='login')content=");
  const end=source.indexOf("if(modal==='signup')content=");
  assert.ok(start>=0&&end>start);
  const login=source.slice(start,end);
  assert.match(login,/data-google-auth/);
  assert.match(login,/المتابعة باستخدام Google/);
  assert.doesNotMatch(login,/data-account-form="login"|data-account-action="signup"|data-account-action="recover"|أو المتابعة بالبريد الإلكتروني/);
  assert.doesNotMatch(login,/htmlInput\('password'/);
});

test('account dashboard still allows safe sign-out and guest restoration',()=>{
  const source=read('../src/account-ui.js');
  assert.match(source,/account-dashboard-actions/);
  assert.match(source,/تسجيل الخروج/);
  assert.match(source,/await post\('logout'\)/);
  assert.match(source,/restoreGuest\(\);buttonView\(\)/);
});
