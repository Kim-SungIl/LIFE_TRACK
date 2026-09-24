// @vitest-environment jsdom
// "지난주처럼"의 **배선** 계약 — 계획 화면 → GameScreen → store → 세이브까지 한 줄로 잇는다.
//
// 판정(engine/__tests__/weekendPlan.test.ts)과 렌더(MainWeekScreenRepeat.test.tsx)는
// 각자의 층만 본다. 그 둘이 전부 초록인 채로 **아무도 스냅샷을 남기지 않는** 상태가 가능하다
// (#397: 훅을 잠가도 App이 부르는지는 별개). 그래서 여기서는 GameScreen을 실제로 렌더해
// 슬롯을 고르고 확정까지 눌러 store의 state를 읽는다.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../../engine/assetWebp', () => ({ webpSrc: (p: string) => p, cgThumbSrc: (p: string) => p }));
vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));
vi.mock('../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));

import { GameScreen } from '../GameScreen';
import { useGameStore, loadFromStorage } from '../../engine/store';
import { createInitialState } from '../../engine/gameEngine';
import { ACTIVITIES } from '../../engine/activities';
import { getRepeatablePlan } from '../../engine/weekendPlan';
import type { GameState, ParentStrength } from '../../engine/types';

const PARENTS: [ParentStrength, ParentStrength] = ['emotional', 'info'];
const NAME = (id: string) => ACTIVITIES.find(a => a.id === id)!.name;
const CAT_LABEL: Record<string, string> = {
  study: '공부', exercise: '운동', social: '관계', talent: '자기계발',
  rest: '휴식', parent: '가족', work: '알바',
};

/** 주간 계획 화면에 바로 서 있는 판 — 루틴은 채워 둔다(미설정은 확정이 막히는 별개 축). */
function weekdayState(patch: Partial<GameState> = {}): GameState {
  const s = createInitialState('male', PARENTS, { rngSeed: 4242 });
  return Object.assign(s, {
    phase: 'weekday' as const, year: 1, week: 3, money: 10,
    routineSlot2: 'self-study', routineSlot3: 'self-study',
    currentEvent: null,
  }, patch);
}

function put(state: GameState): void {
  useGameStore.setState({ state, npcActivityMap: {} });
}

/** 슬롯을 열어 활동을 고른다 — 실제 플레이 경로(슬롯 탭 → 편집 팝업 → 활동 버튼). */
function pickActivity(id: string, slotLabel: string): void {
  const act = ACTIVITIES.find(a => a.id === id)!;
  fireEvent.click(screen.getByText(slotLabel).closest('button')!);
  const header = screen.getAllByRole('button').find(
    el => el.getAttribute('aria-expanded') !== null
      && (el.textContent ?? '').includes(CAT_LABEL[act.category]),
  );
  if (!header) throw new Error(`카테고리 헤더 없음: ${act.category}`);
  if (header.getAttribute('aria-expanded') === 'false') fireEvent.click(header);
  const btn = screen.getAllByRole('button').find(el =>
    el.getAttribute('aria-pressed') != null
    && !(el.textContent ?? '').includes('수치')
    && (el.textContent ?? '').includes(act.name));
  if (!btn) throw new Error(`활동 버튼 없음: ${act.name}`);
  fireEvent.click(btn);
}

const confirmWeek = () => fireEvent.click(screen.getByRole('button', { name: /확정|주말은 쉰다/ }));
const repeatButton = () => screen.queryByRole('button', { name: /지난주처럼/ });
const current = () => useGameStore.getState().state!;

beforeEach(() => {
  cleanup();
  localStorage.clear();
  // 튜토리얼 오버레이는 클릭을 조용히 먹는다 / 빈 주말 되묻기도 끈다.
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
  localStorage.setItem('lifetrack_rest_ack', '1');
  useGameStore.setState({ state: null, npcActivityMap: {} });
});

describe('확정이 스냅샷을 남긴다', () => {
  it('주말 슬롯을 고르고 확정하면 계획이 state에 남는다 (processWeek을 타고 넘어온다)', () => {
    put(weekdayState());
    render(<GameScreen />);
    expect(current().lastWeekendPlan, '시작부터 스냅샷이 있다 — 전제가 깨졌다').toBeUndefined();

    pickActivity('reading', '토요일');
    pickActivity('library', '일요일');
    confirmWeek();

    expect(current().lastWeekendPlan, '확정했는데 아무도 계획을 안 적었다').toEqual({
      activities: ['reading', 'library'],
      npcChoices: {},
      isVacation: false,
    });
    expect(current().week, '주가 안 넘어갔다 — 확정 자체가 안 됐다').toBe(4);
  });

  it('빈 주말을 확정하면 스냅샷을 지운다 — 두 주 전 계획을 "지난주"라고 하지 않는다', () => {
    put(weekdayState({
      lastWeekendPlan: { activities: ['reading'], npcChoices: {}, isVacation: false },
    }));
    render(<GameScreen />);
    confirmWeek();
    expect(current().lastWeekendPlan, '아무것도 안 한 주 뒤에도 지난주 계획이 남아 있다').toBeUndefined();
  });
});

describe('다음 주에 1탭으로 되살린다', () => {
  it('버튼이 슬롯을 채우되 주를 넘기지 않는다 (주차·잔액 불변)', () => {
    put(weekdayState({
      lastWeekendPlan: { activities: ['reading', 'library'], npcChoices: {}, isVacation: false },
    }));
    render(<GameScreen />);
    const before = { week: current().week, money: current().money, played: current().totalWeeksPlayed };

    const btn = repeatButton();
    expect(btn, '유효한 지난주 계획인데 버튼이 없다').toBeTruthy();
    fireEvent.click(btn!);

    expect(screen.getAllByText(NAME('reading')).length, '토요일 칸이 안 찼다').toBeGreaterThan(0);
    expect(screen.getAllByText(NAME('library')).length, '일요일 칸이 안 찼다').toBeGreaterThan(0);
    expect(current().week, '1탭 복사가 주를 넘겼다').toBe(before.week);
    expect(current().money, '1탭 복사가 돈을 썼다').toBe(before.money);
    expect(current().totalWeeksPlayed).toBe(before.played);

    // 확정은 기존 CTA가 한다 — 그때서야 주가 넘어간다.
    confirmWeek();
    expect(current().week).toBe(before.week + 1);
  });

  it('확정 → 다음 주 → 1탭 복사 → 확정이 같은 계획을 두 번 돌린다 (336주가 줄어드는 자리)', () => {
    put(weekdayState());
    const { rerender } = render(<GameScreen />);
    pickActivity('reading', '토요일');
    confirmWeek();
    const snapshot = current().lastWeekendPlan;

    // 결산/이벤트를 건너뛰고 다음 계획 화면으로 — 이 테스트가 보는 건 계획 화면의 연속성이다.
    put({ ...current(), phase: 'weekday', currentEvent: null });
    rerender(<GameScreen />);

    expect(getRepeatablePlan(current()), '다음 주에 복사 대상이 사라졌다').not.toBeNull();
    fireEvent.click(repeatButton()!);
    confirmWeek();
    expect(current().lastWeekendPlan, '두 번째 주의 계획이 첫 주와 다르다').toEqual(snapshot);
  });
});

describe('세이브 왕복 — 새로고침 뒤에도 남는다', () => {
  it('저장된 스냅샷이 로드 뒤에도 그대로다', () => {
    put(weekdayState());
    render(<GameScreen />);
    pickActivity('reading', '토요일');
    confirmWeek();
    // T36(#467)부터 loadFromStorage는 판별 가능한 결과를 낸다 — 읽었으면 `ok`, 그 안의 `data`가
    // 세이브다. 읽기 실패를 `null`로 접지 않으므로 여기서도 `kind`를 먼저 단언한다.
    const saved = loadFromStorage();
    expect(saved.kind, '확정 직후 세이브가 읽히지 않는다').toBe('ok');
    if (saved.kind !== 'ok') throw new Error('unreachable');
    expect(saved.data.state.lastWeekendPlan, '자동 저장이 계획을 안 실었다').toEqual({
      activities: ['reading'], npcChoices: {}, isVacation: false,
    });

    useGameStore.setState({ state: null });
    expect(useGameStore.getState().loadSavedGame()).toBe(true);
    expect(current().lastWeekendPlan).toEqual(saved.data.state.lastWeekendPlan);
  });

  it('스냅샷이 없는 구세이브도 그대로 열리고, 버튼만 안 뜬다 (부재를 거부하지 않는다)', () => {
    const legacy = weekdayState();
    delete (legacy as Partial<GameState>).lastWeekendPlan;
    localStorage.setItem('lifetrack_save', JSON.stringify({
      version: 1, savedAt: '2026-01-01T00:00:00Z', state: JSON.parse(JSON.stringify(legacy)),
    }));

    expect(useGameStore.getState().loadSavedGame(), '구세이브가 열리지 않는다').toBe(true);
    expect(current().lastWeekendPlan).toBeUndefined();
    render(<GameScreen />);
    expect(repeatButton(), '없는 지난주를 채우겠다고 한다').toBeNull();
    // 구세이브에서도 한 주만 돌리면 정상적으로 스냅샷이 생긴다 (양방향)
    pickActivity('reading', '토요일');
    confirmWeek();
    expect(current().lastWeekendPlan?.activities).toEqual(['reading']);
  });
});
