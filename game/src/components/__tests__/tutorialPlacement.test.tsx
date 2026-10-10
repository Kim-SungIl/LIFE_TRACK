// @vitest-environment jsdom
// 튜토리얼 말풍선은 화면 안에 있다 — 「다음」이 접힌 선 아래로 가지 않는다. (2026-10 장르 진단)
//
// 결함의 모양(Playwright 실측, 고치기 전): 주말 단계 타깃(이번 주 일과)이 ~510px로 길어서
// 가운데 정렬 뒤 타깃 바로 아래에 붙인 말풍선이
//   390×844 → 698~936px(「다음」 879~917px, 화면 밖) · 375×667 → 610~848px(본문째 화면 밖).
// 고친 뒤 같은 하네스: 390×844 594~832 · 375×667 417~655 · 320×568 318~556, 7단계 완주.
//
// 잠그는 계약:
//   1. 순수 배치(placeTooltip) — 실측 기하에서 말풍선이 뷰포트 안. 원하는 쪽이 되면 그대로(회귀 없음).
//   2. 순수 스크롤(scrollPlan) — 긴 타깃은 가운데 대신 말풍선 쪽 가장자리, 짧은 타깃은 지금처럼 가운데.
//   3. **배선** — Tutorial이 실제로 둘을 쓴다. 순수함수만 잠그면 컴포넌트가 옛 식으로 돌아가도 초록이다.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tutorial } from '../Tutorial';
import { STEPS } from '../tutorialSteps';
import {
  CARD_FALLBACK_HEIGHT, HIGHLIGHT_PAD, TOOLTIP_GAP, VIEWPORT_EDGE, placeTooltip, scrollPlan,
} from '../tutorialPlacement';

const WEEKEND_CARD_H = 238; // 실측(390·375·320 모두 같은 높이)
const inViewport = (top: number, h: number, vh: number) => top >= VIEWPORT_EDGE && top + h <= vh - VIEWPORT_EDGE;

describe('placeTooltip — 실측 기하', () => {
  it('390×844 주말 단계(타깃 165~674): 고치기 전 식은 화면 밖이었다(양성 대조)', () => {
    const oldTop = 674 + HIGHLIGHT_PAD + TOOLTIP_GAP; // 옛 식: rect.bottom + pad + 16
    expect(oldTop + WEEKEND_CARD_H).toBeGreaterThan(844);
    // 스크롤이 못 도와준 최악의 경우에도(타깃이 그 자리 그대로) 화면 안으로 민다.
    expect(inViewport(placeTooltip({ top: 165, bottom: 674 }, WEEKEND_CARD_H, 844, 'bottom'), WEEKEND_CARD_H, 844)).toBe(true);
  });

  it('375×667·320×568 — 타깃이 화면보다 길어도 말풍선은 화면 안', () => {
    for (const [vh, top, bottom] of [[667, 79, 588], [568, 30, 539]] as const) {
      expect(inViewport(placeTooltip({ top, bottom }, WEEKEND_CARD_H, vh, 'bottom'), WEEKEND_CARD_H, vh), `${vh}`).toBe(true);
    }
  });

  it('원하는 쪽에 자리가 있으면 그대로 — 짧은 타깃의 배치는 안 바뀐다', () => {
    // hud(아래): 옛 식과 같은 자리.
    expect(placeTooltip({ top: 20, bottom: 121 }, 160, 844, 'bottom')).toBe(121 + HIGHLIGHT_PAD + TOOLTIP_GAP);
    // confirm(위): 옛 식(bottom 고정)과 같은 자리 = rect.top − pad − 16 − 카드 높이.
    expect(placeTooltip({ top: 700, bottom: 760 }, 228, 844, 'top')).toBe(700 - HIGHLIGHT_PAD - TOOLTIP_GAP - 228);
  });

  it('원하는 쪽이 모자라고 반대쪽이 되면 뒤집는다', () => {
    // 아래를 원하지만 타깃이 화면 아래쪽 — 위에 자리가 있다.
    const top = placeTooltip({ top: 500, bottom: 760 }, 200, 844, 'bottom');
    expect(top).toBe(500 - HIGHLIGHT_PAD - TOOLTIP_GAP - 200);
  });
});

describe('scrollPlan', () => {
  it('긴 타깃(주말 단계) — 말풍선 쪽 가장자리에 붙이고 그 몫을 scroll-margin으로 남긴다', () => {
    for (const vh of [844, 667, 568]) {
      expect(scrollPlan(509, WEEKEND_CARD_H, vh, 'bottom'), `${vh}`).toEqual({
        block: 'end', margin: HIGHLIGHT_PAD + TOOLTIP_GAP + WEEKEND_CARD_H + VIEWPORT_EDGE,
      });
    }
    expect(scrollPlan(509, WEEKEND_CARD_H, 667, 'top').block).toBe('start');
  });

  it('짧은 타깃 — 지금처럼 가운데(음성 대조: 모든 스텝을 가장자리로 바꾸면 여기서 빨강)', () => {
    expect(scrollPlan(101, 160, 844, 'bottom')).toEqual({ block: 'center', margin: 0 });
  });
});

describe('Tutorial 배선 — 실제 컴포넌트가 배치·스크롤 식을 쓴다', () => {
  const VH = 844;
  const scrollCalls: { target: string | null; block: unknown; marginBottom: string; marginTop: string }[] = [];
  let prevInnerHeight: number;

  beforeEach(() => {
    scrollCalls.length = 0;
    prevInnerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', { value: VH, configurable: true, writable: true });
    Element.prototype.scrollIntoView = vi.fn(function (this: HTMLElement, opts?: boolean | ScrollIntoViewOptions) {
      scrollCalls.push({
        target: this.getAttribute('data-tutorial'),
        block: typeof opts === 'object' ? opts.block : undefined,
        marginBottom: this.style.scrollMarginBottom,
        marginTop: this.style.scrollMarginTop,
      });
    });
    // 주말 단계의 실측 기하: routine 165~674(509px). 나머지 타깃은 짧게.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const t = this.getAttribute('data-tutorial');
      const box = (top: number, height: number) => ({
        top, bottom: top + height, height, left: 16, right: 374, width: 358, x: 16, y: top, toJSON: () => ({}),
      }) as DOMRect;
      if (t === 'routine') return box(165, 509);
      if (t === 'confirm' || t === 'npc') return box(700, 60);
      return box(20, 101);
    });
    // 말풍선 높이 — 컴포넌트가 실측을 읽는지 보려고 폴백(260)과 다른 값을 준다.
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute('data-tutorial-card') ? WEEKEND_CARD_H : 0;
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerHeight', { value: prevInnerHeight, configurable: true, writable: true });
    vi.restoreAllMocks();
  });

  function renderAt(stepTitle: string) {
    render(
      <>
        {[...new Set(STEPS.map(s => s.target))].map(t => <div key={t} data-tutorial={t} />)}
        <Tutorial onComplete={vi.fn()} routineSet />
      </>,
    );
    const idx = STEPS.findIndex(s => s.title === stepTitle);
    if (idx < 0) throw new Error(`스텝 "${stepTitle}"이 없다 — 픽스처가 STEPS와 어긋났다`);
    for (let i = 0; i < idx; i++) fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByText(stepTitle), '전제: 그 스텝에 와 있다').toBeTruthy();
    const card = document.querySelector<HTMLElement>('[data-tutorial-card]');
    if (!card) throw new Error('말풍선이 안 그려졌다 — 중앙 폴백 카드 경로로 빠졌다');
    return card;
  }

  it('주말 단계 — 말풍선(「다음」 포함)이 뷰포트 안에 있다', () => {
    const card = renderAt('주말 활동');
    const top = parseFloat(card.style.top);
    expect(card.style.bottom, '옛 bottom 고정 배치로 돌아갔다').toBe('');
    // 실측 높이(238)로 배치했다 — 폴백(260)이면 위치가 22px 다르다.
    expect(top).toBe(VH - VIEWPORT_EDGE - WEEKEND_CARD_H);
    expect(top).not.toBe(VH - VIEWPORT_EDGE - CARD_FALLBACK_HEIGHT);
    expect(inViewport(top, WEEKEND_CARD_H, VH)).toBe(true);
  });

  it('주말 단계 — 긴 타깃은 아래 가장자리로 스크롤하고 말풍선 몫을 scroll-margin으로 남긴다', () => {
    renderAt('주말 활동');
    const last = scrollCalls.filter(c => c.target === 'routine').at(-1);
    expect(last).toEqual({
      target: 'routine', block: 'end',
      marginBottom: `${HIGHLIGHT_PAD + TOOLTIP_GAP + WEEKEND_CARD_H + VIEWPORT_EDGE}px`, marginTop: '',
    });
  });

  it('짧은 타깃(hud) — 스크롤은 지금처럼 가운데, scroll-margin을 남기지 않는다', () => {
    renderAt('내 상태');
    expect(scrollCalls.at(-1)).toEqual({ target: 'hud', block: 'center', marginBottom: '', marginTop: '' });
  });
});
