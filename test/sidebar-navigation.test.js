import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
test('advanced sidebar navigation has independent scroll access',()=>{
 const style=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/class="advanced-nav"/);
 assert.match(style,/\.sidebar nav\s*\{[^}]*overflow-y:\s*auto/s);
 assert.match(style,/\.sidebar nav\s*\{[^}]*min-height:\s*0/s);
 assert.match(style,/\.sidebar-bottom\s*\{[^}]*flex-shrink:\s*0/s);
});
test('mentor removed, Quran reader and quizzes remain intact',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
 const simple=readFileSync(new URL('../src/simple-ui.js',import.meta.url),'utf8');
 for(const source of [html,app,simple])assert.doesNotMatch(source,/mentor|مساعد رحلتي/i);
 for(const view of ['mushaf','quran','sessions','progress'])assert.ok(html.includes('data-view="'+view+'"'));
 assert.match(simple,/simple-quiz-random/);
 assert.ok(existsSync(new URL('../src/quiz-core.js',import.meta.url)));
 assert.ok(!existsSync(new URL('../src/mentor-ui.js',import.meta.url)));
});
