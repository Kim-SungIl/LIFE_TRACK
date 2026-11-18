export interface BgInfo {
  gradient: string;
  image?: string;
  overlay: string;
  mood: string;
  levelOverlay?: string;
}

export function getSchoolLevel(year: number): 'elementary' | 'middle' | 'high' {
  if (year <= 1) return 'elementary';
  if (year <= 4) return 'middle';
  return 'high';
}

// 학교급 색온도 tint — 계절 overlay 위에 1겹 가산되는 배경 전용 레이어.
// 초=따뜻(앰버)→중=중립→고=차가움(블루): 유년의 온기가 입시의 냉기로 식는 정서 서사.
// 극절제 alpha(0.03~0.05) — 눈치 못 챌 정도의 질감. 배경 레이어에만 얹혀 캐릭터 CG 무영향.
function getLevelTint(level: 'elementary' | 'middle' | 'high'): string {
  switch (level) {
    case 'elementary': return 'rgba(255,200,150,0.05)'; // 따뜻·노스탤지어
    case 'middle':     return 'rgba(215,205,220,0.03)'; // 전환기·중립
    case 'high':       return 'rgba(150,180,230,0.05)'; // 긴장·서늘함
  }
}

export type BgSeason = 'spring' | 'summer' | 'autumn' | 'winter';

/**
 * 주차(1~48) → 그림의 계절. 학년은 3월에 시작하고 한 달은 4주(weekMath 월 블록)다:
 * 3~5월(W1~12) 봄 · 6~8월(W13~24) 여름 · 9~11월(W25~36) 가을 · 12~2월(W37~48) 겨울.
 * 범위 밖(학년 전환 대기 W49 등)은 가장 가까운 끝으로 접는다 — 배경 고르기에서 throw할 이유가 없다.
 */
export function getBgSeason(week: number): BgSeason {
  const w = Math.min(48, Math.max(1, Math.floor(Number.isFinite(week) ? week : 1)));
  return (['spring', 'summer', 'autumn', 'winter'] as const)[Math.floor((w - 1) / 12)];
}

/**
 * 이벤트 배경 키 → 파일 경로. 자리표시자 둘을 런타임에 치환한다:
 * `{school}` = 학교급(getSchoolLevel) · `{season}` = 계절(getBgSeason, 사건이 열린 주 기준).
 * 계절 키는 week를 안 넘기면 봄으로 떨어진다 — 호출처는 반드시 주차를 넘길 것.
 */
export function getEventBackground(bgKey: string | undefined, year: number, week: number = 1): string | undefined {
  if (!bgKey) return undefined;
  const level = getSchoolLevel(year);
  return `/images/backgrounds/${bgKey.replace('{school}', level).replace('{season}', getBgSeason(week))}.png`;
}

export function getBackground(week: number, isVacation: boolean, mentalState: string, year: number = 1): BgInfo {
  const base = getSeasonBackground(week, isVacation, mentalState, year);
  // 번아웃은 자체 다크 무드 유지 — 학교급 tint 제외.
  if (mentalState === 'burnout') return base;
  return { ...base, levelOverlay: getLevelTint(getSchoolLevel(year)) };
}

function getSeasonBackground(week: number, isVacation: boolean, mentalState: string, year: number): BgInfo {
  const level = getSchoolLevel(year);
  const classroom = `/images/backgrounds/classroom_${level}_afternoon.png`;

  if (mentalState === 'burnout') {
    return {
      gradient: 'linear-gradient(180deg, #1e1e2e 0%, #1a1a2e 100%)',
      overlay: 'rgba(0,0,0,0.2)',
      mood: '',
      image: classroom,
    };
  }

  if (week <= 8) return {
    gradient: 'linear-gradient(180deg, #2a1f3d 0%, #1f1a35 100%)',
    image: `/images/backgrounds/classroom_${level}_spring.png`,
    overlay: 'rgba(252,200,220,0.03)',
    mood: '🌸',
  };
  if (week <= 19) return {
    gradient: 'linear-gradient(180deg, #1a2a3e 0%, #1a1a2e 100%)',
    image: classroom,
    overlay: 'rgba(144,202,249,0.03)',
    mood: '☀️',
  };
  if (week <= 24) return {
    gradient: 'linear-gradient(180deg, #1a2e35 0%, #1a1a2e 100%)',
    image: '/images/backgrounds/park_spring.png',
    overlay: 'rgba(77,208,225,0.03)',
    mood: '🌊',
  };
  if (week <= 34) return {
    gradient: 'linear-gradient(180deg, #2e2215 0%, #1a1a2e 100%)',
    image: `/images/backgrounds/classroom_${level}_sunset.png`,
    overlay: 'rgba(255,183,77,0.03)',
    mood: '🍂',
  };
  if (week <= 42) return {
    gradient: 'linear-gradient(180deg, #1e2230 0%, #1a1a2e 100%)',
    image: classroom,
    overlay: 'rgba(176,190,197,0.03)',
    mood: '❄️',
  };
  return {
    gradient: 'linear-gradient(180deg, #1e1e35 0%, #1a1a2e 100%)',
    image: '/images/backgrounds/home_evening.png',
    overlay: 'rgba(159,168,218,0.03)',
    mood: '❄️',
  };
}

// 이벤트 location 별 그라데이션 — EventScene + EventResultScreen 공유 SSOT.
// (이전엔 EventScene 에서 export 후 EventResultScreen 이 cross-import 했음)
export const LOCATION_GRADIENTS: Record<string, string> = {
  classroom: 'linear-gradient(180deg, #3a2f42 0%, #241a2a 100%)',
  home: 'linear-gradient(180deg, #3d2b1f 0%, #2a1f15 100%)',
  park: 'linear-gradient(180deg, #1e3a26 0%, #13281a 100%)',
  hallway: 'linear-gradient(180deg, #3a3342 0%, #241f28 100%)',
  rooftop: 'linear-gradient(180deg, #4a5a85 0%, #2c3a58 100%)',
  street: 'linear-gradient(180deg, #4a3f5c 0%, #2a2535 100%)',
  gym: 'linear-gradient(180deg, #5c3a2a 0%, #3a2518 100%)',
  school_gate: 'linear-gradient(180deg, #3a5c4a 0%, #1a3a28 100%)',
  cafe: 'linear-gradient(180deg, #5c4a3a 0%, #3a2f20 100%)',
  music_room: 'linear-gradient(180deg, #3a2f5c 0%, #2a1f3a 100%)',
  beach: 'linear-gradient(180deg, #4a8ab5 0%, #2a5a80 100%)',
  convenience_store: 'linear-gradient(180deg, #4a5c3a 0%, #2a3a20 100%)',
  library: 'linear-gradient(180deg, #3a3346 0%, #1f1929 100%)',
  auditorium: 'linear-gradient(180deg, #5c4a4a 0%, #3a2a2a 100%)',
};

export const DEFAULT_GRADIENT = 'linear-gradient(180deg, #1f1a25 0%, #17151c 100%)';
