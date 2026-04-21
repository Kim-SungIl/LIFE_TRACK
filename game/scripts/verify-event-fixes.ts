// 이벤트 수정 사항 검증 시뮬레이션
// 실행: cd game && npx tsx scripts/verify-event-fixes.ts

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInitialState, processWeek } from '../src/engine/gameEngine';
import { GAME_EVENTS } from '../src/engine/events';
import { SHOP_ITEMS, canBuyItem, applyItemEffects } from '../src/engine/shopSystem';
import type { GameState, ParentStrength } from '../src/engine/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function setupState(gender: 'male' | 'female' = 'male'): GameState {
  const parents: [ParentStrength, ParentStrength] = ['wealth', 'emotional'];
  return createInitialState(gender, parents);
}

function findEvent(id: string) {
  return GAME_EVENTS.find(e => e.id === id);
}

function canFireAt(eventId: string, state: GameState): boolean {
  const ev = findEvent(eventId);
  if (!ev) return false;
  if (ev.week !== undefined && ev.week !== state.week) return false;
  if (ev.condition && !ev.condition(state)) return false;
  return true;
}

// 특정 week/year/조건으로 스테이트 조작
function mutate(state: GameState, patch: Partial<GameState>): GameState {
  return { ...state, ...patch };
}

function npcState(state: GameState, id: string, patch: { met?: boolean; intimacy?: number }) {
  const newState = JSON.parse(JSON.stringify(state)) as GameState;
  const npc = newState.npcs.find(n => n.id === id);
  if (npc && patch.met !== undefined) npc.met = patch.met;
  if (npc && patch.intimacy !== undefined) npc.intimacy = patch.intimacy;
  return newState;
}

let passed = 0;
let failed = 0;
function assert(label: string, cond: boolean) {
  if (cond) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}`);
    failed++;
  }
}

console.log('\n=== 1. minjae-exam-chat: Y1 W17에만 발동 ===');
{
  let s = setupState();
  s = npcState(s, 'minjae', { met: true, intimacy: 30 });

  // Y1 W8 → 발동 안 됨 (기존 버그)
  const atW8 = canFireAt('minjae-exam-chat', mutate(s, { week: 8, year: 1 }));
  assert('Y1 W8: 발동 안 됨', !atW8);

  // Y1 W17 → 발동됨
  const atW17 = canFireAt('minjae-exam-chat', mutate(s, { week: 17, year: 1 }));
  assert('Y1 W17: 발동됨', atW17);

  // Y1 W18 → 발동 안 됨
  const atW18 = canFireAt('minjae-exam-chat', mutate(s, { week: 18, year: 1 }));
  assert('Y1 W18: 발동 안 됨', !atW18);

  // Y2 W17 → 발동 안 됨 (s.year === 1 조건)
  const y2W17 = canFireAt('minjae-exam-chat', mutate(s, { week: 17, year: 2 }));
  assert('Y2 W17: 발동 안 됨', !y2W17);

  // minjae.met 없으면 발동 안 됨
  let s2 = setupState();
  const unmet = canFireAt('minjae-exam-chat', mutate(s2, { week: 17, year: 1 }));
  assert('minjae 미면식 시 발동 안 됨', !unmet);
}

console.log('\n=== 2. yuna-pressure: W36~38에만 발동 ===');
{
  let s = setupState();
  s = npcState(s, 'yuna', { met: true, intimacy: 60 });
  s = mutate(s, { year: 2, isVacation: false });

  // W33 → 발동 안 됨 (기존 버그)
  assert('W33: 발동 안 됨', !canFireAt('yuna-pressure', mutate(s, { week: 33 })));
  // W35 → 발동 안 됨
  assert('W35: 발동 안 됨', !canFireAt('yuna-pressure', mutate(s, { week: 35 })));
  // W36~38 → 발동됨
  assert('W36: 발동됨', canFireAt('yuna-pressure', mutate(s, { week: 36 })));
  assert('W37: 발동됨', canFireAt('yuna-pressure', mutate(s, { week: 37 })));
  assert('W38: 발동됨', canFireAt('yuna-pressure', mutate(s, { week: 38 })));
  // W39 → 발동 안 됨
  assert('W39: 발동 안 됨', !canFireAt('yuna-pressure', mutate(s, { week: 39 })));

  // 봄 중간고사 주차 (W7~9) → 발동 안 됨 (가을만 한정)
  assert('W8: 발동 안 됨 (봄 중간고사 주차)', !canFireAt('yuna-pressure', mutate(s, { week: 8 })));
}

console.log('\n=== 3. friend-snack: minjae.met 조건 (소스 검증) ===');
{
  // SCHOOL_LIFE_EVENTS는 internal이라 직접 import 불가 → 소스 파일 텍스트로 확인
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'engine', 'events.ts'), 'utf8');
  const snackBlockMatch = src.match(/id: 'friend-snack'[\s\S]*?condition:\s*\(s\)\s*=>\s*\{([\s\S]*?)\},/);
  const condSrc = snackBlockMatch?.[1] || '';
  assert('friend-snack condition에 minjae.met 체크 포함', condSrc.includes("'minjae'") && condSrc.includes('met'));
}

console.log('\n=== 4. good-grade: 제목 "성적 상승!" 유지 ===');
{
  const ev = findEvent('good-grade');
  assert('제목 "성적 상승!"', ev?.title === '성적 상승!');
  const desc = ev?.description || '';
  assert('description에 "시험 결과" 표현 없음', !desc.includes('시험 결과'));
}

console.log('\n=== 5. class-president-2 당선 멘트: "1학기" 언급 제거 ===');
{
  const ev = findEvent('class-president-2');
  const msg = ev?.choices?.[0]?.message || '';
  assert('당선 선택지 메시지에 "1학기" 없음', !msg.includes('1학기'));
}

console.log('\n=== 6. jihun-support: 여주 배드민턴 분기 존재 ===');
{
  const ev = findEvent('jihun-support');
  assert('femaleDescription 존재', !!ev?.femaleDescription);
  assert('femaleChoices 존재', !!ev?.femaleChoices);
  assert('femaleDescription에 "배드민턴" 포함', ev?.femaleDescription?.includes('배드민턴') || false);
  assert('femaleChoices[0] 메시지에 "스매시" 포함', ev?.femaleChoices?.[0]?.message?.includes('스매시') || false);
}

console.log('\n=== 7. junha-dialect: 설명에 "체육관" ===');
{
  const ev = findEvent('junha-dialect');
  assert('남주 description에 "체육관"', ev?.description?.includes('체육관') || false);
  assert('남주 description에 "교실이 조용해졌다" 없음', !ev?.description?.includes('교실이 조용해졌다'));
}

console.log('\n=== 8. summer-start: 알바 표현 제거 ===');
{
  const ev = findEvent('summer-start');
  const msgs = (ev?.choices || []).map(c => c.message);
  const anyAlba = msgs.some(m => m?.includes('알바'));
  assert('모든 선택지 message에 "알바" 없음', !anyAlba);
}

console.log('\n=== 9. elementary-unit-test-2: 준비 톤 ===');
{
  const ev = findEvent('elementary-unit-test-2');
  assert('title "다가온다" 포함', ev?.title?.includes('다가온다') || false);
  assert('description에 "다음 주" 포함', ev?.description?.includes('다음 주') || false);
}

console.log('\n=== 10. jihun-fight: "맨날 공부만" 제거 ===');
{
  const ev = findEvent('jihun-fight');
  assert('description에 "맨날 공부만" 없음', !ev?.description?.includes('맨날 공부만'));
}

console.log('\n=== 11. 상점 seasonal 아이템: 학기중 차단 / 방학중 허용 ===');
{
  const camp = SHOP_ITEMS.find(i => i.id === 'camp-fee')!;
  let s = setupState();
  s = mutate(s, { money: 20, isVacation: false, year: 2 });
  const blocked = canBuyItem(camp, s, {});
  assert('학기중 camp-fee 구매 차단', !blocked.ok && !!blocked.reason?.includes('방학'));

  s = mutate(s, { isVacation: true });
  const allowed = canBuyItem(camp, s, {});
  assert('방학중 camp-fee 구매 허용', allowed.ok);
}

console.log('\n=== 12. 상점 event_unlock: 배열 push + 재구매 차단 ===');
{
  const contest = SHOP_ITEMS.find(i => i.id === 'contest-fee')!;
  let s = setupState();
  s = mutate(s, { money: 20, year: 2 });
  s.stats.talent = 50;

  const initial = canBuyItem(contest, s, {});
  assert('초기 contest-fee 구매 가능', initial.ok);

  const { newState, messages } = applyItemEffects(contest, s);
  assert('구매 후 unlockedEvents에 "contest" 추가', newState.unlockedEvents?.includes('contest') || false);
  assert('placeholder talent +2 적용', newState.stats.talent === s.stats.talent + 2);
  assert('커스텀 메시지 "대회 참가 신청 완료" 사용', messages.some(m => m.includes('대회 참가 신청 완료')));
  assert('"구매 완료" 기본 문구 미사용', !messages.some(m => m === '대회 참가비 구매 완료! 관련 기회가 열렸다.'));

  const reblock = canBuyItem(contest, newState, {});
  assert('해금된 아이템 재구매 차단', !reblock.ok && reblock.reason === '이미 해금됨');
}

console.log('\n=== 13. 상점 buff 중복 구매 차단: 남은 기간 손실 방지 ===');
{
  const vitamin = SHOP_ITEMS.find(i => i.id === 'vitamin');
  if (!vitamin) {
    console.log('  (vitamin 아이템 없음 — 스킵)');
  } else {
    let s = setupState();
    s = mutate(s, { money: 100, year: 2 });
    const { newState: afterBuy } = applyItemEffects(vitamin, s);
    const buff = afterBuy.activeBuffs?.find(b => vitamin.effects.some(e => e.buffId === b.id));
    assert('vitamin 구매 후 buff 활성화됨', !!buff);

    // 1주 경과 시뮬 (remainingWeeks -1)
    if (buff) {
      afterBuy.activeBuffs = afterBuy.activeBuffs!.map(b => ({ ...b, remainingWeeks: b.remainingWeeks - 1 }));
      const reblock = canBuyItem(vitamin, afterBuy, {});
      assert('buff 활성 중 재구매 차단', !reblock.ok && !!reblock.reason?.includes('이미 활성'));
      assert('차단 메시지에 남은 주수 포함', !!reblock.reason?.match(/\d+주 남음/));
    }
  }
}

console.log('\n=== 14. 결정론적 RNG: 동일 시드 → 동일 이벤트 시퀀스 ===');
{
  // 동일 시드로 시작한 두 플레이가 동일한 이벤트 시퀀스를 만드는지
  function runDeterministic(seed: number, weeks: number): string[] {
    let s = setupState();
    s.rngSeed = seed;
    s.routineSlot2 = 'self-study';
    s.routineSlot3 = 'basketball';
    const eventLog: string[] = [];
    for (let i = 0; i < weeks; i++) {
      s = processWeek(s);
      if (s.currentEvent) {
        eventLog.push(`W${s.week}:${s.currentEvent.id}`);
        s.currentEvent = null;
      }
    }
    return eventLog;
  }
  const run1 = runDeterministic(12345, 50);
  const run2 = runDeterministic(12345, 50);
  const run3 = runDeterministic(99999, 50);
  assert(`동일 시드 2회 실행 이벤트 시퀀스 동일 (${run1.length}개)`, JSON.stringify(run1) === JSON.stringify(run2));
  assert('다른 시드는 다른 시퀀스', JSON.stringify(run1) !== JSON.stringify(run3));
}

console.log('\n=== 15. 48주 × 7년 시뮬: 이벤트 연속 진행 crash 없음 ===');
{
  let s = setupState();
  s.routineSlot2 = 'self-study';
  s.routineSlot3 = 'basketball';
  let crashed = false;
  try {
    for (let i = 0; i < 48 * 7; i++) {
      s = processWeek(s);
      // 이벤트가 뜨면 첫 선택지로 해결
      while (s.currentEvent) {
        const choice = s.currentEvent.choices[0];
        if (!choice) break;
        s.currentEvent = null;
      }
      if (s.year > 7) break;
    }
  } catch (e) {
    crashed = true;
    console.log('    crash:', (e as Error).message);
  }
  assert('48주 × 7년 시뮬 완주', !crashed);
}

console.log(`\n결과: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
