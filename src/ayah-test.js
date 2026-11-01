// Pure, UI-agnostic self-test flow. This module never grades Quran recitation
// or writes a completed review: it only hides/reveals authentic Quran text.
import { getMushafPageSegments } from './mushaf-core.js';

const keyOf = (surah, ayah) => `${surah}:${ayah}`;

export function ayahsOnMushafPage(page) {
  return getMushafPageSegments(page).flatMap(segment =>
    Array.from({length:segment.toAyah-segment.fromAyah+1}, (_,i)=>({
      surah:segment.surah,
      ayah:segment.fromAyah+i,
      key:keyOf(segment.surah,segment.fromAyah+i)
    }))
  );
}
export function createAyahTest(page, passage=null) {
  const all=ayahsOnMushafPage(page);
  const ayahs=passage ? all.filter(v=>v.surah===Number(passage.surah)&&v.ayah>=Number(passage.startAyah)&&v.ayah<=Number(passage.endAyah)) : all;
  if (!ayahs.length || (passage && (ayahs.length!==Number(passage.endAyah)-Number(passage.startAyah)+1 || Number(passage.page)!==page)))
    throw new Error('نطاق الاختبار لا ينتمي لهذه الصفحة.');
  return {page, ayahs, currentIndex:0, revealed:[], showAll:false, passage, lastRevealed:null, mistakeAyahs:[]};
}
export function revealCurrentAyah(state) {
  if (!state) throw new Error('لم يبدأ الاختبار.');
  const key=state.ayahs[state.currentIndex]?.key;
  return key && !state.revealed.includes(key)
    ? {...state,revealed:[...state.revealed,key],showAll:false}
    : {...state,showAll:false};
}
/**
 * Reveal the active Ayah and advance selection to the next hidden/visible Ayah
 * on the same page in one explicit user action. Never auto-advance off page.
 * At the last Ayah, stay put so the user can consciously finish the test.
 */
export function revealAndAdvanceAyah(state) {
  const revealed=revealCurrentAyah(state);
  const lastRevealed=revealed.ayahs[revealed.currentIndex]?.key||null;
  return revealed.currentIndex < revealed.ayahs.length-1
    ? {...revealed,currentIndex:revealed.currentIndex+1,lastRevealed}
    : {...revealed,lastRevealed};
}

export function moveTestCursor(state, amount) {
  if (!state) throw new Error('لم يبدأ الاختبار.');
  const currentIndex=Math.max(0,Math.min(state.ayahs.length-1,state.currentIndex+amount));
  return {...state,currentIndex,showAll:false};
}
export function toggleTestRevealAll(state) {
  if (!state) throw new Error('لم يبدأ الاختبار.');
  return {...state,showAll:!state.showAll};
}
export function resetAyahTest(state, page=state?.page) {
  return createAyahTest(page,page===state?.page?state?.passage:null);
}
export function toggleQuizMistake(state) {
  if(!state?.passage || !state.lastRevealed)return state;
  const ayah=Number(state.lastRevealed.split(':')[1]);
  const mistakes=state.mistakeAyahs||[];
  const mistakeAyahs=mistakes.includes(ayah) ? mistakes.filter(n=>n!==ayah) : [...mistakes,ayah].sort((a,b)=>a-b);
  return {...state,mistakeAyahs};
}

export function isTestAyahVisible(state, surah, ayah) {
  return Boolean(state && (state.showAll || state.revealed.includes(keyOf(surah,ayah))));
}
export function getAyahTestProgress(state) {
  if (!state) return null;
  return {
    total:state.ayahs.length,
    position:state.currentIndex+1,
    revealed:state.revealed.length,
    current:state.ayahs[state.currentIndex],
    isLast:state.currentIndex===state.ayahs.length-1,
    isFirst:state.currentIndex===0
  };
}
