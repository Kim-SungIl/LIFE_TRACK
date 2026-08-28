// @vitest-environment jsdom
// EventScene — 이벤트 화면의 계약 검증:
// 선택지 노출 규칙(조건/원본 인덱스/돈 게이팅/지나친다), 페이지 분할, 성별 분기, 화자 라벨.
// 이미지 로드는 jsdom에서 발화하지 않으므로(리소스 미로딩) 폴백 체인은 여기서 다루지 않는다.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventScene } from '../EventScene';
import { GAME_EVENTS } from '../../engine/events';
import { makeState, makeEvent, makeChoice } from '../../test/fixtures';

function renderScene(overrides?: Partial<Parameters<typeof EventScene>[0]>) {
  const onChoice = vi.fn();
  const props = {
    event: makeEvent(),
    gender: 'male' as const,
    year: 1,
    onChoice,
    ...overrides,
  };
  const utils = render(<EventScene {...props} />);
  return { ...utils, onChoice };
}

describe('EventScene 기본 렌더', () => {
  it('제목·본문·선택지를 렌더하고 선택 시 onChoice(원본 인덱스)를 호출한다', () => {
    const { onChoice } = renderScene({
      event: makeEvent({
        title: '방과후 초대',
        description: '지훈이 손을 흔든다.',
        choices: [makeChoice({ text: '같이 간다' }), makeChoice({ text: '다음에 간다' })],
      }),
    });
    expect(screen.getByText('방과후 초대')).toBeInTheDocument();
    expect(screen.getByText('지훈이 손을 흔든다.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('다음에 간다'));
    expect(onChoice).toHaveBeenCalledWith(1);
  });

  it('condition 불만족 선택지는 숨기되 onChoice에는 원본 인덱스를 전달한다', () => {
    const { onChoice } = renderScene({
      state: makeState(),
      event: makeEvent({
        choices: [
          makeChoice({ text: '숨겨질 선택지', condition: () => false }),
          makeChoice({ text: '보이는 A' }),
          makeChoice({ text: '보이는 B' }),
        ],
      }),
    });
    expect(screen.queryByText('숨겨질 선택지')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('보이는 B'));
    // 배열 필터 후에도 인덱스는 원본(2) — 부모의 choices[index] 해석과 어긋나면 안 된다
    expect(onChoice).toHaveBeenCalledWith(2);
  });
});

describe('EventScene 돈 게이팅', () => {
  it('잔액 부족 선택지는 잠그고 부족 안내를 보여준다', () => {
    renderScene({
      state: makeState({ money: 10 }),
      event: makeEvent({
        choices: [
          makeChoice({ text: '한턱 쏜다', moneyEffect: -50 }),
          makeChoice({ text: '구경만 한다' }),
        ],
      }),
    });
    const locked = screen.getByText('한턱 쏜다').closest('button');
    expect(locked).toBeDisabled();
    expect(screen.getByText(/돈이 부족합니다/)).toBeInTheDocument();
    expect(screen.getByText('구경만 한다').closest('button')).toBeEnabled();
  });

  it('감당 가능한 유료 선택지에는 비용을 사전 표시한다', () => {
    renderScene({
      state: makeState({ money: 100 }),
      event: makeEvent({ choices: [makeChoice({ text: '선물을 산다', moneyEffect: -30 })] }),
    });
    expect(screen.getByText(/비용 30만원/)).toBeInTheDocument();
    expect(screen.getByText('선물을 산다').closest('button')).toBeEnabled();
  });

  it('보이는 선택지가 전부 잠기면 "지나친다" 안전망이 나타나고 onChoice(-1)을 보낸다', () => {
    const { onChoice } = renderScene({
      state: makeState({ money: 0 }),
      event: makeEvent({
        choices: [
          makeChoice({ text: '비싼 선택 A', moneyEffect: -50 }),
          makeChoice({ text: '비싼 선택 B', moneyEffect: -30 }),
        ],
      }),
    });
    fireEvent.click(screen.getByText('지나친다'));
    expect(onChoice).toHaveBeenCalledWith(-1);
  });

  it('condition으로 모든 선택지가 숨겨져도 "지나친다"로 진행할 수 있다', () => {
    const { onChoice } = renderScene({
      state: makeState(),
      event: makeEvent({ choices: [makeChoice({ text: '숨김', condition: () => false })] }),
    });
    fireEvent.click(screen.getByText('지나친다'));
    expect(onChoice).toHaveBeenCalledWith(-1);
  });
});

describe('EventScene 성별 분기', () => {
  const event = makeEvent({
    description: '남주 본문',
    choices: [makeChoice({ text: '남주 선택지' })],
    femaleDescription: '여주 본문',
    femaleChoices: [makeChoice({ text: '여주 선택지 0' }), makeChoice({ text: '여주 선택지 1' })],
  });

  it('여성 플레이어는 femaleDescription/femaleChoices를 본다', () => {
    const { onChoice } = renderScene({ event, gender: 'female' });
    expect(screen.getByText('여주 본문')).toBeInTheDocument();
    expect(screen.queryByText('남주 본문')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('여주 선택지 1'));
    expect(onChoice).toHaveBeenCalledWith(1);
  });

  it('남성 플레이어는 기본 description/choices를 본다', () => {
    renderScene({ event, gender: 'male' });
    expect(screen.getByText('남주 본문')).toBeInTheDocument();
    expect(screen.queryByText('여주 선택지 0')).not.toBeInTheDocument();
  });
});

describe('EventScene 페이지 분할', () => {
  // jsdom 기본 viewport(1024px) = 데스크탑 → maxVisualLines 3.
  // 짧은 줄 4개면 3+1로 2페이지가 된다(줄당 visual line 1).
  const longEvent = makeEvent({
    description: '첫째 줄이다.\n둘째 줄이다.\n셋째 줄이다.\n넷째 줄이다.',
    choices: [makeChoice({ text: '마지막 선택지' })],
  });

  it('마지막 페이지 전에는 선택지를 숨기고, 도달하면 노출한다', () => {
    renderScene({ event: longEvent });
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getByText('셋째 줄이다.')).toBeInTheDocument();
    expect(screen.getByText('마지막 선택지')).not.toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(screen.getByText('넷째 줄이다.')).toBeInTheDocument();
    expect(screen.getByText('마지막 선택지')).toBeVisible();
  });

  it('끝까지 읽은 뒤 이전 페이지로 돌아가도 선택지는 유지된다', () => {
    renderScene({ event: longEvent });
    fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }));
    fireEvent.click(screen.getByRole('button', { name: '이전 페이지' }));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    // 재읽기 중 선택지가 사라지면 사용자는 "선택지가 없어졌다"고 느낀다 — 영구 노출 계약
    expect(screen.getByText('마지막 선택지')).toBeVisible();
  });

  it('단일 페이지 이벤트는 네비게이션 없이 선택지를 바로 보여준다', () => {
    renderScene({ event: makeEvent({ description: '짧은 본문.', choices: [makeChoice({ text: '바로 선택' })] }) });
    expect(screen.queryByRole('button', { name: '다음 페이지' })).not.toBeInTheDocument();
    expect(screen.getByText('바로 선택')).toBeVisible();
  });
});

describe('EventScene 화자 라벨', () => {
  const npcs = [{ id: 'jihun', name: '지훈', met: false }];
  const event = makeEvent({
    description: '"야, 같이 갈래?"',
    speakers: ['jihun'],
  });

  it('아직 만나지 않은 화자는 ??? 로 표시한다', () => {
    renderScene({ event, npcs });
    expect(screen.getAllByText('???').length).toBeGreaterThan(0);
    expect(screen.queryByText('지훈')).not.toBeInTheDocument();
  });

  it('만난 화자는 이름으로 표시한다', () => {
    renderScene({ event, npcs: [{ id: 'jihun', name: '지훈', met: true }] });
    expect(screen.getAllByText('지훈').length).toBeGreaterThan(0);
    expect(screen.queryByText('???')).not.toBeInTheDocument();
  });
});

describe('EventScene 학교급 변이 소비', () => {
  // 카탈로그 원본(미구움)을 넘긴다 — 대입 경로가 구워 줘도, 여기 분기를 빼면 화면은 원래 description만 본다.
  const errand = GAME_EVENTS.find(e => e.id === 'president-errand');
  if (!errand?.schoolVariants) throw new Error('president-errand schoolVariants 전제 붕괴');

  it('eventScene_renders_school_band_body: 초등과 고등이 다른 본문을 그린다', () => {
    const { unmount } = renderScene({
      event: { ...errand, week: 6 },
      year: 1,
      gender: 'male',
    });
    expect(screen.getByText(/현장학습/, { exact: false }), 'eventScene_renders_school_band_body').toBeInTheDocument();
    expect(screen.queryByText(/야자 시작 전/)).not.toBeInTheDocument();
    unmount();

    renderScene({ event: { ...errand, week: 6 }, year: 6, gender: 'male' });
    expect(screen.getByText(/야자 시작 전/, { exact: false }), 'eventScene_renders_school_band_body').toBeInTheDocument();
    expect(screen.queryByText(/현장학습/)).not.toBeInTheDocument();
  });

  it('eventScene_same_state_rerender_stable: 리마운트해도 같은 본문이다', () => {
    const props = { event: { ...errand, week: 5 }, year: 1 as const, gender: 'male' as const };
    const { unmount } = renderScene(props);
    expect(screen.getByText(/우유 상자/, { exact: false })).toBeInTheDocument();
    unmount();
    renderScene(props);
    expect(screen.getByText(/우유 상자/, { exact: false })).toBeInTheDocument();
  });
});
