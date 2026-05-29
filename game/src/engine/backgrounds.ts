export interface BgInfo {
  gradient: string;
  image?: string;
  overlay: string;
  mood: string;
}

export function getSchoolLevel(year: number): 'elementary' | 'middle' | 'high' {
  if (year <= 1) return 'elementary';
  if (year <= 4) return 'middle';
  return 'high';
}

export function getEventBackground(bgKey: string | undefined, year: number): string | undefined {
  if (!bgKey) return undefined;
  const level = getSchoolLevel(year);
  return `/images/backgrounds/${bgKey.replace('{school}', level)}.png`;
}

export function getBackground(week: number, isVacation: boolean, mentalState: string, year: number = 1): BgInfo {
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
