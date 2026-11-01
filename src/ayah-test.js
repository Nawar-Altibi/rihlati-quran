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
export function createAyahTest(page) {
  const ayahs=ayahsOnMushafPage(page);
  if (!ayahs.length) throw new Error('لا توجد آيات لهذه الصفحة.');
  return {page, ayahs, currentIndex:0, revealed:[], showAll:false};
}
export function revealCurrentAyah(state) {
  if (!state) throw new Error('لم يبدأ الاختبار.');
  const key=state.ayahs[state.currentIndex]?.key;
  return key && !state.revealed.includes(key)
    ? {...state,revealed:[...state.revealed,key],showAll:false}
    : {...state,showAll:false};
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
  return createAyahTest(page);
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
