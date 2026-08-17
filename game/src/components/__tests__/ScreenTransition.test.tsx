// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ScreenTransition } from '../ScreenTransition';

// 전환 페이드의 계약:
//  (1) 키가 바뀌면 애니메이션이 다시 돈다
//  (2) 키가 그대로면 다시 돌지 않는다 (루틴 조작마다 화면이 깜빡이면 안 된다)
//  (3) **자식을 리마운트하지 않는다** — 이게 핵심이다. key로 구현하면 EventScene이
//      전신 이미지·CG를 다시 로드하고 내부 페이지 상태가 날아간다.
//  (4) prefers-reduced-motion에서 애니메이션이 꺼진다 (CSS)

const cls = (el: HTMLElement) => el.className;

describe('ScreenTransition', () => {
  it('마운트 시 페이드 클래스가 붙는다', () => {
    render(<ScreenTransition transitionKey="a"><p>내용</p></ScreenTransition>);
    expect(cls(screen.getByText('내용').parentElement!)).toBe('screen-enter');
  });

  it('pace=slow면 느린 클래스를 쓴다', () => {
    render(<ScreenTransition transitionKey="a" pace="slow"><p>내용</p></ScreenTransition>);
    expect(cls(screen.getByText('내용').parentElement!)).toBe('screen-enter-slow');
  });

  it('키가 바뀌면 클래스를 떼고 다시 붙여 애니메이션을 재시작한다', () => {
    const { rerender } = render(
      <ScreenTransition transitionKey="a"><p>내용</p></ScreenTransition>,
    );
    const el = screen.getByText('내용').parentElement!;
    const removed: string[][] = [];
    const added: string[][] = [];
    vi.spyOn(el.classList, 'remove').mockImplementation((...c: string[]) => { removed.push(c); });
    vi.spyOn(el.classList, 'add').mockImplementation((...c: string[]) => { added.push(c); });

    rerender(<ScreenTransition transitionKey="b"><p>내용</p></ScreenTransition>);

    expect(removed).toHaveLength(1);
    expect(removed[0]).toContain('screen-enter');
    expect(added).toEqual([['screen-enter']]);
  });

  it('클래스 제거와 재부착 사이에 리플로를 강제한다', () => {
    // 이게 없으면 브라우저가 제거·재부착을 한 스타일 재계산으로 합쳐서 **애니메이션이 아예
    // 다시 돌지 않는다.** jsdom은 애니메이션을 실행하지 않으니 순서로만 잠글 수 있다.
    const { rerender } = render(
      <ScreenTransition transitionKey="a"><p>내용</p></ScreenTransition>,
    );
    const el = screen.getByText('내용').parentElement!;
    const order: string[] = [];
    vi.spyOn(el.classList, 'remove').mockImplementation(() => { order.push('remove'); });
    vi.spyOn(el.classList, 'add').mockImplementation(() => { order.push('add'); });
    Object.defineProperty(el, 'offsetWidth', {
      configurable: true,
      get: () => { order.push('reflow'); return 0; },
    });

    rerender(<ScreenTransition transitionKey="b"><p>내용</p></ScreenTransition>);

    expect(order).toEqual(['remove', 'reflow', 'add']);
  });

  it('키가 그대로면 재시작하지 않는다 (같은 화면 안에서 깜빡이지 않는다)', () => {
    const { rerender } = render(
      <ScreenTransition transitionKey="a"><p>내용</p></ScreenTransition>,
    );
    const el = screen.getByText('내용').parentElement!;
    const add = vi.spyOn(el.classList, 'add');

    // 같은 키로 여러 번 리렌더 — 화면 안에서 상태만 바뀌는 상황
    rerender(<ScreenTransition transitionKey="a"><p>내용</p></ScreenTransition>);
    rerender(<ScreenTransition transitionKey="a"><p>내용</p></ScreenTransition>);

    expect(add).not.toHaveBeenCalled();
  });

  it('키가 바뀌어도 자식을 리마운트하지 않는다 (이미지·내부 상태 유지)', () => {
    const mounted = vi.fn();
    function Child() {
      // 마운트 1회만 — 리마운트되면 다시 호출된다
      useEffect(() => { mounted(); }, []);
      const [n] = useState(() => Math.floor(1));
      return <p>자식{n}</p>;
    }
    const { rerender } = render(
      <ScreenTransition transitionKey="a"><Child /></ScreenTransition>,
    );
    expect(mounted).toHaveBeenCalledTimes(1);

    rerender(<ScreenTransition transitionKey="b"><Child /></ScreenTransition>);
    rerender(<ScreenTransition transitionKey="c"><Child /></ScreenTransition>);

    expect(mounted).toHaveBeenCalledTimes(1);
  });
});

describe('화면 전환 CSS', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles/game.css'), 'utf8');

  it('두 속도 클래스가 keyframes를 참조한다', () => {
    expect(css).toMatch(/@keyframes\s+screenEnter/);
    expect(css).toMatch(/\.screen-enter\s*\{[^}]*animation:\s*screenEnter/);
    expect(css).toMatch(/\.screen-enter-slow\s*\{[^}]*animation:\s*screenEnter/);
  });

  it('고빈도(normal)가 드문 장면(slow)보다 짧다', () => {
    const dur = (sel: string) => {
      const m = css.match(new RegExp(`\\.${sel}\\s*\\{[^}]*animation:\\s*screenEnter\\s+([\\d.]+)s`));
      expect(m, `${sel} duration`).toBeTruthy();
      return parseFloat(m![1]);
    };
    // 이벤트·주 넘김은 한 판 150~200회 지나간다. 이 부등호가 뒤집히면 그 빈도에
    // 긴 페이드가 붙는다 — sfx의 eventAppear 하향과 같은 취지다.
    expect(dur('screen-enter')).toBeLessThan(dur('screen-enter-slow'));
  });

  // @media 블록을 중괄호 매칭으로 정확히 떠낸다.
  // 정규식 `\{([\s\S]*?)\n\}` 로 잡으면 **이미 있는 .fade-in 용 reduced-motion 블록에서
  // 시작해 바깥의 클래스 정의까지 통째로** 캡처돼, 블록 안에서 선택자를 지워도 캡처 안에
  // 정의가 남아 통과한다(뮤테이션 M9로 실제로 드러난 false lock).
  const reducedMotionBlocks = (): string[] => {
    const out: string[] = [];
    const re = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/g;
    for (let m = re.exec(css); m; m = re.exec(css)) {
      let depth = 1;
      let i = m.index + m[0].length;
      const start = i;
      while (i < css.length && depth > 0) {
        if (css[i] === '{') depth++;
        else if (css[i] === '}') depth--;
        i++;
      }
      out.push(css.slice(start, i - 1));
    }
    return out;
  };

  it('prefers-reduced-motion에서 두 클래스 모두 애니메이션이 꺼진다', () => {
    const blocks = reducedMotionBlocks();
    expect(blocks.length, 'reduced-motion 블록이 있다').toBeGreaterThan(0);

    // `.screen-enter` 는 `.screen-enter-slow` 의 접두사다. \b 는 '-' 앞에서도 매치되므로
    // 뒤에 [-\w] 가 오지 않는 경우만 정확히 본다 — 안 그러면 slow 하나로 둘 다 만족한다.
    const exact = /\.screen-enter(?![-\w])/;
    const slow = /\.screen-enter-slow(?![-\w])/;

    const covers = (re: RegExp) => blocks.some(b => re.test(b) && /animation:\s*none/.test(b));
    expect(covers(exact), '.screen-enter가 reduced-motion에서 꺼진다').toBe(true);
    expect(covers(slow), '.screen-enter-slow가 reduced-motion에서 꺼진다').toBe(true);
  });
});

// 위 소스 스캔은 "지정했는가"까지만 본다 — 키를 전부 같은 상수로 바꿔도 통과한다(전환이
// 영구히 안 도는 상태). 그건 렌더로만 잠긴다. 실제 스토어 상태를 움직여 페이드가 다시
// 도는지/안 도는지를 양성·음성 짝으로 확인한다.
describe('라우터 배선 — 실제 렌더', () => {
  it('주차가 넘어가면 페이드가 다시 돌고, 무관한 상태 변화로는 돌지 않는다', async () => {
    // 메인 화면은 첫 플레이에 튜토리얼을 띄우는데, jsdom엔 scrollIntoView가 없다.
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = vi.fn();
    }
    const { useGameStore } = await import('../../engine/store');
    const { GameScreen } = await import('../GameScreen');
    const { act } = await import('@testing-library/react');

    act(() => { useGameStore.getState().startGame('male', ['emotional', 'wealth']); });
    // 부팅 직후는 첫 장면 이벤트라 EventScene(lazy)이 suspend돼 Suspense fallback이 뜬다.
    // 전환 래퍼는 그 안쪽이므로, eager 렌더되는 메인 화면으로 맞춘 뒤 관측한다.
    act(() => {
      useGameStore.setState(s => ({ state: { ...s.state!, phase: 'weekday', currentEvent: null } }));
    });
    const { container } = render(<GameScreen />);

    const wrapper = container.querySelector('.screen-enter') as HTMLElement;
    expect(wrapper, '전환 래퍼가 렌더돼 있다').toBeTruthy();

    const add = vi.spyOn(wrapper.classList, 'add');

    // 양성 짝 — 주차가 바뀌면 화면 정체성이 바뀐 것이므로 전환이 붙는다.
    act(() => {
      useGameStore.setState(s => ({ state: { ...s.state!, week: s.state!.week + 1 } }));
    });
    expect(add, '주 넘김에 페이드가 다시 돈다').toHaveBeenCalled();

    // 음성 짝 — 같은 화면 안의 수치 변화로는 깜빡이지 않는다.
    add.mockClear();
    act(() => {
      useGameStore.setState(s => ({ state: { ...s.state!, fatigue: s.state!.fatigue + 5 } }));
    });
    expect(add, '같은 주 안의 피로 변화로는 돌지 않는다').not.toHaveBeenCalled();
  });
});

describe('라우터 배선', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/components/GameScreen.tsx'), 'utf8');

  it('모든 phase 분기가 screenKey를 지정한다', () => {
    // TS가 "사용 전 미할당"으로 이미 잡지만, 분기 수와 키 수가 함께 늘어나는지도 본다.
    const branches = (src.match(/phaseContent = \(/g) ?? []).length;
    const keys = (src.match(/screenKey = /g) ?? []).length;
    expect(branches).toBeGreaterThanOrEqual(6);
    expect(keys).toBe(branches);
  });

  it('전환이 Suspense 안에서 phaseContent를 감싼다', () => {
    expect(src).toMatch(/<ScreenTransition\s+transitionKey=\{screenKey\}\s+pace=\{screenPace\}>/);
    expect(src).toMatch(/<ScreenTransition[\s\S]*\{phaseContent\}[\s\S]*<\/ScreenTransition>/);
  });

  it('고빈도 화면(이벤트·주간결산·메인)에는 slow를 쓰지 않는다', () => {
    // slow는 학년말·엔딩 두 곳만. 늘어나면 의도적 변경인지 확인이 필요하다.
    expect((src.match(/screenPace = 'slow'/g) ?? []).length).toBe(2);
    const eventBranch = src.slice(src.indexOf('screenKey = `event:'), src.indexOf('screenKey = `weekly:'));
    expect(eventBranch).not.toMatch(/screenPace = 'slow'/);
  });
});
