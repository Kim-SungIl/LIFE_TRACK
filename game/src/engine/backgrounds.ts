export interface BgInfo {
  gradient: string;
  image?: string;
  overlay: string;
  mood: string;
}

export function getBackground(week: number, isVacation: boolean, mentalState: string): BgInfo {
  if (mentalState === 'burnout') {
    return {
      gradient: 'linear-gradient(180deg, #1e1e2e 0%, #1a1a2e 100%)',
      overlay: 'rgba(0,0,0,0.2)',
      mood: '',
      image: '/images/backgrounds/classroom_afternoon.png',
    };
  }

  if (week <= 8) return {
    gradient: 'linear-gradient(180deg, #2a1f3d 0%, #1f1a35 100%)',
    image: '/images/backgrounds/classroom_afternoon.png',
    overlay: 'rgba(252,200,220,0.03)',
    mood: '🌸',
  };
  if (week <= 19) return {
    gradient: 'linear-gradient(180deg, #1a2a3e 0%, #1a1a2e 100%)',
    image: '/images/backgrounds/classroom_afternoon.png',
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
    image: '/images/backgrounds/classroom_afternoon.png',
    overlay: 'rgba(255,183,77,0.03)',
    mood: '🍂',
  };
  if (week <= 42) return {
    gradient: 'linear-gradient(180deg, #1e2230 0%, #1a1a2e 100%)',
    image: '/images/backgrounds/classroom_afternoon.png',
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
