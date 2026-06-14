// Phase 4D 검증 — 사춘기 골짜기 (중2~3 한시 배율 하락 + 방문 쾅 + 화해 비트)
//
// 범위:
//  D1. 한시 배율 — Y3~4엔 familyTime/shareWorry ×0.75 (그 외 학년·다른 태그는 불변)
//  D2. clash 발동 게이트 — Y3 W26 전 부모 발동 / 엉뚱 주차·다른 학년 미발동
//  D3. reconcile 해금 — Y5 W26 + clash 발동기록 + 친밀도≥60 일 때만 / 미충족 시 미발동
//  D4. 태그·스탯 — clash 방문쾅=hideProblem(−)·솔직=shareWorry(+) / reconcile 전부 +(화해) / 스탯 절제
//  D5. resolveEvent 실경유 — 방문쾅 친밀도 하락 / 화해 상승 + 회상 슬롯
//
// 실행: cd game && npx tsx scripts/verify/verify-parent-adolescence.ts

{
  const mem = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => { mem.set(k, v); },
    removeItem: (k: string) => { mem.delete(k); },
    clear: () => { mem.clear(); },
    key: () => null,
    length: 0,
  } as Storage;
}

import { createInitialState } from '../../src/engine/gameEngine';
import { getEventForWeek } from '../../src/engine/events';
import { ADOLESCENCE_EVENTS } from '../../src/engine/events/parent-adolescence';
import { applyParentIntimacyDelta } from '../../src/engine/parentIntimacy';
import { useGameStore } from '../../src/engine/store';
import type { GameState, ParentStrength } from '../../src/engine/types';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; }
  else { fail++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

function st(parents: [ParentStrength, ParentStrength], year: number, week: number, extra: Partial<GameState> = {}): GameState {
  return { ...createInitialState('male', parents), year, week, ...extra } as GameState;
}
// 같은 강점/친밀도에서 한 번의 델타 적용량 측정(태그·학년만 바꿔서 비교)
function deltaFor(parents: [ParentStrength, ParentStrength], year: number, tag: Parameters<typeof applyParentIntimacyDelta>[2]): number {
  const s = st(parents, year, 10, { parentIntimacy: 50 });
  return applyParentIntimacyDelta(s, 1.0, tag);
}

// ---- D1: 한시 배율 (Y3~4 familyTime/shareWorry ×0.75) ----
console.log('D1. 사춘기 한시 배율 하락 (Y3~4, familyTime/shareWorry ×0.75)');
{
  const P: [ParentStrength, ParentStrength] = ['emotional', 'resilience']; // familyTime: emotional 1.4
  const y2 = deltaFor(P, 2, 'familyTime');
  const y3 = deltaFor(P, 3, 'familyTime');
  const y4 = deltaFor(P, 4, 'familyTime');
  const y5 = deltaFor(P, 5, 'familyTime');
  check('Y3 familyTime ≈ Y2 ×0.75', Math.abs(y3 - y2 * 0.75) < 1e-9, `y2=${y2.toFixed(3)} y3=${y3.toFixed(3)}`);
  check('Y4 familyTime ≈ Y2 ×0.75', Math.abs(y4 - y2 * 0.75) < 1e-9, `y4=${y4.toFixed(3)}`);
  check('Y5 familyTime = Y2 (정상 복귀)', Math.abs(y5 - y2) < 1e-9, `y5=${y5.toFixed(3)}`);
  // shareWorry도 동일 (emotional shareWorry 1.4)
  const sw2 = deltaFor(P, 2, 'shareWorry');
  const sw3 = deltaFor(P, 3, 'shareWorry');
  check('Y3 shareWorry ≈ Y2 ×0.75', Math.abs(sw3 - sw2 * 0.75) < 1e-9, `sw2=${sw2.toFixed(3)} sw3=${sw3.toFixed(3)}`);
  // 다른 태그는 불변 (careerTalk: info만 영향이라 emotional/resilience엔 1.0배 → Y3=Y2)
  const ct2 = deltaFor(['info', 'emotional'], 2, 'careerTalk');
  const ct3 = deltaFor(['info', 'emotional'], 3, 'careerTalk');
  check('Y3 careerTalk = Y2 (비대상 태그 불변)', Math.abs(ct3 - ct2) < 1e-9, `ct2=${ct2.toFixed(3)} ct3=${ct3.toFixed(3)}`);
}

// ---- D2: clash 발동 게이트 ----
console.log('D2. clash(방문 쾅) — Y3 W26 전 부모 발동');
function picked(s: GameState): string | undefined { return getEventForWeek(s).event?.id; }
for (const P of [['emotional', 'resilience'], ['wealth', 'strict'], ['freedom', 'info']] as [ParentStrength, ParentStrength][]) {
  check(`${P.join('+')} Y3 W26 → clash`, picked(st(P, 3, 26)) === 'adolescence-clash');
}
check('Y3 W25 → clash 미발동', picked(st(['emotional', 'resilience'], 3, 25)) !== 'adolescence-clash');
check('Y4 W26 → clash 미발동(Y3 전용)', picked(st(['emotional', 'resilience'], 4, 26)) !== 'adolescence-clash');

// ---- D3: reconcile 해금 ----
console.log('D3. reconcile(화해) — Y5 W26 + clash 기록 + 친밀도≥60');
const clashRec = [{ id: 'adolescence-clash', week: 26, year: 3 }] as GameState['events'];
check('clash 봄 + pi65 → reconcile', picked(st(['emotional', 'resilience'], 5, 26, { events: clashRec, parentIntimacy: 65 })) === 'adolescence-reconcile');
check('clash 봄 + pi59 → 미발동(미회복)', picked(st(['emotional', 'resilience'], 5, 26, { events: clashRec, parentIntimacy: 59 })) !== 'adolescence-reconcile');
check('clash 안 봄 + pi80 → 미발동(골짜기 없었음)', picked(st(['emotional', 'resilience'], 5, 26, { events: [], parentIntimacy: 80 })) !== 'adolescence-reconcile');

// ---- D4: 태그·스탯 절제 ----
console.log('D4. 태그 정합 + 스탯 절제');
{
  const clash = ADOLESCENCE_EVENTS.find(e => e.id === 'adolescence-clash')!;
  check('방문쾅 = hideProblem(−)', clash.choices[0].parentEffect?.tag === 'hideProblem' && (clash.choices[0].parentEffect?.baseDelta ?? 0) < 0);
  check('솔직 = shareWorry(+)', clash.choices[2].parentEffect?.tag === 'shareWorry' && (clash.choices[2].parentEffect?.baseDelta ?? 0) > 0);
  const rec = ADOLESCENCE_EVENTS.find(e => e.id === 'adolescence-reconcile')!;
  check('화해 선택 전부 +(친밀도)', rec.choices.every(c => (c.parentEffect?.baseDelta ?? 0) > 0));
  for (const e of ADOLESCENCE_EVENTS) {
    for (const c of e.choices) {
      const m = c.effects.mental ?? 0, a = c.effects.academic ?? 0;
      check(`${e.id} "${c.text.slice(0, 8)}" 스탯 절제`, Math.abs(m) <= 3 && Math.abs(a) <= 1 && !('parentIntimacy' in c.effects));
    }
  }
}

// ---- D5: resolveEvent 실경유 ----
console.log('D5. resolveEvent 실경유 (친밀도·회상)');
function resolve(eventId: string, choiceIdx: number, base: GameState) {
  const ev = ADOLESCENCE_EVENTS.find(e => e.id === eventId)!;
  useGameStore.setState({ state: { ...base, currentEvent: ev, phase: 'event' } as GameState });
  useGameStore.getState().resolveEvent(choiceIdx);
  return useGameStore.getState().state!;
}
{
  const r = resolve('adolescence-clash', 0, st(['emotional', 'resilience'], 3, 26, { parentIntimacy: 60 }));
  check('방문쾅 → 친밀도 하락', (r.parentIntimacy ?? 50) < 60, `pi=${r.parentIntimacy}`);
  check('방문쾅 → betrayal 회상 생성', r.memorySlots.some(m => m.sourceEventId === 'adolescence-clash' && m.category === 'betrayal'));
}
{
  const r = resolve('adolescence-reconcile', 0, st(['emotional', 'resilience'], 5, 26, { parentIntimacy: 65, events: clashRec }));
  check('화해 → 친밀도 상승', (r.parentIntimacy ?? 50) > 65, `pi=${r.parentIntimacy}`);
  check('화해 → reconciliation 회상 생성(importance5)', r.memorySlots.some(m => m.sourceEventId === 'adolescence-reconcile' && m.importance === 5));
}

console.log(`\n사춘기 골짜기 검증: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
