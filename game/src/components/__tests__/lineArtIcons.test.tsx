// @vitest-environment jsdom
/**
 * 선화 아이콘 — 주간 화면의 세 집합(능력치 5 · 일과 슬롯 8 · 활동 카테고리 7).
 *
 * **왜 이 파일이 필요한가.** 이모지를 걷어내면 기존 단언이 조용히 공허해진다.
 * `StatsPanel.test.tsx`의 "접혔을 때 아이콘이 없다"는 `queryByText(이모지)`였는데,
 * 이모지가 어느 상태에도 없어지면 그 단언은 **패널이 통째로 빈 화면을 그려도** 통과한다.
 * 부정형 단언만 남겨두면 분기를 지워도 초록이라는 이 리포의 반복 형태다.
 *
 * 그래서 여기서는 세 층을 각각 본다:
 *  1. **그림 계약** — 24 viewBox · stroke 1.5 · currentColor · fill 없음 · aria-hidden.
 *     임계는 양방향으로 잠근다(#438: 상한만 있는 게이트는 과축소를 '개선'으로 읽었다).
 *  2. **집합 완전성** — 키마다 실제로 획이 있는 그림이 나온다. 타입은 `as` 하나로 뚫리고,
 *     빈 `<svg/>`는 타입이 못 본다. 커버리지 하한도 같이 둔다(#437: 코퍼스가 0이면
 *     게이트는 자기가 지워져도 초록이다).
 *  3. **제품 배선** — 순수 컴포넌트만 잠그면 화면이 안 부르는 것도 초록이다(#381·#397).
 *     진짜 스토어로 `GameScreen`을 렌더해 주간 화면 → 슬롯 팝업까지 실제 경로로 지난다.
 *
 * **이모지 부재는 단독으로 쓰지 않는다.** 항상 "선화가 있다"와 짝으로만 단언한다 —
 * 혼자 두면 화면이 사라진 것과 구별이 안 된다.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

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

import { StatIcon, SlotIcon, CategoryIcon, ICON_STROKE } from '../icons/icons';
import { SLOT_ICON_KINDS, ACTIVITY_CATEGORIES, type SlotIconKind } from '../icons/iconKeys';
import { STAT_ICONS } from '../screens/shared';
import { STAT_BAR_HEIGHT, StatsPanel } from '../screens/main/StatsPanel';
import { WeekPlanner } from '../screens/main/WeekPlanner';
import { GameScreen } from '../GameScreen';
import { Portrait } from '../Portrait';
import { useGameStore } from '../../engine/store';
import { createInitialState } from '../../engine/gameEngine';
import { clearArchive } from '../../engine/archive';
import { ACTIVITIES } from '../../engine/activities';
import { makeState } from '../../test/fixtures';
import type { GameState, StatKey, Stats } from '../../engine/types';

const STAT_KEYS = Object.keys(STAT_ICONS) as StatKey[];

/** 이번 작업이 걷어낸 이모지 전부. 하나라도 되돌아오면 한 화면에 두 언어가 선다. */
const RETIRED_EMOJI = ['🏫', '📚', '❓', '🌙', '🕊️', '🌟', '☀️', '💤', '💪', '👥', '🎨', '😴', '💝', '💼', '⭐', '💡', '🍀', '⚡'] as const;

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────

function svgOf(ui: React.ReactElement): SVGSVGElement {
  const { container } = render(ui);
  const svg = container.querySelector('svg');
  if (!svg) throw new Error('svg가 렌더되지 않았다');
  return svg as unknown as SVGSVGElement;
}

/** 그린 획의 총 길이 대신 **모양 개수**를 센다 — 빈 `<svg/>`와 진짜 그림을 가른다. */
function shapeCount(svg: Element): number {
  return svg.querySelectorAll('path, circle, rect, line, polyline, polygon').length;
}

function iconIds(root: ParentNode, prefix: string): string[] {
  return [...root.querySelectorAll(`[data-icon^="${prefix}:"]`)]
    .map(e => e.getAttribute('data-icon')!);
}

/**
 * 화면에 **글자로** 남아 있는 이모지. `data-icon` 안(그림)은 원리상 글자가 아니라
 * 여기 안 걸린다 — 그래서 이 함수는 "이모지가 되돌아왔나"만 본다.
 */
function emojiInText(root: ParentNode, pool: readonly string[] = RETIRED_EMOJI): string[] {
  const text = (root as HTMLElement).textContent ?? '';
  return pool.filter(e => text.includes(e));
}

const STATS_FIXTURE: Stats = { academic: 85, social: 65, talent: 45, mental: 25, health: 10 };

function plannerState(patch?: Partial<GameState>): GameState {
  return makeState({ isVacation: false, ...patch });
}

function renderPlanner(state: GameState, selectedActivities: string[] = []) {
  return render(
    <WeekPlanner
      state={state}
      selectedActivities={selectedActivities}
      setSelectedActivities={() => {}}
      npcChoices={{}}
      onEditSlot={() => {}}
      routineTooExpensive={false}
      routineCost={0}
      unaffordable={[]}
      maxComboWeeks={0}
      slot2ComboWeeks={0}
      slot3ComboWeeks={0}
      maxSlots={2}
    />,
  );
}

beforeEach(() => {
  clearArchive();
  localStorage.clear();
  localStorage.setItem('lifetrack_tutorial_ever_seen', '1');
  localStorage.setItem('lifetrack_tutorial_done', '1');
  useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
});

// ── 1. 그림 계약 ──────────────────────────────────────────────────────────────

describe('선화 계약 — 24 viewBox · stroke 1.5 · currentColor', () => {
  const ALL: [string, React.ReactElement][] = [
    ...STAT_KEYS.map(k => [`stat:${k}`, <StatIcon stat={k} />] as [string, React.ReactElement]),
    ...SLOT_ICON_KINDS.map(k => [`slot:${k}`, <SlotIcon kind={k} />] as [string, React.ReactElement]),
    ...ACTIVITY_CATEGORIES.map(c => [`cat:${c}`, <CategoryIcon category={c} />] as [string, React.ReactElement]),
  ];

  // 목록이 비면 아래 for가 한 번도 안 돌고 이 describe 전체가 조용히 초록이 된다(#437).
  it('스캔 대상이 세 집합을 전부 덮는다', () => {
    expect(ALL.length).toBe(STAT_KEYS.length + SLOT_ICON_KINDS.length + ACTIVITY_CATEGORIES.length);
    expect(STAT_KEYS.length, '능력치 축이 줄었다면 그림 집합도 같이 봐야 한다').toBe(5);
    expect(SLOT_ICON_KINDS.length).toBe(8);
    expect(ACTIVITY_CATEGORIES.length).toBe(7);
  });

  it.each(ALL)('%s', (id, ui) => {
    const svg = svgOf(ui);
    expect(svg.getAttribute('viewBox'), '좌표계가 바뀌면 획 굵기가 집합마다 달라진다').toBe('0 0 24 24');
    expect(svg.getAttribute('fill'), '채우면 선화가 아니라 실루엣이다').toBe('none');
    expect(svg.getAttribute('stroke'), '팔레트를 안 타면 이모지와 같은 문제로 돌아간다').toBe('currentColor');
    expect(Number(svg.getAttribute('stroke-width'))).toBe(ICON_STROKE);
    expect(svg.getAttribute('data-icon')).toBe(id);
    // 옆에 이름이 글자로 있다 — 이름을 또 달면 스크린리더가 두 번 읽는다.
    expect(svg.getAttribute('aria-hidden'), '라벨을 달면 "학업 학업"이 된다').toBe('true');
    expect(svg.getAttribute('aria-label'), '이름은 옆 글자가 전담한다').toBeNull();
    expect(shapeCount(svg), '빈 svg는 타입이 못 본다').toBeGreaterThanOrEqual(1);
    cleanup();
  });

  // 굵기는 양쪽을 다 막는다. 하한만 두면 3.0으로 올린 회귀가, 상한만 두면 0.5로 내린
  // 회귀가 통과한다 — 16px로 줄여 그리는 자리라 둘 다 뭉개진다.
  it('획 굵기가 위아래로 잠겨 있다', () => {
    expect(ICON_STROKE).toBeGreaterThanOrEqual(1.25);
    expect(ICON_STROKE).toBeLessThanOrEqual(1.75);
  });

  // 24 viewBox에 stroke 1.5면 16px로 줄여 그릴 때 실효 1px다. 크기 기본값이
  // 이 범위를 벗어나면 같은 집합 안에서 획 굵기가 눈에 띄게 갈린다.
  it('기본 크기가 집합마다 12~24px 안에 있다', () => {
    for (const [id, ui] of ALL) {
      const svg = svgOf(ui);
      const w = Number(svg.getAttribute('width'));
      expect(w, `${id} 기본 크기`).toBeGreaterThanOrEqual(12);
      expect(w, `${id} 기본 크기`).toBeLessThanOrEqual(24);
      expect(svg.getAttribute('height'), `${id}는 정사각이라야 한다`).toBe(String(w));
      cleanup();
    }
  });
});

// ── 2. 집합 완전성 · 채널 경계 ────────────────────────────────────────────────

describe('집합 — 키마다 서로 다른 그림이 있다', () => {
  function drawing(ui: React.ReactElement): string {
    const svg = svgOf(ui);
    const html = svg.innerHTML;
    cleanup();
    return html;
  }

  /**
   * **짝으로 대비해야 하는 자리.** 슬롯 아이콘의 존재 이유가 "비었나 찼나"를 그림으로도
   * 말하는 것이라, 짝의 두 그림이 같아지면 아이콘이 있으나 마나다. 같은 그림을 **다른
   * 집합끼리** 공유하는 건 의도된 것이다(공부 카테고리와 방과후 루틴은 둘 다 책).
   */
  const CONTRAST_PAIRS: [SlotIconKind, SlotIconKind][] = [
    ['plan', 'empty'],
    ['evening', 'free'],
    ['weekendFilled', 'weekend'],
  ];

  it('능력치 5축이 서로 다른 그림이다', () => {
    const drawn = STAT_KEYS.map(k => drawing(<StatIcon stat={k} />));
    expect(new Set(drawn).size, '두 축이 같은 그림이면 행을 구별할 수 없다').toBe(STAT_KEYS.length);
  });

  it.each(CONTRAST_PAIRS)('슬롯 %s / %s 는 다른 그림이다', (a, b) => {
    expect(drawing(<SlotIcon kind={a} />)).not.toBe(drawing(<SlotIcon kind={b} />));
  });

  /**
   * **한 화면에 함께 뜨는 집합끼리는 겹치면 안 된다.**
   *
   * 실게임 화면을 보고서야 찾은 충돌이다 — 멘탈 축이 새싹, 저녁 자유시간이 깃털이었는데
   * 둘 다 잎사귀로 보였다. 능력치 패널과 일과 플래너는 **같은 주간 화면에 동시에** 있어서
   * 실사용 크기(14·18px)에서 구별이 안 됐다. 집합 안의 유일성만 보면 원리상 못 잡는다.
   *
   * 카테고리는 이 규칙 밖이다 — 팝업이 주간 화면을 덮고 뜨기도 하고, 공부=책이 학업=책과
   * 같은 그림인 건 **같은 뜻이라 일부러 맞춘 것**이다.
   */
  it('능력치 5 + 슬롯 8 = 13개가 한 화면에서 전부 다른 그림이다', () => {
    const drawn = [
      ...STAT_KEYS.map(k => drawing(<StatIcon stat={k} />)),
      ...SLOT_ICON_KINDS.map(k => drawing(<SlotIcon kind={k} />)),
    ];
    expect(drawn.length, '전제: 두 집합을 다 그렸다').toBe(13);
    expect(new Set(drawn).size, '주간 화면에 같은 그림이 둘 있으면 축을 구별할 수 없다')
      .toBe(drawn.length);
  });

  it('카테고리 7종이 서로 다른 그림이다', () => {
    const drawn = ACTIVITY_CATEGORIES.map(c => drawing(<CategoryIcon category={c} />));
    expect(new Set(drawn).size).toBe(ACTIVITY_CATEGORIES.length);
  });

  // 같은 축을 두 채널이 각자 들고 있다 — 키가 갈리면 한쪽 화면에서만 축이 사라진다(#441).
  it('글자 채널(STAT_ICONS)과 그림 채널의 키가 정확히 같은 집합이다', () => {
    const drawnKeys = STAT_KEYS.filter(k => shapeCount(svgOf(<StatIcon stat={k} />)) > 0);
    cleanup();
    expect(drawnKeys.sort()).toEqual(Object.keys(STAT_ICONS).sort());
  });

  // 글자 채널은 **남아 있어야 한다.** 문자열로 이어 붙이는 자리(GameScreen 효과 줄 ·
  // MiniTalkModal · 주간 결산 '잃은 것' 칩)가 JSX를 못 받기 때문이다.
  it('글자 채널이 살아 있고 실제 호출부가 있다', () => {
    expect(Object.keys(STAT_ICONS)).toHaveLength(5);
    for (const k of STAT_KEYS) expect(STAT_ICONS[k]).toMatch(/\p{Extended_Pictographic}/u);
  });
});

// ── 3. 제품 배선 — 주간 화면 ──────────────────────────────────────────────────

describe('능력치 패널 — 접힘/펼침이 아이콘으로 갈린다', () => {
  it('접히면 0개, 펼치면 축 순서 그대로 5개', () => {
    const { container } = render(<StatsPanel stats={STATS_FIXTURE} year={3} />);
    expect(iconIds(container, 'stat'), '접힘').toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: /능력치/ }));
    expect(iconIds(container, 'stat')).toEqual(STAT_KEYS.map(k => `stat:${k}`));
    // 짝 단언 — 선화가 있는 채로 이모지가 없어야 "되돌아오지 않았다"가 성립한다.
    expect(emojiInText(container, STAT_KEYS.map(k => STAT_ICONS[k]))).toEqual([]);
  });

  // 막대 높이는 양방향이다. 하한만 두면 24px 띠로 부푼 회귀가, 상한만 두면
  // 1px 실선으로 줄어든 회귀가 통과한다.
  it('막대 높이가 캡슐로 읽히는 범위에 있고, 반지름이 높이의 절반이다', () => {
    expect(STAT_BAR_HEIGHT).toBeGreaterThanOrEqual(12);
    expect(STAT_BAR_HEIGHT).toBeLessThanOrEqual(18);
    const { container } = render(<StatsPanel stats={STATS_FIXTURE} year={3} />);
    fireEvent.click(screen.getByRole('button', { name: /능력치/ }));
    const tracks = [...container.querySelectorAll<HTMLElement>('div')]
      .filter(d => d.style.height === `${STAT_BAR_HEIGHT}px`);
    expect(tracks.length, '전제: 막대를 찾았다').toBe(STAT_KEYS.length);
    for (const t of tracks) {
      expect(t.style.borderRadius, '캡슐이 아니면 각진 띠가 된다').toBe(`${STAT_BAR_HEIGHT / 2}px`);
      const fill = t.firstElementChild as HTMLElement;
      expect(fill, '채움 막대가 없다').toBeTruthy();
      expect(fill.style.borderRadius).toBe(`${STAT_BAR_HEIGHT / 2}px`);
    }
  });
});

describe('일과 슬롯 — 시간대 × 채움 여부', () => {
  // 조건부 렌더는 한 상태만 스캔하면 안 보인다. 빈 주 · 채운 주 · 방학 셋을 다 본다.
  it('학기 빈 주: 고정 수업 2 + 빈 방과후 + 자유 저녁 + 빈 주말 2', () => {
    const { container } = renderPlanner(plannerState());
    expect(iconIds(container, 'slot')).toEqual([
      'slot:school', 'slot:school', 'slot:empty', 'slot:free', 'slot:weekend', 'slot:weekend',
    ]);
    expect(emojiInText(container), '이모지가 되돌아왔다').toEqual([]);
  });

  it('학기 채운 주: 방과후·저녁·주말이 전부 채움 그림으로 바뀐다', () => {
    const one = ACTIVITIES.find(a => a.slots === 1 && !a.seasonGate);
    expect(one, '전제: 1칸 학기 활동이 있다').toBeTruthy();
    const { container } = renderPlanner(
      plannerState({ routineSlot2: one!.id, routineSlot3: one!.id }),
      [one!.id, one!.id],
    );
    expect(iconIds(container, 'slot')).toEqual([
      'slot:school', 'slot:school', 'slot:plan', 'slot:evening',
      'slot:weekendFilled', 'slot:weekendFilled',
    ]);
  });

  it('2칸 활동이 일요일을 점유하면 이어짐 그림이 뜬다', () => {
    const two = ACTIVITIES.find(a => a.slots >= 2);
    expect(two, '전제: 2칸 활동이 있다').toBeTruthy();
    const { container } = renderPlanner(plannerState(), [two!.id]);
    expect(iconIds(container, 'slot')).toContain('slot:continued');
  });

  it('방학은 자유 슬롯만 그린다 (고정 수업 없음)', () => {
    const { container } = renderPlanner(plannerState({ isVacation: true, week: 21 }));
    const ids = iconIds(container, 'slot');
    expect(ids).toEqual(['slot:weekend', 'slot:weekend']);
    expect(ids, '방학에 학교 아이콘이 뜨면 안 된다').not.toContain('slot:school');
  });
});

// ── 4. 제품 배선 — 진짜 스토어 경로 ───────────────────────────────────────────
// 순수 컴포넌트만 잠그면 "화면이 안 부르는 상태"도 초록이다(#381·#397).

describe('주간 화면 전체 — 실제 경로로 아이콘이 닿는다', () => {
  function inPlay(): GameState {
    const s = createInitialState('male', ['wealth', 'info'], { rngSeed: 5 });
    return { ...s, year: 3, week: 12, money: 40, fatigue: 20 };
  }
  function mount() {
    useGameStore.setState({ state: inPlay() });
    return render(<GameScreen />).container;
  }

  it('슬롯 아이콘이 주간 화면에 실제로 그려진다', () => {
    const root = mount();
    expect(iconIds(root, 'slot').length, '플래너가 화면에 없거나 아이콘이 안 붙었다')
      .toBeGreaterThanOrEqual(6);
  });

  it('능력치 패널을 펼치면 선화 5개가 뜨고 이모지는 없다', () => {
    const root = mount();
    fireEvent.click(screen.getByRole('button', { name: /능력치/ }));
    expect(iconIds(root, 'stat')).toEqual(STAT_KEYS.map(k => `stat:${k}`));
    expect(emojiInText(root, STAT_KEYS.map(k => STAT_ICONS[k]))).toEqual([]);
  });

  it('슬롯을 탭해 연 활동 선택에 카테고리 선화가 뜬다', () => {
    const root = mount();
    const slot = [...root.querySelectorAll('button')]
      .find(b => b.textContent?.includes('방과후'));
    expect(slot, '전제: 방과후 슬롯 버튼을 찾았다').toBeTruthy();
    fireEvent.click(slot!);
    const cats = iconIds(document.body, 'cat');
    expect(cats.length, '활동 선택이 안 열렸거나 카테고리 아이콘이 안 붙었다')
      .toBeGreaterThanOrEqual(3);
    // 팝업 안에 **걷어낸 이모지가 하나도** 남아 있으면 안 된다 — 제목 포함.
    // 📚/🌙/☀️는 슬롯 아이콘의 이모지판이라, 제목에 남으면 바로 아래 선화 목록과
    // 같은 그림이 두 언어로 나란히 선다(실제로 그랬다).
    const title = document.querySelector('#slot-edit-title');
    expect(title, '전제: 팝업 제목을 찾았다').toBeTruthy();
    expect(title!.textContent, '제목이 사라지면 안 된다').toMatch(/활동$/);
    const dialog = title!.closest('[role="dialog"]');
    expect(dialog, '전제: 팝업이 dialog 역할을 갖는다 — 못 찾으면 범위가 통째로 어긋난다').toBeTruthy();
    expect(emojiInText(dialog!)).toEqual([]);
  });

  // 자유시간 옵션은 **저녁 슬롯에서만** 뜬다 — 방과후만 열어 보면 원리상 안 보인다.
  it('저녁 슬롯 팝업의 자유시간 옵션이 슬롯과 같은 선화를 쓴다', () => {
    const root = mount();
    const slot = [...root.querySelectorAll('button')].find(b => b.textContent?.includes('저녁'));
    expect(slot, '전제: 저녁 슬롯 버튼을 찾았다').toBeTruthy();
    fireEvent.click(slot!);
    const free = [...document.querySelectorAll('button')]
      .find(b => b.textContent?.includes('자유시간'));
    expect(free, '전제: 자유시간 옵션이 떴다').toBeTruthy();
    expect(free!.querySelector('[data-icon="slot:free"]'),
      '슬롯은 선화인데 이 버튼만 이모지면 같은 상태가 두 얼굴을 갖는다').toBeTruthy();
    const dialog = document.querySelector('#slot-edit-title')!.closest('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(emojiInText(dialog!)).toEqual([]);
  });

  // HUD 초상과 주간 결산 초상이 같은 처리를 쓴다 — 한쪽만 액자면 매주 그림이 바뀐다.
  it('HUD 초상이 액자 처리를 받는다', () => {
    const root = mount();
    const hud = root.querySelector('[data-tutorial="hud"]')!;
    const img = hud.querySelector('img');
    expect(img, '전제: HUD에 초상 이미지가 있다').toBeTruthy();
    expect(img!.getAttribute('style'), '액자가 없으면 파스텔 사각형이 카드에 박힌 것처럼 보인다')
      .toMatch(/outline/);
  });
});

// ── 5. 탐지기 자기검사 ────────────────────────────────────────────────────────
// 위 단언은 대부분 "목록이 같다/비었다" 꼴이라, 헬퍼가 조용히 아무것도 안 잡으면
// 전부 통과한다. 합성 픽스처로 양성·음성을 세운다(#437).

describe('자기검사 — 헬퍼가 실제로 잡아낸다', () => {
  it('iconIds는 접두사로 집합을 가른다 (양성·음성)', () => {
    const { container } = render(
      <>
        <StatIcon stat="academic" />
        <SlotIcon kind="school" />
        <CategoryIcon category="work" />
      </>,
    );
    expect(iconIds(container, 'stat')).toEqual(['stat:academic']);
    expect(iconIds(container, 'slot')).toEqual(['slot:school']);
    expect(iconIds(container, 'cat')).toEqual(['cat:work']);
    expect(iconIds(container, 'nope'), '없는 접두사는 빈 목록이라야 한다').toEqual([]);
  });

  it('emojiInText는 글자로 남은 이모지만 잡는다 (양성·음성)', () => {
    const { container: pos } = render(<div>📚 방과후</div>);
    expect(emojiInText(pos)).toEqual(['📚']);
    cleanup();
    // 선화만 있는 화면은 깨끗해야 한다 — 여기서 걸리면 과검출이라 게이트가 죽는다.
    const { container: neg } = render(<SlotIcon kind="plan" />);
    expect(emojiInText(neg)).toEqual([]);
  });

  it('shapeCount는 빈 svg와 그림을 가른다 (양성·음성)', () => {
    const { container } = render(<svg data-icon="fake:empty" />);
    expect(shapeCount(container.querySelector('svg')!)).toBe(0);
    cleanup();
    expect(shapeCount(svgOf(<StatIcon stat="academic" />))).toBeGreaterThanOrEqual(1);
  });

  // Portrait의 framed를 끄면 위 HUD 단언이 잡아야 한다 — 탐지기가 outline을 실제로 본다.
  it('액자 탐지가 framed 유무를 가른다 (양성·음성)', () => {
    const { container: on } = render(<Portrait characterId="player_m" size={52} year={3} framed />);
    const { container: off } = render(<Portrait characterId="player_m" size={52} year={3} />);
    const styleOf = (c: HTMLElement) => c.querySelector('img')?.getAttribute('style') ?? '';
    expect(styleOf(on), '전제: 액자 켠 초상이 이미지로 렌더된다').toMatch(/outline/);
    expect(styleOf(off), '액자를 꺼도 outline이 남으면 탐지기가 아무것도 안 보는 것이다')
      .not.toMatch(/outline/);
  });
});
