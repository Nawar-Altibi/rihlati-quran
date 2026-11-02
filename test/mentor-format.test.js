import test from 'node:test';
import assert from 'node:assert/strict';
import {formatMentorAnswer,escapeMentorHTML} from '../src/mentor-format.js';

test('AI headings, numbered plans, bullet points and emphasis are actual HTML markup',()=>{
  const raw='## الخطة المقترحة (30 دقيقة)\n\n**الخلاصة:** راجع سورة عبس.\n\n1. **المرحلة الأولى:** راجع الآيات 1–5\n2. التثبيت 10 دقائق\n\n### نصائح\n- اقرأ من حفظك\n- سجّل مواضع الخطأ';
  const html=formatMentorAnswer(raw);
  assert.match(html,/<h3>الخطة المقترحة/);
  assert.match(html,/<p><strong>الخلاصة:<\/strong> راجع سورة عبس.<\/p>/);
  assert.match(html,/<ol><li><strong>المرحلة الأولى:/);
  assert.match(html,/<ul><li>اقرأ من حفظك<\/li>/);
  assert.equal(html.includes('**'),false);
});
test('untrusted AI content is escaped, never interpreted as scripts, raw tags or links',()=>{
  const html=formatMentorAnswer('## <img src=x onerror=alert(1)>\n\n<script>alert("hi")</script>\n- **احذر** <iframe src=x>');
  assert.equal(html.includes('<script>'),false);
  assert.equal(html.includes('<iframe'),false);
  assert.equal(html.includes('<img'),false);
  assert.match(html,/&lt;script&gt;/);
  assert.match(html,/<strong>احذر<\/strong>/);
  assert.match(escapeMentorHTML('&\'"<>'),/&amp;/);
});
test('simple conversational paragraphs and Arabic-digit lists remain legible',()=>{
  const html=formatMentorAnswer('شو لازم راجع؟\nلهيك ركّز على عبس.\n\n١. أولًا راجع\n٢. ثانيًا سمّع');
  assert.match(html,/شو لازم راجع؟ لهيك ركّز على عبس/);
  assert.match(html,/<ol><li>أولًا راجع/);
  assert.match(html,/<li>ثانيًا سمّع<\/li><\/ol>/);
});
