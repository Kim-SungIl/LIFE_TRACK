// M5 체감 검증 — 자동 플레이스루 리포트
//
// 목적: "기억에 남는 플레이인가?"의 자동 측정 가능한 부분을 정량화
// - memorySlot 생성 밀도·분포 (카테고리·학년·tone)
// - 엔딩 memorialHighlights 샘플 (fallback 의존도)
// - milestoneScene 학년 커버리지
// - 돈 싱크 실효성 (잔고 분포)
// - ripple 활성화 빈도
//
// 실행: cd game && npx tsx scripts/report-m5-playthrough.ts

import { createInitialState, processWeek, calculateEnding } from '../src/engine/gameEngine';
import { applyMemorySlotFromChoice } from '../src/engine/memorySystem';
import { getFollowupForWeek } from '../src/engine/events';
import type { GameState, ParentStrength, MemoryCategory } from '../src/engine/types';

// ===== 플레이 패턴 =====
interface Pattern {
  name: string;
  parents: [ParentStrength, ParentStrength];
  gender: 'male' | 'female';
  routine2: string;
  routine3: string;
  choicePolicy: (state: GameState) => number; // 이벤트 선택 인덱스 정책
}

// "학업형"은 academic 중시 선택, "인기형"은 social, "밸런스"는 0번 무난 선택
const PATTERNS: Pattern[] = [
  {
    name: '학업형 (정석 공부)',
    parents: ['info', 'strict'], gender: 'male',
    routine2: 'self-study', routine3: 'academy',
    choicePolicy: (s) => {
      const e = s.currentEvent;
      if (!e) return 0;
      // academic 증가 효과 큰 선택지 우선, 없으면 첫 번째
      let best = 0, bestScore = -999;
      const choices = s.gender === 'female' && e.femaleChoices ? e.femaleChoices : e.choices;
      choices.forEach((c, i) => {
        const sc = (c.effects.academic ?? 0) * 3 + (c.effects.mental ?? 0) - (c.fatigueEffect ?? 0);
        if (sc > bestScore) { bestScore = sc; best = i; }
      });
      return best;
    },
  },
  {
    name: '인기형 (사교 우선)',
    parents: ['emotional', 'freedom'], gender: 'female',
    routine2: 'club-activity', routine3: 'part-time-job',
    choicePolicy: (s) => {
      const e = s.currentEvent;
      if (!e) return 0;
      let best = 0, bestScore = -999;
      const choices = s.gender === 'female' && e.femaleChoices ? e.femaleChoices : e.choices;
      choices.forEach((c, i) => {
        const sc = (c.effects.social ?? 0) * 3 + (c.effects.mental ?? 0);
        if (sc > bestScore) { bestScore = sc; best = i; }
      });
      return best;
    },
  },
  {
    name: '재능형 (특기 몰빵)',
    parents: ['gene', 'freedom'], gender: 'male',
    routine2: 'basketball', routine3: 'music',
    choicePolicy: (s) => {
      const e = s.currentEvent;
      if (!e) return 0;
      let best = 0, bestScore = -999;
      const choices = s.gender === 'female' && e.femaleChoices ? e.femaleChoices : e.choices;
      choices.forEach((c, i) => {
        const sc = (c.effects.talent ?? 0) * 3 + (c.effects.mental ?? 0) + (c.effects.social ?? 0);
        if (sc > bestScore) { bestScore = sc; best = i; }
      });
      return best;
    },
  },
  {
    name: '밸런스 (첫 선택지 고정)',
    parents: ['wealth', 'emotional'], gender: 'male',
    routine2: 'self-study', routine3: 'basketball',
    choicePolicy: () => 0,
  },
  {
    name: '회피형 (시간 절약 / 돈 아낌)',
    parents: ['strict', 'info'], gender: 'female',
    routine2: 'self-study', routine3: 'academy',
    choicePolicy: (s) => {
      const e = s.currentEvent;
      if (!e) return 0;
      // 돈 소모 가장 적은 + fatigueEffect 낮은 선택
      let best = 0, bestScore = -999;
      const choices = s.gender === 'female' && e.femaleChoices ? e.femaleChoices : e.choices;
      choices.forEach((c, i) => {
        const money = -(c.moneyEffect ?? 0); // 소모 적을수록 점수 높음
        const fatigue = -(c.fatigueEffect ?? 0);
        if (money + fatigue > bestScore) { bestScore = money + fatigue; best = i; }
      });
      return best;
    },
  },
];

interface Trajectory {
  year: number; week: number;
  academic: number; social: number; talent: number; mental: number; health: number;
  fatigue: number; money: number;
}

async function runPlaythrough(p: Pattern, trajectoryOut?: Trajectory[]): Promise<GameState> {
  let s = createInitialState(p.gender, p.parents);
  s.routineSlot2 = p.routine2;
  s.routineSlot3 = p.routine3;

  // 336주 (7년 × 48주) — 실제 store.resolveEvent 동작 재현
  for (let i = 0; i < 400 && s.year <= 7; i++) {
    s = processWeek(s);

    // 10주마다 스탯 궤적 기록
    if (trajectoryOut && (s.week % 10 === 0 || (s.week === 1 && s.year > 1))) {
      trajectoryOut.push({
        year: s.year, week: s.week,
        academic: Math.round(s.stats.academic), social: Math.round(s.stats.social),
        talent: Math.round(s.stats.talent), mental: Math.round(s.stats.mental),
        health: Math.round(s.stats.health),
        fatigue: Math.round(s.fatigue), money: Math.round(s.money),
      });
    }

    // 이벤트 해결 (store.ts resolveEvent의 주요 로직 재현)
    while (s.currentEvent) {
      const event = s.currentEvent;
      const ci = p.choicePolicy(s);
      const choices = s.gender === 'female' && event.femaleChoices ? event.femaleChoices : event.choices;
      const choice = choices[Math.min(ci, choices.length - 1)];

      // stats 적용
      for (const [k, v] of Object.entries(choice.effects)) {
        const cur = (s.stats as unknown as Record<string, number>)[k] ?? 0;
        (s.stats as unknown as Record<string, number>)[k] = Math.max(0, Math.min(100, cur + (v as number)));
      }
      if (choice.fatigueEffect) s.fatigue = Math.max(0, Math.min(100, s.fatigue + choice.fatigueEffect));
      if (choice.mentalEffect) s.stats.mental = Math.max(0, Math.min(100, s.stats.mental + choice.mentalEffect));
      if (choice.moneyEffect) s.money += choice.moneyEffect;
      if (choice.npcEffects) {
        for (const ne of choice.npcEffects) {
          const npc = s.npcs.find(n => n.id === ne.npcId);
          if (npc) { npc.intimacy = Math.max(0, Math.min(100, npc.intimacy + ne.intimacyChange)); npc.met = true; }
        }
      }

      // memorySlot 생성 (실제 resolveEvent와 동일한 훅)
      applyMemorySlotFromChoice(s, event, ci, choice);

      // ripple 활성화
      if (choice.activateRipples) {
        for (const rid of choice.activateRipples) {
          const r = s.socialRipples.find(x => x.id === rid);
          if (r && !r.activatedAt) r.activatedAt = s.week;
        }
      }

      // addBuff 적용
      if (choice.addBuff) {
        if (!s.activeBuffs) s.activeBuffs = [];
        s.activeBuffs = s.activeBuffs.filter(b => b.id !== choice.addBuff!.id);
        s.activeBuffs.push({ ...choice.addBuff });
      }

      // 이벤트 기록
      s.events.push({ ...event, resolvedChoice: ci, week: s.week, year: s.year,
        resolvedFemale: s.gender === 'female' && !!event.femaleChoices });
      s.currentEvent = null;

      // followup 체크
      const followup = getFollowupForWeek(s, event.location);
      if (followup) s.currentEvent = followup;
    }

    // year-end 자동 진행
    if (s.phase === 'year-end') {
      s.week = 1; s.year++; s.phase = 'weekday';
    }
    if (s.phase === 'ending') break;
  }

  return s;
}

// ===== 분석 =====
interface Report {
  pattern: string;
  finalStats: { academic: number; social: number; talent: number; mental: number; health: number };
  finalMoney: number;
  burnoutCount: number;

  memorySlotCount: number;
  memoryByCategory: Record<MemoryCategory, number>;
  memoryByYear: Record<number, number>;
  memoryByTone: Record<string, number>;

  milestoneYears: number[];
  milestoneTextSample: { year: number; text: string }[];
  milestonePatternHits: Record<number, string>; // year → pattern theme or 'fallback'

  rippleActivatedCount: number;
  rippleTotalCount: number;

  memorialHighlights: string[];
  memorialFallbackRatio: number;

  endingTitle: string;
  endingDescription: string;

  dominantCareer: string;
  suneungGrade: number | null;
  suneungScore: number | null;

  // 신규 진단 지표
  trajectory: Trajectory[];
  eventFireCounts: Record<string, number>;    // event.id → 발동 수
  crisisFireCheck: Record<string, boolean>;   // 주요 크라이시스 발동 여부
  npcIntimacyFinal: Record<string, number>;   // NPC 최종 친밀도
}

function analyze(p: Pattern, s: GameState, trajectory: Trajectory[]): Report {
  const memByCat: Record<MemoryCategory, number> = {
    courage: 0, betrayal: 0, reconciliation: 0, failure: 0, discovery: 0, growth: 0,
  };
  const memByYear: Record<number, number> = {};
  const memByTone: Record<string, number> = {};
  for (const m of s.memorySlots) {
    memByCat[m.category] = (memByCat[m.category] || 0) + 1;
    memByYear[m.year] = (memByYear[m.year] || 0) + 1;
    if (m.toneTag) memByTone[m.toneTag] = (memByTone[m.toneTag] || 0) + 1;
  }

  const ending = calculateEnding(s);
  const memHighlights = ending.memorialHighlights;
  const fallbackLike = memHighlights.filter(h => (h as unknown as { isFallback?: boolean }).isFallback).length;
  const memorialFallbackRatio = memHighlights.length > 0 ? fallbackLike / memHighlights.length : 0;

  // 이벤트 발동 카운트
  const eventFireCounts: Record<string, number> = {};
  for (const e of s.events) eventFireCounts[e.id] = (eventFireCounts[e.id] || 0) + 1;

  // 주요 크라이시스 발동 여부 (M5 진단용)
  const crisisFireCheck: Record<string, boolean> = {
    'minjae-jealousy': !!s.events.find(e => e.id === 'minjae-jealousy'),
    'middle-burnout': !!s.events.find(e => e.id === 'middle-burnout'),
    'burnout-event': !!s.events.find(e => e.id === 'burnout-event'),
    'yuna-misunderstanding': !!s.events.find(e => e.id === 'yuna-misunderstanding'),
    'school-trip-middle': !!s.events.find(e => e.id === 'school-trip-middle'),
    'school-trip-high': !!s.events.find(e => e.id === 'school-trip-high'),
    'club-academy-choice-y5': !!s.events.find(e => e.id === 'club-academy-choice-y5'),
    'graduation-prep-elementary': !!s.events.find(e => e.id === 'graduation-prep-elementary'),
    'graduation-prep-high': !!s.events.find(e => e.id === 'graduation-prep-high'),
  };

  // NPC 친밀도 최종
  const npcIntimacyFinal: Record<string, number> = {};
  for (const n of s.npcs) if (n.met) npcIntimacyFinal[n.id] = Math.round(n.intimacy);

  // milestone 패턴 매칭 여부 — summaryText를 FALLBACK과 비교
  const fallbackTexts: Record<number, string> = {
    1: '초등학교의 마지막 날, 운동장은 여전히 시끄러웠다.',
    2: '처음으로 입은 교복이 조금 컸던 중1의 봄.',
    3: '중2는 그저 지나갔다. 돌아보면 길었던 해.',
    4: '고입 원서를 쓰던 손끝이 차가웠다.',
    5: '새 교복, 새 반, 새 시간표. 낯설고 묘하게 설렜다.',
    6: '고2의 여름. 입시가 갑자기 가까워졌다.',
    7: '수능 전날 밤, 창밖은 이상하리만치 조용했다.',
  };
  const milestonePatternHits: Record<number, string> = {};
  for (const m of s.milestoneScenes) {
    const text = m.summaryText ?? '';
    milestonePatternHits[m.year] = text === fallbackTexts[m.year] ? 'fallback' : (m.dominantTheme ?? 'custom');
  }

  // 수능 원점수
  const suneung = s.examResults.find(e => e.examType === 'suneung');
  const suneungScore = suneung ? Math.round(suneung.average) : null;

  return {
    pattern: p.name,
    finalStats: {
      academic: Math.round(s.stats.academic), social: Math.round(s.stats.social),
      talent: Math.round(s.stats.talent), mental: Math.round(s.stats.mental),
      health: Math.round(s.stats.health),
    },
    finalMoney: s.money,
    burnoutCount: s.burnoutCount,

    memorySlotCount: s.memorySlots.length,
    memoryByCategory: memByCat,
    memoryByYear: memByYear,
    memoryByTone: memByTone,

    milestoneYears: s.milestoneScenes.map(m => m.year).sort((a, b) => a - b),
    milestoneTextSample: s.milestoneScenes
      .sort((a, b) => a.year - b.year)
      .map(m => ({ year: m.year, text: m.summaryText ?? '(텍스트 없음)' })),
    milestonePatternHits,

    rippleActivatedCount: s.socialRipples.filter(r => r.activatedAt).length,
    rippleTotalCount: s.socialRipples.length,

    memorialHighlights: memHighlights.map(h => h.recallText),
    memorialFallbackRatio,

    endingTitle: ending.title,
    endingDescription: ending.description,
    dominantCareer: ending.career,
    suneungGrade: ending.suneungGrade,
    suneungScore,

    trajectory,
    eventFireCounts,
    crisisFireCheck,
    npcIntimacyFinal,
  };
}

function printReport(r: Report) {
  console.log('\n' + '='.repeat(70));
  console.log(`▶ 패턴: ${r.pattern}`);
  console.log('='.repeat(70));

  console.log(`\n[최종 스탯] academic=${r.finalStats.academic} social=${r.finalStats.social} talent=${r.finalStats.talent} mental=${r.finalStats.mental} health=${r.finalStats.health}`);
  console.log(`[잔고] ${r.finalMoney}만원  [번아웃] ${r.burnoutCount}회  [수능] 원점수=${r.suneungScore ?? 'N/A'} 등급=${r.suneungGrade ?? 'N/A'}`);

  // 스탯 궤적 (학년 전환 시점 주요 스냅샷)
  console.log('\n[스탯 궤적] year/week: aca/soc/tal/men/hea  money');
  const milestoneSnaps = r.trajectory.filter(t => t.week === 1 || t.week === 48 || t.week === 40);
  for (const t of milestoneSnaps.slice(0, 14)) {
    console.log(`  Y${t.year}W${t.week}: ${t.academic}/${t.social}/${t.talent}/${t.mental}/${t.health}  ${t.money}만`);
  }

  console.log(`\n[memorySlot] 총 ${r.memorySlotCount}개`);
  console.log('  카테고리:', Object.entries(r.memoryByCategory).filter(([, v]) => v > 0).map(([k, v]) => `${k}=${v}`).join(' '));
  console.log('  학년:', Object.entries(r.memoryByYear).map(([k, v]) => `Y${k}=${v}`).join(' '));
  console.log('  toneTag:', Object.entries(r.memoryByTone).map(([k, v]) => `${k}=${v}`).join(' '));

  console.log(`\n[milestone] 커버 학년: ${r.milestoneYears.join(', ')} (총 ${r.milestoneYears.length}/7)`);
  for (const m of r.milestoneTextSample) {
    const hit = r.milestonePatternHits[m.year];
    console.log(`  Y${m.year} [${hit}]: ${m.text}`);
  }

  console.log(`\n[주요 이벤트 발동 체크]`);
  for (const [id, fired] of Object.entries(r.crisisFireCheck)) {
    console.log(`  ${fired ? '✓' : '✗'} ${id}`);
  }

  console.log(`\n[NPC 친밀도 최종]`);
  for (const [npc, intimacy] of Object.entries(r.npcIntimacyFinal).sort(([, a], [, b]) => b - a).slice(0, 6)) {
    console.log(`  ${npc}: ${intimacy}`);
  }

  console.log(`\n[ripple] 활성 ${r.rippleActivatedCount}/${r.rippleTotalCount}`);

  console.log(`\n[엔딩 회상 ${r.memorialHighlights.length}개] (fallback 비율 ${(r.memorialFallbackRatio * 100).toFixed(0)}%)`);
  r.memorialHighlights.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));

  console.log(`\n[엔딩] ${r.endingTitle}`);
  console.log(`  ${r.endingDescription}`);
  console.log(`  진로: ${r.dominantCareer}`);
}

// ===== 실행 =====
async function main() {
  console.log('M5 자동 플레이스루 리포트\n');
  const reports: Report[] = [];
  for (const p of PATTERNS) {
    const traj: Trajectory[] = [];
    const s = await runPlaythrough(p, traj);
    reports.push(analyze(p, s, traj));
  }
  for (const r of reports) printReport(r);

  // ===== 종합 =====
  console.log('\n\n' + '='.repeat(70));
  console.log('▶ 종합 (전체 패턴 평균)');
  console.log('='.repeat(70));

  const avg = (vals: number[]) => (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  console.log(`\n평균 memorySlot 수: ${avg(reports.map(r => r.memorySlotCount))}개`);
  console.log(`평균 milestone 커버: ${avg(reports.map(r => r.milestoneYears.length))}/7`);
  console.log(`평균 잔고: ${avg(reports.map(r => r.finalMoney))}만원`);
  console.log(`평균 fallback 비율: ${(reports.reduce((a, b) => a + b.memorialFallbackRatio, 0) / reports.length * 100).toFixed(0)}%`);
  console.log(`평균 ripple 활성: ${avg(reports.map(r => r.rippleActivatedCount))}`);

  // 크라이시스 발동률
  console.log('\n[크라이시스 이벤트 발동률 (패턴 5개 중)]');
  const crisisIds = ['minjae-jealousy', 'middle-burnout', 'burnout-event', 'yuna-misunderstanding'];
  for (const id of crisisIds) {
    const hits = reports.filter(r => r.crisisFireCheck[id]).length;
    console.log(`  ${id}: ${hits}/${reports.length}`);
  }

  // 수능 원점수·등급 분포
  console.log('\n[수능 등급 분포]');
  const gradeDistribution: Record<string, number> = {};
  for (const r of reports) {
    const k = r.suneungGrade ? `${r.suneungGrade}등급` : 'N/A';
    gradeDistribution[k] = (gradeDistribution[k] || 0) + 1;
  }
  for (const [g, n] of Object.entries(gradeDistribution)) console.log(`  ${g}: ${n}`);
  console.log(`[수능 원점수 평균/최대/최소]: avg=${avg(reports.filter(r => r.suneungScore).map(r => r.suneungScore!))} max=${Math.max(...reports.map(r => r.suneungScore ?? 0))} min=${Math.min(...reports.filter(r => r.suneungScore).map(r => r.suneungScore!))}`);

  // 엔딩 다양성
  const endingTitles = new Set(reports.map(r => r.endingTitle));
  console.log(`\n[엔딩 다양성] 서로 다른 엔딩 ${endingTitles.size}종 / 패턴 ${reports.length}개`);
  for (const t of endingTitles) console.log(`  - ${t}`);

  // milestone 패턴 개인화율
  console.log('\n[milestone 개인화율 (fallback 아닌 비율)]');
  for (let y = 1; y <= 7; y++) {
    const total = reports.filter(r => r.milestonePatternHits[y]).length;
    const custom = reports.filter(r => r.milestonePatternHits[y] && r.milestonePatternHits[y] !== 'fallback').length;
    console.log(`  Y${y}: ${custom}/${total} 개인화`);
  }

  // 경고 지점
  console.log('\n[경고 포인트]');
  const lowMem = reports.filter(r => r.memorySlotCount < 6);
  if (lowMem.length > 0) console.log(`  ⚠ memorySlot 6개 미만 패턴 ${lowMem.length}개: ${lowMem.map(r => r.pattern).join(', ')}`);
  const highFb = reports.filter(r => r.memorialFallbackRatio > 0.3);
  if (highFb.length > 0) console.log(`  ⚠ fallback 30% 초과 패턴 ${highFb.length}개: ${highFb.map(r => r.pattern).join(', ')}`);
  const richMoney = reports.filter(r => r.finalMoney > 500);
  if (richMoney.length > 0) console.log(`  ⚠ 잉여 500만원 초과 패턴 ${richMoney.length}개 (돈 싱크 미흡): ${richMoney.map(r => `${r.pattern}(${r.finalMoney})`).join(', ')}`);
  const zeroRipple = reports.filter(r => r.rippleActivatedCount === 0);
  if (zeroRipple.length === PATTERNS.length) console.log(`  ⚠ 모든 패턴에서 ripple 0건 활성 — ripple 콘텐츠 확대 필요 (M7)`);
  const incompleteMilestone = reports.filter(r => r.milestoneYears.length < 7);
  if (incompleteMilestone.length > 0) console.log(`  ⚠ milestone 7학년 미달 패턴 ${incompleteMilestone.length}개`);
  if (endingTitles.size === 1) console.log(`  🔴 모든 패턴이 동일 엔딩 — 엔딩 분기 조건 재검토 필요`);
  const noCrisis = crisisIds.filter(id => reports.filter(r => r.crisisFireCheck[id]).length === 0);
  if (noCrisis.length > 0) console.log(`  🔴 전혀 발동 안 한 크라이시스: ${noCrisis.join(', ')}`);
}

main().catch(e => { console.error(e); process.exit(1); });
