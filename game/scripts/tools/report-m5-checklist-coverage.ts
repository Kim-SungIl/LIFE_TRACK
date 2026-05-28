// M5 체크리스트 자동화 커버리지 리포트
//
// 목적: docs/m5-playthrough-checklist.md 항목별로 "자동 통과/실패/수동 필요"를 한 번에 출력.
//       기존 report-m5-playthrough.ts가 측정 못 하는 누락 항목(졸업앨범·정성선물·학년라벨)도 추가.
//
// 실행: cd game && npx tsx scripts/report-m5-checklist-coverage.ts

import { GAME_EVENTS } from '../../src/engine/events';
import { createInitialState, processWeek } from '../../src/engine/gameEngine';
import { calculateEnding } from '../../src/engine/ending';
import { applyMemorySlotFromChoice } from '../../src/engine/memorySystem';
import type { GameState, ParentStrength, GameEvent, Choice } from '../../src/engine/types';

// ===== 짧은 플레이스루 (1패턴, 표준 시나리오) =====
async function runStandard(): Promise<GameState> {
  let s = createInitialState('female', ['emotional', 'info']);
  s.routineSlot2 = 'self-study';
  s.routineSlot3 = 'club';

  for (let i = 0; i < 400 && s.year <= 7; i++) {
    s = processWeek(s);
    while (s.currentEvent) {
      const e = s.currentEvent;
      // social·mental 우선 균형 선택
      const ci = pickBalanced(s, e);
      const choices = s.gender === 'female' && e.femaleChoices ? e.femaleChoices : e.choices;
      const choice = choices[Math.min(ci, choices.length - 1)];
      for (const [k, v] of Object.entries(choice.effects)) {
        const cur = (s.stats as unknown as Record<string, number>)[k] ?? 0;
        (s.stats as unknown as Record<string, number>)[k] = Math.max(0, Math.min(100, cur + (v as number)));
      }
      if (choice.fatigueEffect) s.fatigue = Math.max(0, Math.min(100, s.fatigue + choice.fatigueEffect));
      if (choice.moneyEffect) s.money += choice.moneyEffect;
      if (choice.npcEffects) {
        for (const ne of choice.npcEffects) {
          const npc = s.npcs.find(n => n.id === ne.npcId);
          if (npc) { npc.intimacy = Math.max(0, Math.min(100, npc.intimacy + ne.intimacyChange)); npc.met = true; }
        }
      }
      applyMemorySlotFromChoice(s, e, ci, choice);
      s.events.push({ ...e, resolvedChoice: ci, week: s.week, year: s.year, resolvedFemale: s.gender === 'female' && !!e.femaleChoices });
      s.currentEvent = null;
    }
    if (s.phase === 'year-end') { s.week = 1; s.year++; s.phase = 'weekday'; }
    if (s.phase === 'ending') break;
  }
  return s;
}

function pickBalanced(s: GameState, e: GameEvent): number {
  const choices = s.gender === 'female' && e.femaleChoices ? e.femaleChoices : e.choices;
  let best = 0, bestScore = -999;
  choices.forEach((c, i) => {
    const sc = (c.effects.social ?? 0) + (c.effects.mental ?? 0) + (c.effects.academic ?? 0) * 0.5;
    if (sc > bestScore) { bestScore = sc; best = i; }
  });
  return best;
}

// ===== 체크리스트 매핑 =====
type Result = 'PASS' | 'FAIL' | 'MANUAL' | 'PARTIAL';
interface Check {
  section: string;
  item: string;
  result: Result;
  evidence: string;
}

function runChecks(s: GameState): Check[] {
  const checks: Check[] = [];
  const ending = calculateEnding(s);

  // ===== 1. 학년말 일기장 =====
  checks.push({
    section: '1. 학년말 일기장',
    item: 'Y1 끝에 YEAR-END 화면 진입',
    result: 'MANUAL',
    evidence: 'phase 전환은 코드상 존재하나 UI 렌더 확인은 브라우저 필요',
  });
  // milestoneScene 학년 라벨 확인
  const yearLabels: Record<number, string> = {
    1: '초등학교 6학년', 2: '중학교 1학년', 3: '중학교 2학년',
    4: '중학교 3학년', 5: '고등학교 1학년', 6: '고등학교 2학년', 7: '고등학교 3학년',
  };
  const milestoneYears = s.milestoneScenes.map(m => m.year).sort((a, b) => a - b);
  checks.push({
    section: '1. 학년말 일기장',
    item: '학년 라벨 정확 (Y1~Y7)',
    result: milestoneYears.length === 7 ? 'PASS' : 'PARTIAL',
    evidence: `milestone 생성 학년: ${milestoneYears.join(', ')} (${milestoneYears.length}/7). 라벨 텍스트는 stringTable에서 별도 검증 필요`,
  });
  // milestoneScene summaryText 존재 비율
  const withText = s.milestoneScenes.filter(m => !!m.summaryText).length;
  checks.push({
    section: '1. 학년말 일기장',
    item: 'milestoneScene summaryText 채워짐',
    result: withText === s.milestoneScenes.length && withText > 0 ? 'PASS' : 'FAIL',
    evidence: `${withText}/${s.milestoneScenes.length} 학년에 summaryText 존재`,
  });
  // recallText 정서 평가 — fallback 비율로 대용
  const fallbackTexts = new Set([
    '초등학교의 마지막 날, 운동장은 여전히 시끄러웠다.',
    '처음으로 입은 교복이 조금 컸던 중1의 봄.',
    '중2는 그저 지나갔다. 돌아보면 길었던 해.',
    '고입 원서를 쓰던 손끝이 차가웠다.',
    '새 교복, 새 반, 새 시간표. 낯설고 묘하게 설렜다.',
    '고2의 여름. 입시가 갑자기 가까워졌다.',
    '수능 전날 밤, 창밖은 이상하리만치 조용했다.',
  ]);
  const customMilestones = s.milestoneScenes.filter(m => m.summaryText && !fallbackTexts.has(m.summaryText)).length;
  checks.push({
    section: '1. 학년말 일기장',
    item: '정서 평가 (개인화된 milestone 비율 ≥50%)',
    result: customMilestones / Math.max(1, s.milestoneScenes.length) >= 0.5 ? 'PASS' : 'PARTIAL',
    evidence: `개인화 ${customMilestones}/${s.milestoneScenes.length}. <50%이면 plays-through에서 크라이시스 다양성 부족`,
  });

  // ===== 2. 엔딩 회상 =====
  const memHighlights = ending.memorialHighlights;
  checks.push({
    section: '2. 엔딩 회상',
    item: 'memorialHighlights 3~5개',
    result: memHighlights.length >= 3 && memHighlights.length <= 5 ? 'PASS' : 'FAIL',
    evidence: `${memHighlights.length}개 (목표 3~5)`,
  });
  const fbCount = memHighlights.filter(h => (h as unknown as { isFallback?: boolean }).isFallback).length;
  checks.push({
    section: '2. 엔딩 회상',
    item: '회상 문장 개인화 (fallback 비율 <30%)',
    result: fbCount / Math.max(1, memHighlights.length) < 0.3 ? 'PASS' : 'FAIL',
    evidence: `fallback ${fbCount}/${memHighlights.length}`,
  });
  checks.push({
    section: '2. 엔딩 회상',
    item: 'yearClosings (학년별 summaryText) 7개',
    result: milestoneYears.length === 7 ? 'PASS' : 'FAIL',
    evidence: `${milestoneYears.length}/7`,
  });

  // ===== 3. 주요 이벤트 발동 =====
  // Y2 W28 수학여행 (school-trip-middle), Y5 W28 (school-trip-high)
  // Y1 W45 졸업앨범, Y7 W45 졸업 준비, Y5 W2 동아리/학원
  const fired = (id: string) => !!s.events.find(e => e.id === id);
  const firedAtYearWeek = (id: string, year: number, week: number) =>
    !!s.events.find(e => e.id === id && e.year === year && e.week === week);

  checks.push({
    section: '3. 주요 이벤트 발동',
    item: 'Y2 W28 수학여행 (중1 경주)',
    result: fired('school-trip-middle') ? 'PASS' : 'FAIL',
    evidence: `school-trip-middle 발동: ${fired('school-trip-middle')}`,
  });
  checks.push({
    section: '3. 주요 이벤트 발동',
    item: 'Y5 W28 수학여행 (고1 제주)',
    result: fired('school-trip-high') ? 'PASS' : 'FAIL',
    evidence: `school-trip-high 발동: ${fired('school-trip-high')}`,
  });

  // Y1 졸업앨범 — 코드에서 ID 검색
  const albumIds = GAME_EVENTS.filter(e => /album|앨범/.test(e.id) || /앨범/.test(e.title)).map(e => e.id);
  const elementaryAlbumFired = albumIds.some(id => fired(id));
  checks.push({
    section: '3. 주요 이벤트 발동',
    item: 'Y1 W45 초등 졸업 앨범',
    result: albumIds.length === 0 ? 'FAIL' : (elementaryAlbumFired ? 'PASS' : 'PARTIAL'),
    evidence: albumIds.length === 0
      ? '졸업앨범 이벤트 코드에 없음 — 체크리스트와 콘텐츠 불일치'
      : `후보 ID: ${albumIds.join(', ')} / 발동: ${elementaryAlbumFired}`,
  });

  checks.push({
    section: '3. 주요 이벤트 발동',
    item: 'Y7 W45 고등 졸업 준비',
    result: firedAtYearWeek('graduation-prep-high', 7, 45) ? 'PASS' : (fired('graduation-prep-high') ? 'PARTIAL' : 'FAIL'),
    evidence: `graduation-prep-high 발동: ${fired('graduation-prep-high')}`,
  });
  checks.push({
    section: '3. 주요 이벤트 발동',
    item: 'Y5 W2 동아리/학원 선택',
    result: fired('club-academy-choice-y5') ? 'PASS' : 'FAIL',
    evidence: `club-academy-choice-y5 발동: ${fired('club-academy-choice-y5')}`,
  });

  // 정성 선물 옵션 — NPC 생일 이벤트 choices 텍스트에 "정성"과 -5 moneyEffect 검색
  const birthdayEvents = GAME_EVENTS.filter(e => /birthday|생일/.test(e.id));
  const giftEvents = birthdayEvents.filter(e => {
    const allChoices = [...(e.choices || []), ...(e.femaleChoices || [])];
    return allChoices.some((c: Choice) => /정성|선물/.test(c.text) && (c.moneyEffect ?? 0) <= -3);
  });
  checks.push({
    section: '3. 주요 이벤트 발동',
    item: 'NPC 생일 이벤트에 "정성 선물 (-5만원)" 옵션',
    result: giftEvents.length >= 3 ? 'PASS' : (giftEvents.length > 0 ? 'PARTIAL' : 'FAIL'),
    evidence: `생일 이벤트 ${birthdayEvents.length}개 중 정성선물 옵션 보유 ${giftEvents.length}개: ${giftEvents.map(e => e.id).join(', ')}`,
  });

  // ===== 4. 위기 이벤트 =====
  const middleBurnout = fired('middle-burnout');
  const minjaeJealousy = fired('minjae-jealousy');
  checks.push({
    section: '4. 위기 이벤트',
    item: 'Y3 근처 크라이시스 (middle-burnout 또는 minjae-jealousy)',
    result: (middleBurnout || minjaeJealousy) ? 'PASS' : 'FAIL',
    evidence: `middle-burnout=${middleBurnout}, minjae-jealousy=${minjaeJealousy}`,
  });
  // 크라이시스 이후 memorySlot 생성 — 발동된 학년 + 1 이전에 memorySlot 추가됐는지
  let crisisMemoryFollowed = false;
  if (middleBurnout || minjaeJealousy) {
    const crisisYear = s.events.find(e => e.id === 'middle-burnout' || e.id === 'minjae-jealousy')?.year ?? 0;
    crisisMemoryFollowed = s.memorySlots.some(m => m.year === crisisYear);
  }
  checks.push({
    section: '4. 위기 이벤트',
    item: '크라이시스 후 memorySlot 생성',
    result: middleBurnout || minjaeJealousy ? (crisisMemoryFollowed ? 'PASS' : 'FAIL') : 'MANUAL',
    evidence: crisisMemoryFollowed ? '크라이시스 학년에 memorySlot 존재' : (middleBurnout || minjaeJealousy ? '크라이시스 발동했으나 같은 학년 memorySlot 없음' : '크라이시스 미발동'),
  });

  // ===== 5. 상점·돈 싱크 =====
  checks.push({
    section: '5. 상점·돈 싱크',
    item: '7년 후 잔고 ≤500만원',
    result: s.money <= 500 ? 'PASS' : 'FAIL',
    evidence: `최종 잔고 ${s.money}만원`,
  });
  checks.push({
    section: '5. 상점·돈 싱크',
    item: '학원/동아리 버프 체감',
    result: 'MANUAL',
    evidence: '주간 스탯 상승폭 비교는 사람 체감 항목',
  });

  // ===== 6. 저장·로드 =====
  checks.push({
    section: '6. 저장·로드',
    item: '중간 저장 → 재오픈 동일 지점',
    result: 'MANUAL',
    evidence: '브라우저 localStorage 동작 확인 필요',
  });
  checks.push({
    section: '6. 저장·로드',
    item: 'M1 이전 구세이브 호환',
    result: 'MANUAL',
    evidence: '레거시 세이브 케이스 확인 필요',
  });

  // ===== 7. 팔레트·UI =====
  for (const item of [
    '타이틀 로고 그라데이션 (테라코타→골드)',
    '선택지 호버 색 (warm terracotta)',
    'EventScene 배경 그라데이션 (warm-tone)',
    'milestone 박스 골드 강조 (antique 톤)',
  ]) {
    checks.push({
      section: '7. 팔레트·UI',
      item,
      result: 'MANUAL',
      evidence: '시각 확인 항목 — CSS 변수 grep으로 한 번 더 가능',
    });
  }

  return checks;
}

function printResults(checks: Check[], finalState: GameState) {
  console.log('M5 체크리스트 자동 커버리지 리포트\n');
  console.log(`최종 상태: Y${finalState.year} W${finalState.week}, money=${finalState.money}만, memorySlots=${finalState.memorySlots.length}, milestones=${finalState.milestoneScenes.length}\n`);
  console.log('='.repeat(95));

  let lastSection = '';
  for (const c of checks) {
    if (c.section !== lastSection) {
      console.log(`\n[${c.section}]`);
      lastSection = c.section;
    }
    const icon = { PASS: '✅', FAIL: '❌', MANUAL: '👤', PARTIAL: '⚠️ ' }[c.result];
    console.log(`  ${icon} ${c.result.padEnd(7)} ${c.item}`);
    console.log(`           └─ ${c.evidence}`);
  }

  // 요약
  console.log('\n' + '='.repeat(95));
  const counts = { PASS: 0, FAIL: 0, MANUAL: 0, PARTIAL: 0 };
  for (const c of checks) counts[c.result]++;
  const automatable = counts.PASS + counts.FAIL + counts.PARTIAL;
  console.log(`\n[요약] 총 ${checks.length}개`);
  console.log(`  자동 검증 가능: ${automatable}개 (PASS=${counts.PASS}, FAIL=${counts.FAIL}, PARTIAL=${counts.PARTIAL})`);
  console.log(`  수동 필요:      ${counts.MANUAL}개`);
  if (counts.FAIL > 0) {
    console.log(`\n🔴 자동 FAIL 항목 (콘텐츠/구현 누락):`);
    checks.filter(c => c.result === 'FAIL').forEach(c => console.log(`  - [${c.section}] ${c.item} — ${c.evidence}`));
  }
  if (counts.PARTIAL > 0) {
    console.log(`\n⚠️  PARTIAL 항목 (추가 확인 필요):`);
    checks.filter(c => c.result === 'PARTIAL').forEach(c => console.log(`  - [${c.section}] ${c.item} — ${c.evidence}`));
  }
}

async function main() {
  const s = await runStandard();
  const checks = runChecks(s);
  printResults(checks, s);
}

main().catch(e => { console.error(e); process.exit(1); });
