// @vitest-environment jsdom
// 기록 저장이 실패했을 때 **화면이 거짓말하지 않는지** — T57.
//
// 엔진 쪽 신호는 engine/__tests__/archiveSaveSignal.test.ts가 본다. 신호가 서도 화면이
// 안 읽으면 결함은 그대로이고, 그 배선은 컴포넌트 한 줄이라 엔진 테스트로는 전부 그린이다
// (archiveWiring.test.tsx가 같은 이유로 존재한다).
//
// 원칙 둘을 같이 잠근다:
//   · 플레이어의 성취를 **숨기지 않는다** — 요약 자체를 없애는 건 과한 처방이다.
//   · "기록이 남지 않았다"는 **사실이 보인다.**
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import { RunArchiveSummary } from '../RunArchiveSummary';
import { ArchiveScreen } from '../ArchiveScreen';
import {
  accrueResolvedEvent, beginRun, clearArchive, commitRun, isArchiveSaveFailed, loadArchive,
} from '../../../engine/archive';
import { createInitialState } from '../../../engine/gameEngine';
import type { GameEvent, GameState, ParentStrength } from '../../../engine/types';
import type { RunDelta } from '../../../engine/archive';
import { failWritesTo } from '../../../test/failingStorage';

const ARCHIVE_KEY = 'lifetrack_archive';
const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];

const ev = (id: string): GameEvent =>
  ({ id, title: id, description: '', choices: [] }) as GameEvent;

function runState(overrides: Partial<GameState> = {}): GameState {
  const s = createInitialState('male', PARENTS, { rngSeed: 12345 });
  s.events = [];
  s.talkEventsFired = [];
  return Object.assign(s, overrides);
}

/** 기록 쓰기를 한 번 실패시켜 신호를 세운다(그 뒤 스토리지는 정상으로 되돌린다). */
function raiseSignal(): void {
  const restore = failWritesTo(ARCHIVE_KEY);
  try { beginRun(); } finally { restore(); }
}

const WARN_SUMMARY = '이 학창시절은 기록실에 남지 않았어요';
const WARN_ARCHIVE = '기록이 저장되지 않고 있어요';

beforeEach(() => {
  clearArchive();
  localStorage.clear();
  // 신호는 모듈 전역이라 성공한 쓰기로만 내려간다 — 앞 테스트가 세운 것을 여기서 되돌린다.
  beginRun();
  expect(isArchiveSaveFailed(), '전제: 신호가 내려간 상태에서 시작해야 한다').toBe(false);
});

describe('엔딩 요약 — 기록이 남지 않았다는 사실이 보인다', () => {
  it('기록 쓰기가 실패하면 경고가 뜬다', () => {
    raiseSignal();
    render(<RunArchiveSummary runDelta={null} />);
    expect(screen.getByRole('alert').textContent, '기록이 안 남았는데 화면이 침묵한다')
      .toContain(WARN_SUMMARY);
  });

  // 양성 짝. 경고가 상시 켜져 있으면 경고가 아니고, 부정형만 두면 가지를 통째로 지워도 통과한다.
  it('정상 환경에서는 경고가 없고 원래 문구가 그대로 나온다', () => {
    render(<RunArchiveSummary runDelta={null} />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(WARN_SUMMARY)).toBeNull();
    expect(screen.getByText('다른 길은 어땠을까?'), '대조군이 원래 화면을 안 그린다').toBeTruthy();
  });

  // **예전 구조에서 경고가 통째로 사라지던 자리.** 신규도 없고 스친 사람도 없으면 이 컴포넌트는
  // 카드를 만들지 않고 한 줄 문구로 빠져나갔다 — 첫 완주가 정확히 그 조합이다.
  it('첫 완주(요약할 것이 없는 판)에서도 경고는 산다', () => {
    raiseSignal();
    render(<RunArchiveSummary runDelta={null} />);
    expect(screen.queryByText('다른 길은 어땠을까?'),
      '조기 반환 경로로 빠져 경고가 사라졌다').toBeNull();
    expect(screen.getByRole('alert').textContent).toContain(WARN_SUMMARY);
  });

  // 성취를 숨기지 않는다 — 저장 사고의 벌을 플레이어의 판에 물리면 안 된다.
  it('경고가 떠도 "이번 판에서 처음 본 이야기"는 그대로 보인다', () => {
    commitRun(runState({ events: [ev('a')] }), '수도권 대학');   // 1회차 (정상 저장)
    accrueResolvedEvent(runState({ events: [ev('b')] }));        // 판 중 적립도 정상

    const restore = failWritesTo(ARCHIVE_KEY);
    let delta: RunDelta;
    try {
      delta = commitRun(runState({ events: [ev('b')] }), 'SKY 경영대 합격');
    } finally {
      restore();
    }
    expect(delta!, '전제: 2회차 + 신규 1개여야 그 줄이 그려진다')
      .toMatchObject({ runs: 2, newEvents: 1 });

    render(<RunArchiveSummary runDelta={delta!} />);
    expect(screen.getByText('이번 판에서 처음 본 이야기'), '경고가 성취를 밀어냈다').toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain(WARN_SUMMARY);
    // 그리고 디스크는 여전히 1회차다 — 이 간극이 결함의 정체였다.
    expect(loadArchive().runs, '하네스가 안 물었다').toBe(1);
  });
});

describe('기록실 — 침묵하지 않는다', () => {
  it('기록 쓰기가 실패 중이면 경고가 뜨고, 횟수는 디스크 그대로다', () => {
    commitRun(runState({ events: [ev('a')] }), '수도권 대학');
    raiseSignal();

    render(<ArchiveScreen onBack={() => {}} onStartNewRun={() => {}} />);
    expect(screen.getByRole('alert').textContent).toContain(WARN_ARCHIVE);
    // 숫자는 원래도 디스크를 읽어 정직했다. 거짓말은 침묵 쪽에 있었다 — 둘 다 잠근다.
    expect(screen.getByText('지금까지 1번의 학창시절')).toBeTruthy();
  });

  it('정상 환경에서는 경고가 없다', () => {
    commitRun(runState({ events: [ev('a')] }), '수도권 대학');
    render(<ArchiveScreen onBack={() => {}} onStartNewRun={() => {}} />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(WARN_ARCHIVE)).toBeNull();
    expect(screen.getByText('지금까지 1번의 학창시절'), '대조군이 원래 화면을 안 그린다').toBeTruthy();
  });
});
