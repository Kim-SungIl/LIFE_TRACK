// @vitest-environment jsdom
// 계획 화면이 엔진에 넘기는 **슬롯 배열의 모양** — 토요일을 비운 채 일요일만 골라도 구멍이 없다. (T53)
//
// 순수함수(weekendSlotArray.test.ts)와 팝업 단위(SlotEditPopup.test.tsx)만 잠그면, 화면이
// 그 통로를 안 거치고 예전처럼 `newArr[idx] = id` 하는 상태가 그대로 그린이다(#397).
// 여기서는 실제로 칸을 눌러 고르고 **확정 버튼까지 눌러** `onConfirmWeek`에 도착한 배열을 본다.
//
// 칸 편집 진입점은 둘이고 서로 다른 파일에 있다:
//   · 일반 활동  → SlotEditPopup의 onToggle
//   · 동행 활동  → NPC 모달을 거쳐 MainWeekScreen의 handleSelectNpc
// 한쪽만 잠그면 다른 쪽이 조용히 구멍을 되살린다.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MainWeekScreen } from '../MainWeekScreen';
import { makeState, withNpc } from '../../../../test/fixtures';
import { getBackground } from '../../../../engine/backgrounds';
import { ACTIVITIES, NPC_COMPANION_ACTIVITIES, getActivityCost } from '../../../../engine/activities';
import type { Activity, GameState } from '../../../../engine/types';
import type { TalkActionResult } from '../../../../engine/store';

const CAT_LABEL: Record<string, string> = {
  study: '공부', exercise: '운동', social: '관계',
  talent: '자기계발', rest: '휴식', parent: '가족', work: '알바',
};

type ConfirmFn = (activities: string[], npcChoices: Record<string, string>) => void;

function renderScreen(patch: Partial<GameState> = {}) {
  const onConfirmWeek = vi.fn<ConfirmFn>();
  const state = makeState({
    isVacation: false, week: 3, year: 1, money: 50,
    routineSlot2: 'self-study', routineSlot3: 'self-study',
    ...patch,
  });
  render(
    <MainWeekScreen
      state={state}
      bgProps={{
        bg: getBackground(state.week, state.isVacation, state.mentalState, state.year),
        bgImgError: true, onImgError: () => {},
      }}
      onSetRoutine={() => {}}
      onTalkNpc={(): TalkActionResult => ({ kind: 'smalltalk', line: '' })}
      onTalkHome={(): TalkActionResult => ({ kind: 'smalltalk', line: '' })}
      onResolveParentChoice={() => {}}
      onBuyItem={() => {}}
      onConfirmWeek={onConfirmWeek}
    />,
  );
  return { onConfirmWeek, state };
}

/** 주말 칸 버튼들(토·일) — WeekPlanner의 "주말 (토~일)" 열에서 고른다. */
function weekendSlotButtons() {
  const column = screen.getByText('주말 (토~일)').parentElement!;
  return within(column).getAllByRole('button');
}

/** 열린 팝업에서 활동 버튼을 누른다(카테고리를 펼친 뒤). */
function clickActivityInPopup(act: Activity) {
  const header = screen.getAllByRole('button').find(
    el => el.getAttribute('aria-expanded') !== null
      && (el.textContent ?? '').includes(CAT_LABEL[act.category]),
  );
  if (!header) throw new Error(`카테고리 헤더를 찾을 수 없습니다: ${act.category}`);
  if (header.getAttribute('aria-expanded') === 'false') fireEvent.click(header);
  const btn = screen.getAllByRole('button').find(el =>
    el.getAttribute('aria-pressed') != null
    && !(el.textContent ?? '').includes('수치')
    && (el.textContent ?? '').includes(act.name));
  if (!btn) throw new Error(`활동 버튼을 찾을 수 없습니다: ${act.name}`);
  fireEvent.click(btn);
}

function confirmWeek() {
  fireEvent.click(screen.getByRole('button', { name: /이번 주 확정/ }));
}

const dense = (arr: string[]) =>
  Object.keys(arr).length === arr.length && arr.every(v => typeof v === 'string');

const freeSolo = ACTIVITIES.find(a =>
  a.slots === 1 && !a.seasonGate && a.category !== 'rest'
  && getActivityCost(a, 1) === 0 && !NPC_COMPANION_ACTIVITIES.includes(a.id))!;
const companion = ACTIVITIES.find(a => a.id === NPC_COMPANION_ACTIVITIES[0])!;

beforeEach(() => {
  localStorage.clear();
  // 튜토리얼 오버레이는 클릭을 조용히 먹는다 — 반복 플레이어 상태로 고정.
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
});

describe('일요일만 고른 주 — 엔진에 도착하는 배열', () => {
  it('전제: 픽스처가 실제 카탈로그에서 나왔다', () => {
    expect(freeSolo, '무료 1칸 비동행 학기 활동이 없으면 이 파일은 아무것도 못 본다').toBeTruthy();
    expect(companion, 'NPC_COMPANION_ACTIVITIES[0]이 카탈로그에 없다').toBeTruthy();
  });

  it('일반 활동: 토요일을 비우고 일요일만 골라도 [\'\', id]로 확정된다', () => {
    const { onConfirmWeek } = renderScreen();
    fireEvent.click(weekendSlotButtons()[1]);   // 일요일 칸
    clickActivityInPopup(freeSolo);
    confirmWeek();

    expect(onConfirmWeek).toHaveBeenCalledTimes(1);
    const arr = onConfirmWeek.mock.calls[0][0];
    expect(dense(arr), `구멍이 남았다: ${JSON.stringify(Object.keys(arr))}`).toBe(true);
    expect(arr).toEqual(['', freeSolo.id]);
  });

  it('동행 활동: NPC 모달을 거친 칸도 [\'\', id]로 확정된다 (handleSelectNpc 경로)', () => {
    const friendId = 'jihun';
    const { state, onConfirmWeek } = renderScreen({
      npcs: withNpc(makeState().npcs, friendId, { met: true, intimacy: 60 }),
    });
    const friend = state.npcs.find(n => n.id === friendId)!;

    fireEvent.click(weekendSlotButtons()[1]);   // 일요일 칸
    clickActivityInPopup(companion);
    // 동행 활동은 슬롯을 바로 채우지 않고 NPC 모달을 연다 — 친구를 골라야 칸이 찬다.
    const friendBtn = screen.getAllByRole('button').find(el => (el.textContent ?? '').includes(friend.name));
    expect(friendBtn, `NPC 모달에 ${friend.name}이 없다 — 동행 경로에 도달하지 못했다`).toBeTruthy();
    fireEvent.click(friendBtn!);
    confirmWeek();

    expect(onConfirmWeek).toHaveBeenCalledTimes(1);
    const [arr, npcChoices] = onConfirmWeek.mock.calls[0];
    expect(dense(arr), `구멍이 남았다: ${JSON.stringify(Object.keys(arr))}`).toBe(true);
    expect(arr).toEqual(['', companion.id]);
    // 동행 키는 `${activityId}:${slotIdx}` — 배열을 압축하면 이 키가 가리키는 칸이 어긋난다.
    expect(npcChoices, '동행 키의 슬롯 번호와 배열 인덱스가 같아야 한다')
      .toEqual({ [`${companion.id}:1`]: friendId });
  });

  // 음성 짝 — 토요일부터 채운 주는 앞에 빈 칸이 붙지 않는다.
  // 없으면 "항상 맨 앞에 ''를 끼우는" 구현도 위 두 테스트를 통과한다.
  it('토요일부터 채운 주에는 빈 칸이 붙지 않는다', () => {
    const { onConfirmWeek } = renderScreen();
    fireEvent.click(weekendSlotButtons()[0]);   // 토요일 칸
    clickActivityInPopup(freeSolo);
    confirmWeek();
    expect(onConfirmWeek.mock.calls[0][0]).toEqual([freeSolo.id]);
  });
});
