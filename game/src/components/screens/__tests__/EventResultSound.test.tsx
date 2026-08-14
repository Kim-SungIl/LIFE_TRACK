// @vitest-environment jsdom
// 이벤트 결과 착지음 **배선** 계약.
//
// 이 파일이 생긴 이유: 뮤테이션 검수에서 EventResultScreen의 playSfx('outcome') 한 줄을
// 지웠는데 테스트 39개가 전부 통과했다(MISS). 소리의 생김새(sfxDesign.test.ts)만 잠그고
// "그 소리가 실제로 그 화면에서 나는가"를 안 잠갔기 때문이다.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { EventResultScreen } from '../EventResultScreen';
import { playSfx } from '../../../audio/sfx';
import type { EventResultData } from '../shared';

vi.mock('../../../audio/sfx', () => ({ playSfx: vi.fn() }));

const played = () => (playSfx as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(c => c[0]);

function renderResult(data: Partial<EventResultData> = {}) {
  const props = {
    gender: 'male' as const,
    year: 1,
    eventResultData: { message: '결과', effects: [], ...data } as EventResultData,
    cgLoaded: false, cgError: true,
    onCgLoaded: vi.fn(), onCgError: vi.fn(), onContinue: vi.fn(),
  };
  return render(<EventResultScreen {...props} />);
}

beforeEach(() => { vi.clearAllMocks(); });

describe('이벤트 결과 착지음 배선', () => {
  it('결과 화면이 뜨면 착지음이 난다', () => {
    renderResult({ choiceIndex: 0 });
    expect(played()).toContain('outcome');
  });

  // 극성음을 쓰지 않는다는 결정 자체를 배선 층에서도 잠근다. 나중에 누가
  // outcomeGood/outcomeBad를 만들어 여기에 붙이면 이 테스트가 걸린다.
  // (근거 데이터는 sfx.ts의 outcome 주석 참조 — 정서 부정 선택지의 96%가 수치는 양수)
  it('좋고 나쁨을 가르는 소리는 나지 않는다', () => {
    renderResult({ choiceIndex: 0 });
    for (const id of played()) {
      expect(String(id)).not.toMatch(/good|bad|success|fail/i);
    }
    expect(played()).not.toContain('statUp');
    expect(played()).not.toContain('statDown');
  });

  it('같은 결과에서 두 번 울리지 않는다 (StrictMode 이중 호출·리렌더 방어)', () => {
    const data = { message: '결과', effects: [], choiceIndex: 0 } as EventResultData;
    const props = {
      gender: 'male' as const, year: 1, eventResultData: data,
      cgLoaded: false, cgError: true,
      onCgLoaded: vi.fn(), onCgError: vi.fn(), onContinue: vi.fn(),
    };
    const { rerender } = render(<EventResultScreen {...props} />);
    rerender(<EventResultScreen {...props} />);
    expect(played().filter(id => id === 'outcome')).toHaveLength(1);
  });

  // 위 테스트의 양성 짝. 가드를 "한 번 울렸으면 끝"으로 두면 언마운트 없이 결과가 바뀌는
  // 경우(후속 이벤트가 연달아 결과를 세팅)에 두 번째가 통째로 묵음이 된다. 그래서 가드 키를
  // 이벤트 id + 선택 인덱스로 잡았고, 여기서 그 granularity가 실제로 필요함을 잠근다.
  it('같은 화면에서 결과가 바뀌면 다시 울린다 (선택이 다르면 다른 결과다)', () => {
    const base = {
      gender: 'male' as const, year: 1,
      cgLoaded: false, cgError: true,
      onCgLoaded: vi.fn(), onCgError: vi.fn(), onContinue: vi.fn(),
    };
    const mk = (choiceIndex: number) =>
      ({ message: `결과${choiceIndex}`, effects: [], choiceIndex } as EventResultData);
    const { rerender } = render(<EventResultScreen {...base} eventResultData={mk(0)} />);
    rerender(<EventResultScreen {...base} eventResultData={mk(1)} />);
    expect(played().filter(id => id === 'outcome')).toHaveLength(2);
  });
});
