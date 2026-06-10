// 엔딩 산정 — 7년 종료 후의 진로/회상/행복도 결정.
// gameEngine.ts 에서 추출 (P2-6). 학년말 카드(YearEndScreen)도 calculateHappinessGrade 를 공유.
import { GameState } from './types';
import { selectMemorialHighlights } from './memorySystem';

// ===== 행복 등급 =====
// mental + social 조합으로 한 해/일생의 행복도를 5단계로 분류.
// calculateEnding(엔딩 누적)과 학년말 카드 둘 다 동일 산식 — 일관된 시그널.
export type HappinessGrade = 'S' | 'A' | 'B' | 'C' | 'D';

// QA C1-B: health 하한 게이트. health<20(achievement 약점선과 동일)이면 S 불가 → 최고 A.
// 건강을 끝까지 갈아넣은 한 해는 "빛났던 해"가 될 수 없다 — happiness 전원 S 수렴을 깨는 첫 분기.
// health 기본값 100: 인자 미전달 호출(레거시) 호환.
export function calculateHappinessGrade(mental: number, social: number, health = 100): HappinessGrade {
  if (mental >= 80 && social >= 60 && health >= 20) return 'S';
  if (mental >= 60 && social >= 40) return 'A';
  if (mental >= 40) return 'B';
  if (mental >= 25) return 'C';
  return 'D';
}

export const HAPPINESS_LABELS: Record<HappinessGrade, { title: string; desc: string }> = {
  S: { title: '🌟 빛났던 한 해', desc: '마음도 단단했고, 곁에 사람도 많았다.' },
  A: { title: '😊 따뜻한 한 해', desc: '걱정도 있었지만, 같이 웃을 사람이 있었다.' },
  B: { title: '🙂 평범한 한 해', desc: '특별한 일은 없었지만 무탈했다.' },
  C: { title: '😐 외로운 한 해', desc: '마음이 자주 비어 있던 한 해.' },
  D: { title: '😔 힘들었던 한 해', desc: '돌아보면 버티는 것만으로 벅찼다.' },
};

// ===== 진로 판정 =====
// 수능 등급 + 문이과 + 특기를 기반으로 "진로" 결정
function determineCareer(state: GameState): { path: string; detail: string } {
  const suneung = state.examResults.find(e => e.examType === 'suneung');
  const mockGrade = suneung?.mockGrade ?? 9; // 수능 없으면 9등급 취급
  const { academic, talent, mental } = state.stats;
  const track = state.track;

  // 예체능 특기자 최우선 체크 (수능 등급과 무관하게 talent 우위이면 특기자 루트)
  // academic 낮아도 특기로 대학 가는 실제 진로 반영
  if (talent >= 85) {
    // QA C5-A: talent≥90이라도 academic이 충분히 높으면 특기자로 강제하지 않고 아래 일반 진로(의대/SKY 등)로 보낸다.
    //          이전엔 talent≥90이 수능·학업 무관 최우선 return이라 학업·특기 겸비(talent95/academic92)도
    //          「예술/체육 특기자」로 덮어써져 상위 학업 엔딩을 강탈당하던 hard cliff였다.
    if (talent >= 90 && academic < 80) return { path: '예술/체육 특기자', detail: '특기로 명문 예술대학·체대에 진학했다.' };
    if (academic < 70) return { path: '예체능 진학', detail: '특기를 살려 예체능 계열 대학에 진학했다.' };
    // talent 85~89 (또는 talent 90+ & academic 80+) → 특기 + 학업 균형 → 아래 일반 진로 로직에서 결정
  }

  // 번아웃 심각 AND 멘탈 현재 상태도 바닥일 때만 방황
  // M5 Phase 2: OR → AND. 이전엔 burnoutCount≥4만으로 재수 확정되어 모든 패턴이 재수로 수렴.
  // 번아웃 이력이 많아도 졸업 직전 회복했으면 정상 진학 가능해야 함.
  if (state.burnoutCount >= 4 && mental < 30) {
    return { path: '재수 결심', detail: '올해는 결과가 좋지 않았다. 1년 더 해보기로 했다.' };
  }
  if (mental < 15) {
    return { path: '잠시 쉼표', detail: '대학보다 자신을 돌보는 게 먼저였다.' };
  }

  // 수능 7등급 이하 — 입시 실패 루트
  if (mockGrade >= 7) {
    if (state.burnoutCount >= 2) return { path: '잠시 쉼표', detail: '대학보다 자신을 돌보는 게 먼저였다.' };
    return { path: '전문대 / 재수', detail: '원하는 곳은 못 갔다. 다른 길을 찾아야 한다.' };
  }

  // M5 Phase 2: mockGrade 5~6 분기 추가 (이전엔 ≥7 또는 ≤4만 있고 5~6은 track 경로에서 지방국립대로 떨어짐)
  // 5~6등급은 실제로 지방 4년제 or 전문대 중간 지대
  if (mockGrade >= 5 && !track) {
    return { path: '지방 4년제', detail: '지방 4년제에 합격했다. 여기서 다시 시작이다.' };
  }

  // 문과 진로
  if (track === 'humanities') {
    if (mockGrade <= 1) {
      if (academic >= 85 && mental >= 50) return { path: 'SKY 경영대 합격', detail: '전국 수석권. 원하는 대학 어디든 갈 수 있다.' };
      return { path: 'SKY 인문대 합격', detail: '오랜 노력의 결실. 명문대 합격 통지서를 받았다.' };
    }
    if (mockGrade === 2) return { path: '인서울 상위권 대학', detail: '중앙대·경희대 수준의 문과 상위권에 합격했다.' };
    if (mockGrade === 3) return { path: '인서울 문과', detail: '인서울 문과 대학에 합격했다. 나쁘지 않은 결과다.' };
    if (mockGrade === 4) return { path: '수도권 대학', detail: '수도권 4년제에 합격. 이제 본격적인 시작이다.' };
    return { path: '지방 국립대', detail: '지방 국립대 문과에 합격했다. 길은 여기서부터다.' };
  }

  // 이과 진로
  if (track === 'science') {
    if (mockGrade <= 1) {
      if (academic >= 88) return { path: '의대 합격', detail: '최고의 성적. 의과대학 합격 통지서를 받았다.' };
      return { path: 'SKY 공대 합격', detail: '최상위권 공대에 합격. 공학도의 길이 시작된다.' };
    }
    if (mockGrade === 2) return { path: '인서울 상위권 공대', detail: '한양·성균관 수준 공대에 합격했다.' };
    if (mockGrade === 3) return { path: '인서울 이과', detail: '인서울 4년제 이공계에 합격했다.' };
    if (mockGrade === 4) return { path: '수도권 이공계', detail: '수도권 이공계 대학에 합격했다.' };
    return { path: '지방 국립대 이공계', detail: '지방 국립대 이공계에 합격했다. 길은 여기서부터다.' };
  }

  // track 미선택 fallback. mockGrade ≥5 && !track은 위에서 지방 4년제로 이미 처리됨.
  if (mockGrade <= 2) return { path: '상위권 대학', detail: '좋은 성적으로 상위권 대학에 합격했다.' };
  return { path: '인서울 대학', detail: '인서울 대학에 합격했다.' };
}

// ===== 주요 NPC 근황 =====
function getTopNpcStories(state: GameState, limit = 2): string[] {
  const sorted = [...state.npcs]
    .filter(n => n.met && n.intimacy >= 50)
    .sort((a, b) => b.intimacy - a.intimacy)
    .slice(0, limit);

  const stories: string[] = [];
  for (const npc of sorted) {
    if (npc.intimacy >= 85) stories.push(`${npc.name}와는 지금도 가장 친한 친구다.`);
    else if (npc.intimacy >= 70) stories.push(`${npc.name}와는 종종 연락한다. 좋은 기억으로 남아 있다.`);
    else stories.push(`${npc.name}와는 가끔 생각나는 사이다.`);
  }
  return stories;
}

// ===== 엔딩 산정 =====
export function calculateEnding(state: GameState) {
  const { academic, social, talent, mental, health } = state.stats;
  const total = academic + social + talent + mental + health;

  // 성취 3축
  const academicScore = academic;
  const talentScore = talent;
  const lifeScore = (mental + health + social) / 3;

  const bestAxis = Math.max(academicScore, talentScore, lifeScore);
  let achievement = 'C';
  if (bestAxis >= 85) achievement = 'S';
  else if (bestAxis >= 70) achievement = 'A';
  else if (bestAxis >= 50) achievement = 'B';
  else if (bestAxis >= 30) achievement = 'C';
  else achievement = 'D';

  const allStats = [academic, social, talent, mental, health];
  const hasCollapse = allStats.some(v => v < 10);
  const hasWeakness = allStats.some(v => v < 20);
  // 붕괴(<10)는 약점(<20)보다 강한 강등 — 순서 고정: S일 때 붕괴 우선 판정(→B),
  // 그 다음 약점(→A). 이전엔 약점 강등(S→A)이 먼저라 붕괴 강등(S→B)이 가려져 S+붕괴가 A에 머물렀다.
  if (achievement === 'S') {
    if (hasCollapse) achievement = 'B';
    else if (hasWeakness) achievement = 'A';
  }
  if (hasCollapse && achievement === 'A') achievement = 'B';

  // 행복 지수
  const happiness = calculateHappinessGrade(mental, social, health);

  // 진로 판정
  const career = determineCareer(state);
  const suneung = state.examResults.find(e => e.examType === 'suneung');
  const suneungGrade = suneung?.mockGrade ?? null;

  // NPC 근황
  const npcStories = getTopNpcStories(state);

  // 엔딩 타이틀 (진로 기반 + 성취/행복으로 수식)
  let title = career.path;
  let description = career.detail;

  // 특수 조합 — 진로 덮어쓰기
  if (achievement === 'S' && happiness === 'S' && suneungGrade && suneungGrade <= 2) {
    title = `완벽한 청춘 — ${career.path}`;
    description = '성적도, 관계도, 모든 것이 빛나는 학창시절이었다. ' + career.detail;
  } else if (achievement === 'S' && happiness === 'D' && suneungGrade && suneungGrade <= 2) {
    title = `고독한 승리자 — ${career.path}`;
    description = '성적은 최고였지만, 돌아보면 곁에 아무도 없었다. ' + career.detail;
  } else if (state.burnoutCount >= 3 && suneungGrade && suneungGrade <= 4) {
    title = `불꽃은 꺼지지 않는다 — ${career.path}`;
    description = '몇 번이고 쓰러졌지만, 그래도 일어났다. ' + career.detail;
  } else if (happiness === 'S' && achievement !== 'S' && academic < 60) {
    // QA C1-B 연동: 기존 (happiness S && achievement C)는 C1-B 후 도달 불가
    // (happiness S 가 health≥20 을 요구 → lifeScore≥53 → achievement 최소 B).
    // 의도("성적은 평범했지만 행복")대로 academic 기준으로 re-base — 관계·멘탈·건강은 좋고
    // 성적만 평범(academic<60)한 빌드가 받는 엔딩. 최상위(achievement S)는 제외.
    title = `행복한 평범함 — ${career.path}`;
    description = '성적은 평범했지만, 웃음이 가득한 학창시절이었다. ' + career.detail;
  }

  // v1.2 회상 레이어 (크래시 보험: 빈 배열도 안전)
  const memorialHighlights = selectMemorialHighlights(state);
  const yearClosings = [...(state.milestoneScenes || [])]
    .sort((a, b) => a.year - b.year)
    .map(ms => ms.summaryText || `${ms.year}학년의 기억.`);

  return {
    title,
    description,
    achievement,
    happiness,
    total,
    career: career.path,
    careerDetail: career.detail,
    suneungGrade,
    npcStories,
    memorialHighlights,
    yearClosings,
  };
}

// 엔딩 페이로드 — EndingScreen 의 prop 타입 (이전엔 EndingScreen 내부에 정의돼 있었음).
export type EndingData = ReturnType<typeof calculateEnding>;
