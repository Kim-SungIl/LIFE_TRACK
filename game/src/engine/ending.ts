// 엔딩 산정 — 7년 종료 후의 진로/회상/행복도 결정.
// gameEngine.ts 에서 추출 (P2-6). 학년말 카드(YearEndScreen)도 calculateHappinessGrade 를 공유.
import { GameState, ParentStrength } from './types';
import { selectMemorialHighlights } from './memorySystem';

// ===== 행복 등급 =====
// mental + social 조합으로 한 해/일생의 행복도를 5단계로 분류.
// calculateEnding(엔딩 누적)과 학년말 카드 둘 다 동일 산식 — 일관된 시그널.
export type HappinessGrade = 'S' | 'A' | 'B' | 'C' | 'D';

export function calculateHappinessGrade(mental: number, social: number): HappinessGrade {
  if (mental >= 80 && social >= 60) return 'S';
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

// ===== 부모 에필로그 (Phase 4A) =====
// 진로 결과(대학)는 stats/수능으로만 결정하고 친밀도로 바꾸지 않는다("스탯 퍼주기" 회피).
// 친밀도는 "내 이야기의 결말"로만 남긴다 — 같은 결과를 부모와 함께(warm) 맞느냐,
// 끝내 못 한 말로(distant) 맞느냐. tier 경계는 talkSystem.getParentIntimacyTone과 동일(distant<30 / warm≥70).
// 화자 SSOT 유지(엄마: emotional/info/resilience/freedom, 아빠: wealth/strict).
export type EpilogueTier = 'distant' | 'normal' | 'warm';
export type ParentEpilogue = { tier: EpilogueTier; intro: string; beats: { strength: ParentStrength; text: string }[] };

const PARENT_EPILOGUE_INTRO: Record<EpilogueTier, string> = {
  warm: '집을 떠나던 날, 현관까지 따라 나온 두 사람을 한참 돌아봤다. 7년이 거기 다 담겨 있었다.',
  normal: '늘 곁에 있어서 당연했던 사람들. 떠날 때가 되어서야 그 당연함이 얼마나 컸는지 알았다.',
  distant: '집은 끝까지 조용했다. 서로에게 닿지 못한 말들이 현관 앞에 그대로 쌓여 있었다.',
};

const PARENT_EPILOGUE_BEATS: Record<ParentStrength, Record<EpilogueTier, string>> = {
  emotional: {
    warm: '엄마는 늘 "오늘은 어땠어"를 먼저 물었다. 그 한마디가 내 하루의 무게를 절반으로 줄여줬다.',
    normal: '엄마는 가끔 내 표정을 살폈다. 다 말하진 못했어도, 누군가 보고 있다는 건 알았다.',
    distant: '엄마가 "무슨 일 있어?" 물을 때마다 "아니"라고 답했다. 그 "아니"들이 쌓여 벽이 됐다.',
  },
  wealth: {
    warm: '아빠는 말 대신 통장을 만들어뒀더라. 필요할 때 쓰라는, 그 사람다운 사랑이었다.',
    normal: '아빠는 "필요한 거 있으면 말해"를 반복했다. 그게 아빠가 아는 가장 다정한 문장이었다.',
    distant: '아빠가 내민 것들을 몇 번 거절했다. 그게 아빠의 서툰 언어였다는 걸, 너무 늦게 알았다.',
  },
  info: {
    warm: '엄마는 자료를 한 아름 안고 왔다. 답을 정해주는 대신, 내가 고를 수 있게 길을 다 펼쳐놨다.',
    normal: '엄마는 자료를 모아뒀다가 슬쩍 건넸다. 받든 안 받든, 늘 준비돼 있었다.',
    distant: '엄마가 모아둔 자료들을 끝내 펼쳐보지 않았다. 그 마음까지 밀어낸 건 아니었는데.',
  },
  strict: {
    warm: '아빠는 끝내 "잘했다"고 했다. 평생 아껴두기만 하던 그 말을, 떠나는 날에야 꺼냈다.',
    normal: '아빠의 기준은 높았다. 그 뒤에 뭐가 있었는지는, 아직 다 알지 못한다.',
    distant: '아빠의 기준을 따라가려 애썼지만, 어느 순간 그게 내 기준이 아니라는 걸 알았다.',
  },
  resilience: {
    warm: '엄마는 넘어진 나를 곧장 일으키지 않았다. 그 몇 초의 침묵이, 나를 혼자 일어서게 했다.',
    normal: '"괜찮아, 그런 날도 있어." 엄마의 그 말이 생각보다 자주 필요했다.',
    distant: '힘들다고 말하지 못했다. 엄마는 늘 괜찮냐고 물었지만, 나는 늘 괜찮은 척했다.',
  },
  freedom: {
    warm: '엄마는 끝까지 안 말렸다. 내 선택을 믿어준 그 침묵이, 가장 큰 응원이었다.',
    normal: '"네가 정해." 엄마는 답을 주지 않았다. 그게 답답하면서도 든든했다.',
    distant: '엄마는 안방 문을 늘 열어뒀지만, 나는 한 번도 들어가 방향을 묻지 못했다.',
  },
};

function buildParentEpilogue(state: GameState): ParentEpilogue {
  const pi = state.parentIntimacy ?? 50;
  const tier: EpilogueTier = pi < 30 ? 'distant' : pi >= 70 ? 'warm' : 'normal';
  const beats = (state.parents ?? [])
    .map(s => { const text = PARENT_EPILOGUE_BEATS[s]?.[tier]; return text ? { strength: s, text } : null; })
    .filter((b): b is { strength: ParentStrength; text: string } => !!b);
  return { tier, intro: PARENT_EPILOGUE_INTRO[tier], beats };
}

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
  const happiness = calculateHappinessGrade(mental, social);

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
  } else if (happiness === 'S' && achievement === 'C') {
    title = `행복한 평범함 — ${career.path}`;
    description = '성적은 평범했지만, 웃음이 가득한 학창시절이었다. ' + career.detail;
  }

  // Phase 4A: 부모 에필로그 (친밀도 tier × 강점별 회고 — 진로 결과엔 영향 없음)
  const parentEpilogue = buildParentEpilogue(state);

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
    parentEpilogue,
    memorialHighlights,
    yearClosings,
  };
}

// 엔딩 페이로드 — EndingScreen 의 prop 타입 (이전엔 EndingScreen 내부에 정의돼 있었음).
export type EndingData = ReturnType<typeof calculateEnding>;
