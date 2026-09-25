// @vitest-environment jsdom
// T46: 가벼운 사건(light-result.ts)은 결과 화면("계속 →")을 건너뛰고 곧장 주간 결산으로 간다.
// 잡무 1건 = 화면 2·탭 2·같은 문장 3회 노출이던 경로를 화면 1·탭 1·문장 1회로.
//
// 순수 집합(light-result.ts)만 잠그면 GameScreen.onChoice가 그 집합을 안 읽는 상태가 그린이다
// (#381·#397·#431 전례). 그래서 여기는 **배선**을 본다 — 실제 GameScreen을 그리고 선택지를
// 눌러 어느 화면이 뜨는지를 본다. 집합의 자격(카탈로그 파생)은 engine/__tests__/lightResultEvents.test.ts.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../engine/assetWebp', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../engine/assetWebp')>()),
  webpSrc: (p: string) => `WEBP::${p}`,
}));
vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));
vi.mock('../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));
// idle 예약을 삼킨다 — 실행되게 두면 테스트 도중 청크 import가 떠서 비결정적이 된다.
vi.mock('../../engine/assetPrefetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../engine/assetPrefetch')>()),
  runWhenIdle: () => () => {},
}));

import { GameScreen } from '../GameScreen';
import { clearArchive } from '../../engine/archive';
import { useGameStore } from '../../engine/store';
import { createInitialState } from '../../engine/gameEngine';
import { assignCurrentEvent } from '../../engine/eventPresentation';
import { GAME_EVENTS } from '../../engine/events';
import { LIGHT_RESULT_EVENT_IDS } from '../../engine/events/light-result';
import { FOLLOWUP_EVENT_IDS, DIRECT_SEQUEL_IDS } from '../../engine/events/constants';
import type { GameEvent, GameState, ParentStrength, WeekLog } from '../../engine/types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];
const OCCURRENCE_WEEK = 6;

const catalog = (id: string): GameEvent => {
  const ev = GAME_EVENTS.find(e => e.id === id);
  if (!ev) throw new Error(`카탈로그에 ${id} 없음`);
  return ev;
};
// 기록 항목 — 체인 가드·followup 조건이 읽는 필드만 채운다.
const record = (id: string, resolvedChoice = 0): GameEvent =>
  ({ id, title: id, description: '', choices: [], resolvedChoice, week: OCCURRENCE_WEEK, year: 1 }) as GameEvent;

const freshLog = (): WeekLog => ({
  statChanges: {}, fatigueChange: 0, moneyChange: 0, messages: [], skipped: [],
  milestoneMessages: [], year: 1, week: OCCURRENCE_WEEK,
});

/**
 * "이벤트가 떠 있는 주" 픽스처. processWeek이 로그를 확정하고 week++를 돌린 뒤라
 * state.week은 발생주+1이고 currentEvent.week이 발생주다(store.resolveEvent 주석).
 * assignCurrentEvent로 굽는다 — 화면이 보여주는 변이 문장과 currentEvent.choices가 같아야
 * 선택지를 문장으로 찾아 누를 수 있다.
 */
function eventWeek(evt: GameEvent, events: GameEvent[]): GameState {
  const s = createInitialState('male', PARENTS, { rngSeed: 12345 });
  s.year = 1;
  s.week = OCCURRENCE_WEEK + 1;
  s.events = events;
  s.talkEventsFired = [];
  s.weekLog = freshLog();
  assignCurrentEvent(s, evt, OCCURRENCE_WEEK);
  return s;
}

/**
 * 체인이 **막힌** 주 — 해결 뒤 곧장 결산(phase 'result')으로 떨어지는 조건을 store 규칙에서 만든다:
 *  - 같은 주에 (DIRECT_SEQUEL이 아닌) followup이 이미 있으면 followup을 안 건다.
 *  - 같은 주 이벤트가 3건 이상이면 conditional/milestone chain도 안 건다.
 * 이 둘은 resolveEventChain의 규칙이라, 규칙이 바뀌면 아래 전제 단언이 먼저 알려 준다.
 */
function blockedChainRecords(): GameEvent[] {
  const followup = [...FOLLOWUP_EVENT_IDS].find(id => !DIRECT_SEQUEL_IDS.has(id));
  if (!followup) throw new Error('DIRECT_SEQUEL이 아닌 followup id가 하나는 있어야 한다');
  return [record(followup), record('__filler-1'), record('__filler-2')];
}

/** 긴 본문은 여러 페이지로 갈리고 선택지는 마지막 페이지에서만 열린다 — 끝까지 넘긴다. */
function advanceToChoices() {
  for (let i = 0; i < 10; i++) {
    const next = screen.queryByRole('button', { name: '다음 페이지' }) as HTMLButtonElement | null;
    if (!next || next.disabled) return;
    fireEvent.click(next);
  }
}

async function pickFirstChoice(state: GameState) {
  const text = state.currentEvent!.choices[0].text;
  // EventScene은 lazy 청크라 처음엔 Suspense fallback(role=status)만 있다 — 선택지가 올 때까지 기다린다.
  await screen.findByText(text);
  advanceToChoices();
  const btn = screen.getByText(text).closest('button');
  if (!btn) throw new Error(`선택지 버튼을 못 찾음: ${text}`);
  fireEvent.click(btn);
}

const continueBtn = () => screen.queryByRole('button', { name: '계속 →' });
const nextWeekBtn = () => screen.queryByRole('button', { name: '다음 주로 →' });

beforeEach(() => {
  clearArchive();
  localStorage.clear();
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
  useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
});

// 집합의 첫 원소를 쓴다 — 리터럴 id를 박으면 집합에서 그 id를 빼도 테스트가 옛 id를 계속 본다.
const lightId = [...LIGHT_RESULT_EVENT_IDS][0];

describe('가벼운 사건은 결과 화면 없이 결산으로 간다 (T46)', () => {
  it('전제: 집합이 비어 있지 않다', () => {
    expect(lightId, 'LIGHT_RESULT_EVENT_IDS가 비었다 — 아래 테스트가 볼 대상이 없다').toBeTruthy();
  });

  it('(a) 집합의 사건을 고르면 "계속 →"이 뜨지 않고 주간 결산이 바로 뜬다', async () => {
    const s = eventWeek(catalog(lightId), blockedChainRecords());
    useGameStore.setState({ state: s });
    render(<GameScreen />);
    expect(nextWeekBtn(), '누르기 전엔 결산이 없어야 한다').toBeNull();

    await pickFirstChoice(s);

    const after = useGameStore.getState().state!;
    expect(after.phase, '전제: 체인이 막힌 픽스처라 해결 직후 phase는 result여야 한다').toBe('result');
    expect(after.currentEvent).toBeNull();
    // WeeklyResultScreen은 eager라 같은 렌더에 뜬다. 결과 화면(lazy)이 끼면 Suspense fallback이
    // 이 자리를 차지해 "다음 주로 →"가 없다 — 분기를 지우면 여기서 빨강.
    expect(await screen.findByRole('button', { name: '다음 주로 →' })).toBeTruthy();
    expect(continueBtn(), '가벼운 사건인데 결과 화면("계속 →")이 떴다').toBeNull();
    expect(screen.queryByRole('status'), '결과 화면 청크 fallback이 떠 있다 — 결과 화면으로 갔다는 뜻').toBeNull();
  });

  it('(d) 생략 경로에서도 결과 문장이 결산 hero에 실린다 (store가 push, 결과 화면과 무관)', async () => {
    const s = eventWeek(catalog(lightId), blockedChainRecords());
    const message = s.currentEvent!.choices[0].message;
    useGameStore.setState({ state: s });
    render(<GameScreen />);

    await pickFirstChoice(s);
    await screen.findByRole('button', { name: '다음 주로 →' });

    const log = useGameStore.getState().state!.weekLog!;
    const narrations = log.messages.filter(m => m.startsWith('📖'));
    // WeeklyResultScreen의 hero 규칙: 📖 **마지막** 줄. 생략은 "뒤에 사건이 안 걸렸을 때"만이므로
    // 생략된 사건의 문장은 언제나 마지막 📖 = hero다(앞에 다른 사건이 있었어도).
    expect(narrations.at(-1), '결과 문장이 weekLog 📖 마지막 줄이 아니다 — hero에 못 오른다').toBe(`📖 ${message}`);
    // DOM에도 실제로 그려진다(breakSentences가 문장 사이에 줄바꿈을 넣으므로 공백을 접어 비교).
    const norm = (t: string) => t.replace(/\s+/g, ' ').trim();
    const drawn = screen.getAllByText((_, el) => !!el && el.children.length === 0 && norm(el.textContent ?? '') === norm(message));
    expect(drawn.length, '결산 화면에 결과 문장이 안 그려졌다').toBeGreaterThanOrEqual(1);
  });

  it('(b) 음성 대조 — 집합 밖 사건은 결과 화면이 그대로 뜬 뒤 "계속 →"으로 결산에 간다', async () => {
    // 잡무와 같은 반장 축의 이웃(비반장 관찰) — 선택지 조건·비용이 없어 첫 선택지를 바로 누를 수 있다.
    const control = catalog('watching-president');
    expect(LIGHT_RESULT_EVENT_IDS.has(control.id), '전제: 대조군은 집합 밖이어야 한다').toBe(false);
    const s = eventWeek(control, blockedChainRecords());
    useGameStore.setState({ state: s });
    render(<GameScreen />);

    await pickFirstChoice(s);

    expect(useGameStore.getState().state!.phase, '전제: 대조군도 해결 직후 phase는 result').toBe('result');
    const cont = await screen.findByRole('button', { name: '계속 →' });
    expect(nextWeekBtn(), '결과 화면이 떠 있는 동안 결산이 먼저 그려지면 안 된다').toBeNull();
    fireEvent.click(cont);
    expect(await screen.findByRole('button', { name: '다음 주로 →' })).toBeTruthy();
  });

  it('(c) 집합의 사건이라도 followup이 이어지면 결과 화면을 유지한다', async () => {
    // 반장 선거에서 손을 든 기록 → 해결 직후 store가 DIRECT_SEQUEL(연설/결과)을 건다.
    const s = eventWeek(catalog(lightId), [record('class-president', 0)]);
    useGameStore.setState({ state: s });
    render(<GameScreen />);

    await pickFirstChoice(s);

    const after = useGameStore.getState().state!;
    expect(after.phase, '전제: 이 픽스처는 followup이 걸려야 한다 (phase event)').toBe('event');
    expect(after.currentEvent?.id, '전제: 다음 이벤트가 걸려 있어야 한다').toBeTruthy();
    expect(DIRECT_SEQUEL_IDS.has(after.currentEvent!.id), '전제: 걸린 게 선거 직접 후속이어야 한다').toBe(true);
    // 체인 가드를 지우면 결과 화면 없이 다음 EventScene이 바로 떠서 "계속 →"이 영영 없다.
    expect(await screen.findByRole('button', { name: '계속 →' })).toBeTruthy();
    // 이때 결과 문장은 hero(마지막 📖)가 아니라 결산 목록으로 밀린다 — 뒤 사건의 문장이 hero를
    // 가져간다. 그래서 결과 화면이 이 문장을 또렷이 보여주는 유일한 자리이고, 유지가 맞다.
    expect(after.weekLog!.messages.some(m => m.startsWith('📖'))).toBe(true);
  });
});
