// @vitest-environment jsdom
// 크롬 컨트롤의 **포인터 타깃 바닥** — WCAG 2.5.8 AA = 24×24 CSS px.
//
// 320px 실브라우저 전수 측정에서 주 게임 루프(활동 슬롯 246×60 · 선택지 272×42 · 친구 280×44
// · CTA 280×47)는 전부 통과하는데 크롬만 미달이었다:
//   💬 가정 / 🚪 메뉴 34.3×17 · 📖 기록장 43.5×17 · 부모 칩 22×22
//   🔊 소리 / 🎵 배경음 24×20.8 · 시험 타임라인 마커 14×14 · 18×16 · 21.8×10 · 27.2×10
// `🚪 메뉴`는 데스크톱에서 게임을 나가는 **유일한 보이는 입구**인데 세로 17px이었다.
//
// **jsdom은 레이아웃을 계산하지 않는다.** "몇 px인가"는 실브라우저 측정이 본체고(수치는 PR 본문),
// 여기서는 그 수치를 만들어 낸 **선언**이 사라지지 않았는지를 잡는다 — #443·#444·#456의
// narrowViewport.test.tsx가 쓰는 것과 같은 층이다.
//
// 이 리포의 전례 셋을 따른다:
//  · **prop을 받는 층이 아니라 만드는 층에서 본다**(#431) — GameScreen을 진짜 스토어로 렌더해
//    HudPanel·ExamTimeline·AudioToggle까지 실제 경로로 지난다. 순수함수만 잠그면 배선이 빈다(#381·#397).
//  · **조건부 렌더는 한 상태만 스캔하면 안 보인다** — 메뉴 열림(SystemMenu의 오디오 토글)과
//    타이틀 화면까지 세 상태를 전부 훑는다.
//  · **코퍼스가 0건이면 게이트는 자기가 지워져도 초록이다**(#437) — 대상 목록 길이와 각 대상의
//    최소 개수를 먼저 단언해서, 셀렉터가 아무것도 못 잡으면 그 자리에서 빨강이 된다.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../engine/assetWebp', () => ({
  webpSrc: (p: string) => `WEBP::${p}`,
  cgThumbSrc: (p: string) => `THUMB::${p}`,
}));
vi.mock('../../audio/sfx', () => ({ playSfx: vi.fn() }));
vi.mock('../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));
vi.mock('../../engine/assetPrefetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../engine/assetPrefetch')>()),
  runWhenIdle: () => () => {},
}));

import { GameScreen } from '../GameScreen';
import { TRACK_HEIGHT } from '../screens/main/ExamTimeline';
import { TitleScreen } from '../TitleScreen';
import { TOUCH_TARGET_MIN, CHROME_ROW_BOX, hitArea, hitAreaBleed } from '../touchTarget';
import { useGameStore } from '../../engine/store';
import { createInitialState } from '../../engine/gameEngine';
import { getExamSchedule } from '../../engine/examSystem';
import { clearArchive } from '../../engine/archive';
import type { GameState } from '../../engine/types';

// 고3 — 시험 마커가 가장 많은 해(중간·모의·기말·중간·모의·수능). 마커가 적은 해만 보면
// 수능 마커(크기가 다른 유일한 점)의 선언을 통째로 놓친다.
const YEAR = 7;

function inPlay(): GameState {
  const s = createInitialState('male', ['wealth', 'info'], { rngSeed: 5 });
  return { ...s, year: YEAR, week: 20, money: 1569, fatigue: 58 };
}

// ── jsdom CSSOM 함정 ────────────────────────────────────────────────────────
// 레이어드 단축(`linear-gradient(...), rgba(...)`)은 통째로 버려지고 rgba는 공백이 정규화된다.
// 그래서 **원시 style 속성**을 읽고 공백을 걷는다(visualSurface.test.tsx가 같은 함정을 겪었다).
function decl(el: Element, prop: string): string | null {
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i').exec(el.getAttribute('style') || '');
  return m ? m[1].trim().replace(/\s+/g, '') : null;
}
function asPx(v: string | null): number | null {
  const m = v && /^(-?[\d.]+)px$/.exec(v);
  return m ? Number(m[1]) : null;
}
/** 한 축의 실효 바닥 = `width`/`min-width` 중 px로 읽히는 최댓값. %·calc는 바닥으로 안 친다. */
function axisFloor(el: Element, axis: 'width' | 'height'): number {
  const fixed = asPx(decl(el, axis));
  const floor = asPx(decl(el, `min-${axis}`));
  return Math.max(fixed ?? -Infinity, floor ?? -Infinity);
}
/** 상하 마진. **jsdom CSSOM은 네 방향이 다 있으면 `margin: -1px` 단축으로 접는다** —
 *  원시 속성만 읽으면 부모 칩(네 방향 상쇄)의 마진이 통째로 안 보인다. 접혔으면 CSSOM으로 푼다. */
function marginPx(el: HTMLElement, side: 'Top' | 'Bottom'): number | null {
  return asPx(decl(el, `margin-${side.toLowerCase()}`)) ?? asPx(el.style[`margin${side}`] || null);
}
function all(root: ParentNode, sel: string): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(sel)];
}
function byLabel(root: ParentNode, re: RegExp): HTMLElement[] {
  return all(root, '[aria-label]').filter(e => re.test(e.getAttribute('aria-label') || ''));
}

/** 스캔 대상. **빈 배열이면 아래 길이 단언이 먼저 잡는다.** */
type Probe = { name: string; find: (root: HTMLElement) => HTMLElement[]; min: number };

const EXAM_MARKERS = Object.keys(getExamSchedule(YEAR)).length;

const WEEKLY_TARGETS: Probe[] = [
  { name: '부모 강점 칩', find: r => byLabel(r, /강점 설명$/), min: 2 },
  { name: '💬 가정', find: r => all(r, '[data-tutorial="home"]'), min: 1 },
  { name: '🚪 메뉴', find: r => byLabel(r, /^메뉴 열기$/), min: 1 },
  { name: '📖 기록장', find: r => all(r, 'button').filter(b => b.textContent === '📖 기록장'), min: 1 },
  { name: '🔊 소리 · 🎵 배경음', find: r => byLabel(r, /^(소리|배경음) (켜기|끄기)$/), min: 2 },
  // 타임라인 셋은 따로 센다 — 합쳐 세면 한 종류가 통째로 사라져도 총합이 맞아 통과한다.
  { name: '시험 마커', find: r => byLabel(r, /^W\d+ · /), min: EXAM_MARKERS },
  { name: '현재 주 마커', find: r => byLabel(r, /^지금 · W/), min: 1 },
  { name: '방학 구간', find: r => byLabel(r, /^방학 · W/), min: 2 },
];

beforeEach(() => {
  clearArchive();
  localStorage.clear();
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
  localStorage.setItem('lifetrack_tutorial_done', '1');
  useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
});

describe('바닥 상수 — WCAG 2.5.8 AA', () => {
  it('24 아래로 내려가지 않는다', () => {
    expect(TOUCH_TARGET_MIN, 'AA 미달이면 이 작업 전체가 무의미하다').toBeGreaterThanOrEqual(24);
  });

  // 위쪽도 막는다. 한쪽만 잠그면 반대 방향 회귀가 통과한다(#438 전례).
  // 44(2.5.5 AAA)로 올리면 22px 컨트롤 행에서 이웃 히트 영역이 11px씩 겹치고,
  // 5.4px/주 타임라인에서는 마커가 서로를 통째로 덮는다. 상쇄 마진은 **자리를 되돌릴 뿐**
  // 겹침을 막지 못한다.
  it('컨트롤 행을 밀어낼 만큼 크지도 않다', () => {
    expect(TOUCH_TARGET_MIN).toBeLessThanOrEqual(CHROME_ROW_BOX + 4);
  });

  // 히트 영역을 키우고 자리를 안 되돌리면 HUD가 통째로 자란다 — #456이 320px에서 겨우 없앤
  // 겹침(컨트롤이 상태 블록 위에 그려지던 것)이 되살아난다.
  it('상쇄 마진이 넓힌 만큼을 정확히 되돌린다', () => {
    for (const box of [CHROME_ROW_BOX, 20.8, 17]) {
      expect(TOUCH_TARGET_MIN + 2 * hitAreaBleed(box), `${box}px 자리가 안 지켜진다`).toBeCloseTo(box, 5);
      expect(hitAreaBleed(box), '마진이 음수가 아니면 되돌리는 게 아니라 더 벌린다').toBeLessThan(0);
    }
  });

  it("axis:'y'는 좌우 마진을 건드리지 않는다 (기존 marginLeft 간격 보존)", () => {
    expect(hitArea('y').marginLeft).toBeUndefined();
    expect(hitArea('both').marginLeft).toBe(hitAreaBleed(CHROME_ROW_BOX));
  });
});

describe('주간 화면 — 크롬 컨트롤이 전부 24×24 바닥을 갖는다', () => {
  function mount() {
    useGameStore.setState({ state: inPlay() });
    return render(<GameScreen />).container;
  }

  it('스캔 대상 목록이 비어 있지 않다', () => {
    // 목록이 비면 아래 for가 한 번도 안 돌고 게이트가 조용히 초록이 된다(#437).
    expect(WEEKLY_TARGETS.length).toBeGreaterThanOrEqual(8);
    expect(EXAM_MARKERS, '전제: 고3 시험 스케줄이 비어 있지 않다').toBeGreaterThanOrEqual(5);
  });

  for (const probe of WEEKLY_TARGETS) {
    it(`${probe.name}`, () => {
      const root = mount();
      const els = probe.find(root);
      expect(els.length, `전제: ${probe.name}을 못 잡으면 이 단언은 아무것도 안 본다`)
        .toBeGreaterThanOrEqual(probe.min);
      for (const el of els) {
        const label = el.getAttribute('aria-label') || el.textContent;
        expect(axisFloor(el, 'width'), `${label} 가로 바닥`).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN);
        expect(axisFloor(el, 'height'), `${label} 세로 바닥`).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN);
      }
    });
  }

  // 흐르는 컨트롤(칩·라벨·오디오)만 자리를 되돌려야 한다. 타임라인 마커는 절대배치라
  // 애초에 레이아웃에 영향이 없어 마진이 없다 — 여기서 함께 요구하면 거짓 실패가 난다.
  it('HUD 컨트롤 행은 넓힌 만큼을 음수 마진으로 되돌린다', () => {
    const root = mount();
    const flowing = WEEKLY_TARGETS.slice(0, 5).flatMap(p => p.find(root));
    expect(flowing.length, '전제: HUD 컨트롤을 잡았다').toBeGreaterThanOrEqual(6);
    for (const el of flowing) {
      const label = el.getAttribute('aria-label') || el.textContent;
      const top = marginPx(el, 'Top');
      const bottom = marginPx(el, 'Bottom');
      expect(top, `${label}: 상쇄 마진이 없으면 컨트롤 행이 22 → 24로 자라 HUD가 내려앉는다`).toBeLessThan(0);
      expect(bottom, `${label}: 아래쪽 상쇄도 있어야 가운데가 안 어긋난다`).toBeLessThan(0);
      expect(TOUCH_TARGET_MIN + (top ?? 0) + (bottom ?? 0), `${label}: 자리가 22를 넘는다`)
        .toBeLessThanOrEqual(CHROME_ROW_BOX);
    }
  });
});

// "크기만 키우고 톤은 유지" — 보이는 것이 같이 커지면 크롬이 시끄러워진다.
// 이 리포의 원칙은 "UI 절제는 크롬에만"이다.
describe('보이는 크기는 그대로다', () => {
  function mount() {
    useGameStore.setState({ state: inPlay() });
    return render(<GameScreen />).container;
  }

  it('부모 칩의 보이는 원은 여전히 22px이고, 버튼 자신은 투명하다', () => {
    const root = mount();
    const chips = byLabel(root, /강점 설명$/);
    expect(chips.length).toBeGreaterThanOrEqual(2);
    for (const chip of chips) {
      expect(decl(chip, 'background'), '히트 영역에 배경을 주면 원이 24로 커져 보인다').toBeNull();
      expect(decl(chip, 'border'), '히트 영역에 테두리를 주면 네모난 24px 칩이 된다').toBeNull();
      const circle = chip.querySelector('span');
      expect(circle, '보이는 원이 사라졌다').toBeTruthy();
      expect(asPx(decl(circle!, 'width'))).toBe(CHROME_ROW_BOX);
      expect(asPx(decl(circle!, 'height'))).toBe(CHROME_ROW_BOX);
      expect(decl(circle!, 'border-radius')).toBe('50%');
      // 펄스는 box-shadow 글로우다 — 사각 히트 영역에 걸면 네모난 빛이 된다.
      expect(decl(chip, 'animation'), '펄스가 히트 영역으로 옮겨 가면 네모난 글로우가 된다').toBeNull();
    }
  });

  // 방학 띠와 히트 영역을 한 요소로 합치면 minWidth 24가 **띠까지** 늘린다 —
  // 320px에서 W20~24 띠가 21.8 → 24px로 2.2px 길어진다(실측).
  it('방학 띠는 히트 영역과 분리돼 % 폭을 유지한다', () => {
    const root = mount();
    const bands = all(root, 'div').filter(d => decl(d, 'background') === 'rgba(224,138,91,0.18)');
    expect(bands.length, '전제: 방학 음영 띠를 찾았다').toBeGreaterThanOrEqual(2);
    for (const band of bands) {
      expect(band.getAttribute('role'), '띠 자체가 히트 영역이면 minWidth가 띠를 늘린다').toBeNull();
      expect(decl(band, 'width'), '띠 폭은 기간에 비례하는 %라야 한다').toMatch(/%$/);
      expect(decl(band, 'min-width'), '띠에 px 바닥이 붙으면 짧은 방학이 길어 보인다').toBeNull();
    }
  });

  // 히트 상자를 트랙 위로 7px 끌어올렸으니 안쪽 점·막대도 그만큼 내려야 제자리다.
  // 보정을 빼먹으면 점이 7px 떠오른다 — jsdom은 못 재지만 **선언된 절대 위치**는 볼 수 있다.
  it('마커의 보이는 점은 트랙 안 제자리(top 1~3px)에 남는다', () => {
    const root = mount();
    const hitTop = (TRACK_HEIGHT - TOUCH_TARGET_MIN) / 2;
    const absTop = (hit: HTMLElement) => {
      const dot = hit.querySelector('div');
      expect(dot, '히트 영역 안에 보이는 점이 없다').toBeTruthy();
      return (asPx(decl(dot!, 'top')) ?? NaN) + hitTop;
    };
    const suneung = byLabel(root, /수능$/)[0];
    const otherExam = byLabel(root, /^W\d+ · (중간|기말|모의)/)[0];
    const now = byLabel(root, /^지금 · W/)[0];
    expect(suneung && otherExam && now, '전제: 세 종류 마커를 전부 찾았다').toBeTruthy();
    expect(absTop(suneung), '수능 점(8px)의 자리').toBeCloseTo(1, 5);
    expect(absTop(otherExam), '일반 시험 점(6px)의 자리').toBeCloseTo(2, 5);
    expect(absTop(now), '현재 주 막대의 자리').toBeCloseTo(0, 5);
  });
});

// 오디오 토글은 세 곳에 산다 — HUD · 메뉴 · 타이틀. **한 상태만 스캔하면 안 보인다.**
describe('조건부 렌더 — 메뉴를 열어도, 타이틀에서도 바닥이 있다', () => {
  const audio = (r: ParentNode) => byLabel(r, /^(소리|배경음) (켜기|끄기)$/);

  it('메뉴를 열면 오디오 토글이 하나 더 뜨고, 그것도 24×24다', () => {
    useGameStore.setState({ state: inPlay() });
    const { container } = render(<GameScreen />);
    const closed = audio(container).length;
    expect(closed, '전제: HUD에 오디오 토글 2개').toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByLabelText('메뉴 열기'));
    expect(screen.getByRole('dialog', { name: '메뉴' }), '전제: 메뉴가 열렸다').toBeTruthy();

    const opened = audio(document.body);
    expect(opened.length, '메뉴의 오디오 토글이 안 잡히면 닫힌 상태만 본 것이다')
      .toBeGreaterThan(closed);
    for (const el of opened) {
      expect(axisFloor(el, 'width')).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN);
      expect(axisFloor(el, 'height')).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN);
    }
  });

  it('타이틀 화면의 오디오 토글도 24×24다', () => {
    const { container } = render(<TitleScreen />);
    const els = audio(container);
    expect(els.length, '전제: 타이틀에 오디오 토글이 있다').toBeGreaterThanOrEqual(2);
    for (const el of els) {
      expect(axisFloor(el, 'width')).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN);
      expect(axisFloor(el, 'height')).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN);
    }
  });

  // 타이틀의 토글은 `position:absolute`라 가운데 정렬로 흡수되지 않는다 —
  // 상쇄가 0.6px만 틀려도 아이콘이 그만큼 내려앉는다(HUD에서는 안 보이는 회귀다).
  it('오디오 토글의 상쇄는 아이콘 상자(20.8px)에 맞춰져 있다', () => {
    const { container } = render(<TitleScreen />);
    for (const el of audio(container)) {
      const top = marginPx(el, 'Top');
      expect(TOUCH_TARGET_MIN + 2 * (top ?? 0), '20.8px 자리가 안 지켜지면 타이틀 아이콘이 움직인다')
        .toBeCloseTo(20.8, 5);
    }
  });
});
