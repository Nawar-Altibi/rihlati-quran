// Minimal embedded Lucide SVG subset (ISC; some Feather-derived icons MIT).
// See licenses/lucide-icons-LICENSE.txt. Inline icons work fully offline.
const paths={
  home:'<path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-7h6v7"/>',
  book:'<path d="M12 7v14"/><path d="M3 18V5a2 2 0 0 1 2-2h3a4 4 0 0 1 4 4 4 4 0 0 1 4-4h3a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-3a4 4 0 0 0-4 1 4 4 0 0 0-4-1H5a2 2 0 0 1-2-2Z"/>',
  plan:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v18M12 8h4M12 12h4M12 16h4"/>',
  mic:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/>',
  chart:'<path d="M3 3v18h18M7 16v-4M12 16V8M17 16V5"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  archive:'<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v12h14V8M10 12h4"/>',
  refresh:'<path d="M3 12a9 9 0 0 1 15-6l3 3M21 3v6h-6M21 12a9 9 0 0 1-15 6l-3-3M3 21v-6h6"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  settings:'<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06-1.91 1.91-.06-.06A1.65 1.65 0 0 0 16 18.4a1.65 1.65 0 0 0-1 .58V21h-2v-2.02a1.65 1.65 0 0 0-2 0V21H9v-2.02a1.65 1.65 0 0 0-1-.58 1.65 1.65 0 0 0-1.82.33l-.06.06-1.91-1.91.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.58-1H2v-2h2.02a1.65 1.65 0 0 0 .58-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06 1.91-1.91.06.06A1.65 1.65 0 0 0 8 7.6a1.65 1.65 0 0 0 1-.58V5h2v2.02a1.65 1.65 0 0 0 2 0V5h2v2.02a1.65 1.65 0 0 0 1 .58 1.65 1.65 0 0 0 1.82-.33l.06-.06 1.91 1.91-.06.06A1.65 1.65 0 0 0 19.4 11a1.65 1.65 0 0 0 .58 1H22v2h-2.02a1.65 1.65 0 0 0-.58 1Z"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  checkcircle:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  moon:'<path d="M20 15.1A8.6 8.6 0 0 1 8.9 4a9 9 0 1 0 11.1 11.1Z"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  sparkle:'<path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3ZM19 17l.6 1.4L21 19l-1.4.6L19 21l-.6-1.4L17 19l1.4-.6L19 17Z"/>',
  chevron:'<path d="m6 9 6 6 6-6"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  layers:'<path d="m12 2 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 17l9 5 9-5"/>',
  file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  bars:'<path d="M4 20V9M10 20V4M16 20v-7M22 20v-9"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>'
};
export function uiIcon(name,size=20){
  const path=paths[name]||paths.sparkle;
  const dimension=Number.isFinite(Number(size))?Math.min(36,Math.max(14,Number(size))):20;
  return '<svg class="ui-vector" xmlns="http://www.w3.org/2000/svg" width="'+dimension+'" height="'+dimension+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+path+'</svg>';
}
const sidebarIcons={today:'home',mushaf:'book',quran:'plan',sessions:'mic',progress:'chart',dashboard:'grid',memorize:'archive',revision:'refresh',plan:'layers',calendar:'calendar',analytics:'bars',settings:'settings'};
export function applySidebarVectors(){
  if(typeof document==='undefined')return;
  for(const button of document.querySelectorAll('.sidebar [data-view]')){
    const span=button.querySelector('.nav-icon'),name=sidebarIcons[button.dataset.view];
    if(span && name)span.innerHTML=uiIcon(name,19);
  }
  const mark=document.querySelector('.brand-mark');
  if(mark){mark.classList.add('brand-vector');mark.innerHTML='<span class="brand-vector-frame">'+uiIcon('book',23)+'</span>';}
  const tools={ 'quick-add':'plus','theme-toggle':'moon','mobile-menu':'menu'};
  for(const [id,name] of Object.entries(tools)){
    const button=document.querySelector('#'+id);
    if(button)button.innerHTML=uiIcon(name,19);
  }
}
