// 기억 시각 언어의 **토큰** — 엠블럼·색·톤 필터·패널. 컴포넌트는 memoryVisuals.tsx.
// (한 파일에 두면 react-refresh 규칙에 걸린다: 컴포넌트와 상수를 같이 export할 수 없다.)
//
// 기억을 그림으로 보여주는 공통 언어 — 학년말 회고(YearEndScreen)와 7년의 끝(EndingScreen)이 공유한다.
//
// 원래 YearEndScreen 안에만 있었다. 엔딩 회상에 같은 형태가 필요해지면서 꺼냈다 —
// 복사하면 두 화면의 톤이 갈라지고(패치워크), 무엇보다 아래 "작은 칸엔 CG를 쓰지 않는다"는
// 판단이 한쪽에서만 지켜지는 상태가 된다. 동작 변경은 없다(순수 이동).
//
// 규칙 두 줄로 요약하면:
//   큰 자리(HeroGallery) = CG.        작은 자리(MemoryThumb) = NPC 초상 → 카테고리 엠블럼.
//   세 이미지 타입 전부 같은 "바랜 일기장" 필터로 묶어 한 시스템처럼 보이게 한다.
import { MemorySlot, MemoryCategory, ToneTag } from '../../engine/types';

// 카테고리별 엠블럼(전용 아트 P1b) + 한글 라벨.
// CG도 NPC 초상도 없는 기억의 최후 폴백 이미지. 아트는 emblems/{artKey}.png (4:5, 480×600).
// emoji는 art 로드 실패 시 폴백(안전망) + 라벨 보조. 색은 STAT_GRADES 색 언어와 통일.
// reconciliation은 growth(초록)와 겹치지 않게 청록으로 분리. failure ☔는 VS16 없는 코드포인트(구버전 □ 회피).
// artKey만 담고 URL은 조립하지 않는다 — 경로를 만드는 파일은 webpSrc를 반드시 경유해야
// 하고(assetUrlContract 소스 스캔), 그 감싸기는 실제로 그리는 MemoryThumb의 몫이다.
export type CatInfo = { emoji: string; label: string; color: string; artKey: string };
export const CATEGORY: Record<MemoryCategory, CatInfo> = {
  courage:        { emoji: '🔥', label: '용기',     color: '#e0a45e', artKey: 'courage' },
  betrayal:       { emoji: '💔', label: '상처',     color: '#d96458', artKey: 'betrayal' },
  reconciliation: { emoji: '🤝', label: '화해',     color: '#6fa890', artKey: 'reconciliation' },
  failure:        { emoji: '☔', label: '실패',     color: '#7c89a8', artKey: 'failure' },
  discovery:      { emoji: '💡', label: '깨달음',   color: '#e0b354', artKey: 'discovery' },
  growth:         { emoji: '🌱', label: '성장',     color: '#8fb573', artKey: 'growth' },
  bypass:         { emoji: '💸', label: '우회',     color: '#a89888', artKey: 'bypass' },
  unspoken_debt:  { emoji: '✉️', label: '말없는 빚', color: '#caa17a', artKey: 'unspoken_debt' },
};
export const CATEGORY_FALLBACK: CatInfo = { emoji: '🕊️', label: '기억', color: '#a89888', artKey: 'memory' };
// 레거시/마이그레이션 세이브에 미지 카테고리가 들어와도 화면 전체가 죽지 않게 폴백.
export const catOf = (c: string): CatInfo => CATEGORY[c as MemoryCategory] ?? CATEGORY_FALLBACK;

// 회상 카드/마무리 블록 공통 다크 스크림 패널 (교실 배경 위 가독성)
export const PANEL: React.CSSProperties = {
  background: 'rgba(20,17,26,0.55)',
  backdropFilter: 'blur(3px)',
  WebkitBackdropFilter: 'blur(3px)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 14,
};
export const TEXT_SHADOW = '0 1px 4px rgba(0,0,0,0.55)';
// 세 이미지 타입(hero CG·NPC 초상·엠블럼)을 "바랜 일기장" 한 톤으로 묶는 공통 필터 — 패치워크 방지.
// toneTag 없는 기억의 기본값이기도 하다.
export const DIARY_FILTER = 'saturate(0.82) sepia(0.12) brightness(0.98)';
// 기억의 정서(toneTag)를 "색온도"로 — 같은 일기장 톤 안에서 따뜻함(sepia↑·밝게)↔차가움(채도↓·어둡게)만 미세 조정.
// hue-rotate는 sepia와 겹치면 탁해져서 안 씀(온도를 sepia·brightness·saturate 축으로만 표현).
export const TONE_FILTER: Record<ToneTag, string> = {
  warm:         'saturate(0.88) sepia(0.24) brightness(1.02)',  // 따뜻·살아있음
  breakthrough: 'saturate(0.95) sepia(0.14) brightness(1.07)',  // 환하게 트임
  resolve:      'saturate(0.86) sepia(0.18) brightness(1.00)',  // 단단·약한 온기
  regret:       'saturate(0.72) sepia(0.06) brightness(0.94)',  // 식어감
  melancholy:   'saturate(0.66) sepia(0.04) brightness(0.91)',  // 가장 차갑게
  burden:       'saturate(0.70) sepia(0.12) brightness(0.88)',  // 무겁게 가라앉음
};
export const toneFilter = (tone?: ToneTag): string => (tone ? TONE_FILTER[tone] : DIARY_FILTER);
// hero(큰 focal) 패널에만 얹는 옅은 색온도 글로우 — 이미지 필터 차이가 작아, 정서가 "공기"로도 느껴지게.
export const TONE_GLOW: Record<ToneTag, string> = {
  warm: '#e0a86a', breakthrough: '#f0c060', resolve: '#d8a878',
  regret: '#8295b2', melancholy: '#7488aa', burden: '#8a8296',
};

export type CgItem = { slot: MemorySlot; cg: string };
