// 한 달 자동 진행 동등성 — 같은 달 계획을 재생으로 돌린 판과 손으로 한 주씩 누른 판이 **매 결산마다** 같은 상태인가.
// 설계안 §12-5: 재생은 새 진행 경로가 아니라 그 주 계획 칸으로 store.confirmWeek을 부르는 얇은 드라이버여야 한다.
// 장치는 scripts/lib/week-driver.ts `driveMonthly` — store를 구독해 결산 진입마다 지문을 뜬다(재생 장부 monthRun·talkBank 제외).
//
// 이 판들이 밟는 재생 경로: 시작 · 카드 → 다음 주 · 💬로 경계 멈춤 → 대화 → 재개 · 계절 경계 멈춤(7월·1월) ·
// 번아웃 멈춤(있으면) · 계획 깨짐 → 남은 주 다시 짜기 → 재개 · 월말 결산 → 다음 달. 초대 수락(약속 지킴/깨짐)·거절.
import { beforeAll, describe, expect, it } from 'vitest';
import {
  GOLDEN_SEEDS, MONTH_PERSONAS, driveMonthly, firstDivergence, installMemoryStorage, type MonthDriveResult,
} from '../../../scripts/lib/week-driver';
import type { useGameStore as UseGameStore } from '../store';

let store: typeof UseGameStore;
let storage: Map<string, string>;
beforeAll(async () => {
  storage = installMemoryStorage();
  store = (await import('../store')).useGameStore;
});

describe.each(MONTH_PERSONAS.flatMap(p => GOLDEN_SEEDS.map(seed => [p.name, seed] as const)))('%s · 시드 %i', (name, seed) => {
  const persona = MONTH_PERSONAS.find(p => p.name === name)!;
  let manual: MonthDriveResult;
  let playback: MonthDriveResult;
  beforeAll(() => {
    manual = driveMonthly(store, persona, seed, 'manual', { storage });
    playback = driveMonthly(store, persona, seed, 'playback', { storage });
    // 한 판 336주 × 두 판. 혼자면 몇 초지만 전체 병렬 실행에선 기본 훅 한도(10초)를 넘는다(골든 테스트도 30초).
  }, 60_000);

  it('두 판 다 엔딩까지 가고 결산 수가 같다(주를 두 번 처리하거나 건너뛰지 않는다)', () => {
    expect(manual.reachedEnding).toBe(true);
    expect(playback.reachedEnding).toBe(true);
    expect(playback.counters.weeks).toBe(manual.counters.weeks);
    // 7년 = 336주. 엔딩 직전 수능 이후 몇 주는 진로 장면이 곧장 엔딩으로 보내 결산이 없을 수 있다.
    expect(manual.counters.weeks).toBeGreaterThan(300);
  });

  it('매 결산의 상태 지문이 바이트 동일하다', () => {
    const at = firstDivergence(manual.digests, playback.digests);
    expect(at, at < 0 ? '' : `첫 차이: ${manual.coords[at]} (재생 ${playback.coords[at]})`).toBe(-1);
  });

  it('재생 판이 월말 결산·대화 멈춤을 실제로 지났다(경로가 비어 있으면 위 동등성은 공허하다)', () => {
    // 12달 × 7년 − 학년말이 대신하는 2월 7번 = 77번. 첫 달은 W1부터라 빠짐없다.
    expect(playback.counters.summaries).toBe(77);
    expect(playback.counters.stops.season ?? 0, '섞인 달(7월·1월)의 계절 경계 멈춤').toBeGreaterThanOrEqual(14);
    if (persona.talk) {
      expect(playback.counters.stops.talk ?? 0).toBeGreaterThan(0);
      expect(playback.counters.talks).toBe(manual.counters.talks);
      expect(playback.counters.talks).toBeGreaterThan(0);
    }
    if (persona.companion) {
      expect(playback.counters.invitesAccepted).toBeGreaterThan(0);
      expect(playback.counters.promisesKept + playback.counters.promisesBroken).toBe(playback.counters.invitesAccepted);
    }
    expect(playback.counters.invitesDeclined).toBeGreaterThan(0);
    expect(playback.counters.replans).toBe(manual.counters.replans);
  });

  it('재생 중에도 매 변경 저장이 store와 같고, 엔딩 기록이 남는다', () => {
    expect(playback.checks.savesCompared).toBe(playback.counters.weeks);
    expect(playback.checks.saveMismatches).toBe(0);
    expect(playback.checks.runDeltaAtEnding).toBe(true);
    expect(playback.checks.archiveWritten).toBe(true);
  });
});
