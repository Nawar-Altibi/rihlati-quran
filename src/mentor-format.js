// Deliberately small Markdown subset for untrusted AI text.
// Escapes HTML *before* allowing controlled formatting; no raw HTML,
// remote images, scripts or links can be injected through model responses.
export const escapeMentorHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

function inlineFormat(raw) {
  let text=escapeMentorHTML(raw);
  text=text.replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>');
  text=text.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g,'<em>$1</em>');
  text=text.replace(/`([^`\n]+)`/g,'<code>$1</code>');
  return text;
}
const heading=/^\s{0,3}(#{1,3})\s+(.+)$/;
const bullet=/^\s*[-•*]\s+(.+)$/;
const numbered=/^\s*[0-9٠-٩]+[.)،]\s+(.+)$/;

export function formatMentorAnswer(input) {
  const lines=String(input||'').replace(/\r\n?/g,'\n').slice(0,6000).split('\n');
  const out=[];
  let group=null,paragraph=[];
  const flushText=()=>{
    if(!paragraph.length)return;
    out.push('<p>'+inlineFormat(paragraph.join(' '))+'</p>');
    paragraph=[];
  };
  const flushGroup=()=>{
    if(!group)return;
    out.push('</'+group+'>');
    group=null;
  };
  for(const original of lines) {
    const line=original.trim();
    if(!line){flushText();flushGroup();continue;}
    const h=line.match(heading);
    if(h) {
      flushText();flushGroup();
      const level=Math.min(5,h[1].length+1);
      out.push('<h'+level+'>'+inlineFormat(h[2])+'</h'+level+'>');
      continue;
    }
    const li=line.match(numbered)||line.match(bullet);
    if(li){
      flushText();
      const desired=line.match(numbered)?'ol':'ul';
      if(group!==desired){flushGroup();out.push('<'+desired+'>');group=desired;}
      out.push('<li>'+inlineFormat(li[1])+'</li>');
      continue;
    }
    flushGroup();
    paragraph.push(line);
  }
  flushText();flushGroup();
  return out.join('')||'<p>ما وصل جواب قابل للعرض.</p>';
}
