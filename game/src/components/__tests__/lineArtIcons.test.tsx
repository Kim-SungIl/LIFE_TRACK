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
import { createInitialState, processWeek } from '../../engine/gameEngine';
import { clearArchive } from '../../engine/archive';
import { ACTIVITIES } from '../../engine/activities';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';
import { makeState } from '../../test/fixtures';
import { EndingScreen } from '../screens/EndingScreen';
import { calculateEnding } from '../../engine/ending';
import { getBackground } from '../../engine/backgrounds';
import type { GameState, StatKey, Stats } from '../../engine/types';

const STAT_KEYS = Object.keys(STAT_ICONS) as StatKey[];

/**
 * 이번 작업이 걷어낸 이모지 전부. 하나라도 되돌아오면 한 화면에 두 언어가 선다.
 *
 * **풀에 바닥이 필요하다.** 아래 단언들은 전부 `toEqual([])` 부정형이라, 이 배열이 줄어들면
 * 같이 헐거워진다 — 실측: 18 → 1로 줄이고 슬롯 칸에 `☀️`를 주입하니 2582개가 전부 초록이었다.
 * 개수를 못 박고, 자기검사도 한 글자가 아니라 **전수**로 돈다(#437: 코퍼스가 0이면
 * 게이트는 자기가 지워져도 초록이다 — 코퍼스가 줄어도 같은 일이 비례해서 일어난다).
 */
const RETIRED_EMOJI = ['🏫', '📚', '❓', '🌙', '🕊️', '🌟', '☀️', '💤', '💪', '👥', '🎨', '😴', '💝', '💼', '⭐', '💡', '🍀', '⚡'] as const;

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────

function svgOf(ui: React.ReactElement): SVGSVGElement {
  const { container } = render(ui);
  const svg = container.querySelector('svg');
  if (!svg) throw new Error('svg가 렌더되지 않았다');
  return svg as unknown as SVGSVGElement;
}

/**
 * **실제로 그려지는** 모양의 개수. 빈 `<svg/>`와 진짜 그림을 가른다.
 *
 * 예전엔 요소만 셌다 — 그래서 `<path d="…"/>`를 `<path />`로 바꿔 아이콘이 통째로
 * 안 보이게 해도 1을 돌려줬다(3자 검수 실측). 그리는 지시가 있는지까지 본다.
 */
function shapeCount(svg: Element): number {
  return [...svg.querySelectorAll('path, circle, rect, line, polyline, polygon')]
    .filter(el => {
      if (el.tagName.toLowerCase() === 'path') return (el.getAttribute('d') ?? '').trim().length > 3;
      if (el.tagName.toLowerCase() === 'circle') return Number(el.getAttribute('r')) > 0;
      if (el.tagName.toLowerCase() === 'rect') return Number(el.getAttribute('width')) > 0;
      return true;
    }).length;
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
    // **길이 0짜리 점이 이 속성에 전적으로 의존한다.** butt cap이 되면 `Question`의
    // 물음표 아래 점 1개와 `Palette`의 물감 구멍 4개(`h.01`)가 통째로 렌더되지 않는다 —
    // 물음표는 점 없는 갈고리가 되고 팔레트는 민무늬가 된다. shapeCount는 **모양 개수**를
    // 세므로 여전히 3/2를 돌려준다(실측 MISSED).
    expect(svg.getAttribute('stroke-linecap'), 'butt cap이 되면 h.01 점 5개가 증발한다').toBe('round');
    expect(svg.getAttribute('stroke-linejoin')).toBe('round');
    // 자식이 자기 색을 선언하면 팔레트를 안 탄다 — 루트 속성만 보면 원리상 안 보인다.
    for (const child of svg.querySelectorAll('path, circle, rect, line, polyline, polygon')) {
      for (const attr of ['fill', 'stroke', 'stroke-width']) {
        expect(child.getAttribute(attr), `${id}의 자식이 ${attr}를 따로 선언했다 — 선화가 깨진다`)
          .toBeNull();
      }
    }
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

  /**
   * **어느 키에 어느 그림이 들어갔는지**를 잠근다. 3자 검수가 찾은 가장 큰 구멍이었다.
   *
   * 기존 단언은 셋 다 **순열을 보존한다**: `data-icon` 목록 비교는 키의 존재·개수·순서만,
   * 유일성 단언은 중복만, `shapeCount`는 "비지 않았나"만 본다. 그래서 학업에 번개·체력에
   * 책·학교 슬롯에 화살표를 넣는 **전면 순열**이 2582개 전부 초록으로 지나갔다(실측).
   * 이 PR이 막겠다고 한 형태(#381·#397·#431 "맞는 것이 맞는 자리에")의 재판이다.
   *
   * 값은 각 그림에만 있는 path 조각이다. 표가 낡거나 모호해지면 아래 자기검사가 먼저 잡는다.
   */
  const GLYPH_SIGNATURE: Record<string, string> = {
    'stat:academic': 'M12 6.5v13',              // 펼친 책 — 책등
    'stat:social': 'M12 3.5l2.6 5.3',           // 5각 별
    'stat:talent': 'M9.5 18h5',                 // 전구 — 소켓 줄
    'stat:mental': 'M12 20.5V10',               // 새싹 — 줄기
    'stat:health': 'M13 2.5 4.5 13.5h6',        // 번개
    'slot:school': 'M3.5 20.5h17',              // 학교 — 지면선
    'slot:plan': 'm8.2 12.2 2.6 2.6 5-5.4',     // 원 안 체크
    'slot:empty': 'M9.4 9.4a2.7 2.7 0',         // 원 안 물음표
    'slot:evening': 'M20 14.5A8.5 8.5 0',       // 초승달
    'slot:free': 'M4 9h12v6.5',                 // 머그 — 몸통
    'slot:weekend': 'M12 2.6v2.2',              // 해 — 광선
    'slot:weekendFilled': 'M10.5 4.5c0 4 3.2 7.2', // 4각 반짝임
    'slot:continued': 'M8 3.5v11a4 4 0',        // 이어짐 꺾쇠
    'cat:study': 'M12 6.5v13',                  // ← stat:academic과 **같은 책**(의도)
    'cat:exercise': 'M3 9.5v5M6 7.5v9',         // 덤벨
    'cat:social': 'M3.5 19.5a5.5 5.5 0',        // 두 사람
    'cat:talent': 'M12 3.5a8.5 8.5 0',          // 팔레트
    'cat:rest': 'M2.5 20V9.5',                  // 침대 — 머리판
    'cat:parent': 'M12 20.3 4.6 13a4.7',        // 하트
    'cat:work': 'M8.5 7.5V6a2 2 0',             // 서류가방 손잡이
  };

  /**
   * 같은 그림을 일부러 공유하는 짝. **공부=책은 학업=책과 같은 뜻이라 맞춘 것**이고
   * (`icons.tsx` 주석), 두 집합이 한 화면에 동시에 서지 않는다(팝업이 덮고 뜬다).
   * 이 목록에 없는 두 키가 같은 그림이면 실수다.
   */
  const SHARED_GLYPH_GROUPS = [['stat:academic', 'cat:study']];

  function allDrawings(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const k of STAT_KEYS) out[`stat:${k}`] = drawing(<StatIcon stat={k} />);
    for (const k of SLOT_ICON_KINDS) out[`slot:${k}`] = drawing(<SlotIcon kind={k} />);
    for (const c of ACTIVITY_CATEGORIES) out[`cat:${c}`] = drawing(<CategoryIcon category={c} />);
    return out;
  }

  it('지문 표가 스무 칸을 빠짐없이 덮는다', () => {
    // 표가 비면 아래 두 단언이 한 번도 안 돌고 순열 축이 통째로 사라진다(#437).
    expect(Object.keys(GLYPH_SIGNATURE).sort()).toEqual(Object.keys(allDrawings()).sort());
    expect(Object.keys(GLYPH_SIGNATURE)).toHaveLength(20);
  });

  it('키마다 약속된 그림이 들어 있다 (순열 잠금)', () => {
    const drawn = allDrawings();
    const wrong = Object.entries(GLYPH_SIGNATURE)
      .filter(([key, sig]) => !drawn[key].includes(sig))
      .map(([key, sig]) => `${key} 자리에 '${sig}'가 없다`);
    expect(wrong, '키와 그림이 어긋났다 — 순열은 목록 비교·유일성 단언을 전부 통과한다').toEqual([]);
  });

  // 표가 살아 있다는 증거. 지문이 여러 키에 걸리면 위 단언은 어긋난 그림도 통과시킨다.
  it('지문은 약속된 키(와 공유 짝)에만 있다 (표 자기검사)', () => {
    const drawn = allDrawings();
    const groupOf = (k: string) => SHARED_GLYPH_GROUPS.find(g => g.includes(k)) ?? [k];
    const leaks: string[] = [];
    for (const [key, sig] of Object.entries(GLYPH_SIGNATURE)) {
      for (const other of Object.keys(drawn)) {
        if (groupOf(key).includes(other)) continue;
        if (drawn[other].includes(sig)) leaks.push(`${key}의 지문 '${sig}'가 ${other}에도 있다`);
      }
    }
    expect(leaks, '지문이 모호하면 표가 잠그는 척만 한다').toEqual([]);
  });

  // 공유는 **목록에 적힌 것만**. 새로 생긴 중복은 실수다(같은 그림이 두 뜻을 말하게 된다).
  it('의도하지 않은 그림 공유가 없다', () => {
    const drawn = allDrawings();
    const byDrawing = new Map<string, string[]>();
    for (const [k, d] of Object.entries(drawn)) byDrawing.set(d, [...(byDrawing.get(d) ?? []), k]);
    const dups = [...byDrawing.values()].filter(ks => ks.length > 1).map(ks => ks.sort().join(' = '));
    expect(dups.sort()).toEqual(SHARED_GLYPH_GROUPS.map(g => [...g].sort().join(' = ')).sort());
  });

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
  it('글자 채널의 표가 온전하다', () => {
    expect(Object.keys(STAT_ICONS)).toHaveLength(5);
    for (const k of STAT_KEYS) expect(STAT_ICONS[k]).toMatch(/\p{Extended_Pictographic}/u);
  });

  /**
   * **호출부가 실제로 남아 있는지 본다.** 예전 이 단언은 이름만 "실제 호출부가 있다"이고
   * 본문은 표의 존재만 봤다 — `GameScreen`의 템플릿 조립을 지워도 통과했다(실측 MISSED).
   *
   * 글자 채널의 존재 이유가 "JSX를 못 받는 호출부가 있다"는 것이므로, 그 호출부가 0이 되면
   * 이 표는 죽은 코드다. 숫자를 세서 **사라지는 순간 빨강**이 되게 한다.
   */
  it('글자 채널을 쓰는 호출부가 남아 있다', () => {
    const SRC = resolve(process.cwd(), 'src');
    const files = (dir: string, acc: string[] = []): string[] => {
      for (const name of readdirSync(dir)) {
        const f = join(dir, name);
        if (statSync(f).isDirectory()) { if (name !== '__tests__') files(f, acc); }
        else if (/\.tsx?$/.test(name)) acc.push(f);
      }
      return acc;
    };
    /**
     * **주석은 호출부가 아니다.** T63 실측: `WeeklyResultScreen`의 스탯 칩을 그림 채널로
     * 옮겨 이 파일이 진짜 소비자가 아니게 됐는데, "예전엔 `STAT_ICONS[k]`를 담았다"고 적어둔
     * **주석 한 줄 때문에** 이 단언이 그대로 초록이었다. 실호출을 전부 지우고 설명 주석만
     * 남겨도 통과한다는 뜻이다 — 코드에서 주석을 걷어낸 뒤에 본다.
     */
    const stripComments = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const usesTextChannel = (src: string) => /\bSTAT_ICONS\s*\[/.test(stripComments(src));
    const consumers = files(SRC)
      .filter(f => !f.endsWith('shared.ts'))
      .filter(f => usesTextChannel(readFileSync(f, 'utf8')))
      .map(f => f.replace(SRC, 'src'));
    // 탐지기 자기검사 — 정규식이 죽으면 목록이 비고, 그러면 아래 단언이 전부 빨강이 된다.
    expect(usesTextChannel('const a = `${STAT_ICONS[k]} …`;'), '탐지기가 템플릿 호출을 못 본다').toBe(true);
    expect(usesTextChannel('import { STAT_ICONS } from "x"'), '단순 import는 호출부가 아니다').toBe(false);
    expect(usesTextChannel('// 예전엔 STAT_ICONS[k]를 담았다'), '줄 주석이 호출부로 세어진다').toBe(false);
    expect(usesTextChannel('/** 예전엔 `STAT_ICONS[k]`를 담았다 */'), '블록 주석이 호출부로 세어진다').toBe(false);
    // 주석 제거가 **코드까지** 먹으면 목록이 비어 아래가 빨강이 되지만, 이유가 엉뚱해진다.
    expect(usesTextChannel('/* 주석 */ push(STAT_ICONS[k]);'), '주석 제거가 뒤따르는 코드를 먹는다').toBe(true);

    /**
     * **개수가 아니라 이름으로, 그리고 집합 전체로 잠근다.** 처음엔 `>= 3`이었는데 실사용이
     * 4곳이라 하나를 지워도 통과했다(실측 MISSED).
     *
     * T63에서 근거가 둘 줄었다 — `WeeklyResultScreen`의 칩은 판별 유니온으로 나뉘어,
     * `EndingScreen`의 표는 반복 표라서 그림 채널로 갔다. **필수 이름이 3에서 2로 줄었으니
     * 아래쪽(존재) 잠금은 그만큼 약해졌다.** 그 대신 위쪽을 막는다: 소비자 집합이 정확히
     * 이 둘이어야 한다. 새 자리가 글자 채널을 쓰기 시작하면 — 즉 이모지가 조용히 돌아오면 —
     * 여기서 빨강이 나고, `shared.ts`의 근거 목록을 같이 고치게 된다.
     */
    expect(consumers.sort(), '글자 채널 소비자 집합이 shared.ts가 적어둔 근거와 다르다').toEqual([
      'src/components/GameScreen.tsx',
      'src/components/screens/main/MiniTalkModal.tsx',
    ]);
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

  // **방학도 찬 상태를 봐야 한다.** 빈 상태만 보면 방학 경로의 채움 분기가 통째로
  // 잠기지 않는다 — 실측: `selectedActivities[i] ? 'weekendFilled' : 'weekend'`를
  // `'weekend'`로 고정해도 2582개 전부 초록이었다. 방학은 플레이의 23%다.
  it('방학 슬롯도 채우면 채움 그림으로 바뀐다', () => {
    const one = ACTIVITIES.find(a => a.slots === 1);
    expect(one, '전제: 1칸 활동이 있다').toBeTruthy();
    const { container } = renderPlanner(
      plannerState({ isVacation: true, week: 21 }), [one!.id, one!.id],
    );
    expect(iconIds(container, 'slot')).toEqual(['slot:weekendFilled', 'slot:weekendFilled']);
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
    const ids = iconIds(root, 'slot');
    expect(ids.length, '플래너가 화면에 없거나 아이콘이 안 붙었다').toBeGreaterThanOrEqual(6);
    // 이 상태(학기·루틴 없음·주말 비움)의 정확한 목록. 개수만 보면 **엉뚱한 kind가 6개**여도 통과한다.
    expect(ids.slice(0, 6)).toEqual([
      'slot:school', 'slot:school', 'slot:empty', 'slot:free', 'slot:weekend', 'slot:weekend',
    ]);
  });

  // 계약 테스트는 **기본값**(16/18/20)만 본다 — 화면에 나가는 건 호출부가 넘기는 값이다.
  // 실측: 슬롯 호출부를 `size={4}`로 바꿔도 2582개 전부 초록이었다.
  it('화면에 나가는 아이콘 크기가 읽히는 범위에 있다', () => {
    const root = mount();
    const icons = [...root.querySelectorAll<SVGElement>('[data-icon]')];
    expect(icons.length, '전제: 주간 화면에 아이콘이 있다').toBeGreaterThanOrEqual(6);
    for (const el of icons) {
      const w = Number(el.getAttribute('width'));
      const id = el.getAttribute('data-icon');
      expect(w, `${id}가 너무 작다 — 1.5px 획이 뭉친다`).toBeGreaterThanOrEqual(12);
      expect(w, `${id}가 너무 크다 — 글자 줄을 밀어낸다`).toBeLessThanOrEqual(24);
    }
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
    // **행마다 자기 아이콘이라야 한다.** 개수만 보면 7줄이 전부 같은 책 그림이어도 통과한다
    // (실측: `category={cat}` → `category="study"` 고정에 2582개 전부 초록).
    expect(new Set(cats).size, '카테고리 행들이 같은 아이콘을 쓰고 있다').toBe(cats.length);
    const known = ACTIVITY_CATEGORIES.map(c => `cat:${c}`);
    expect(cats.every(c => known.includes(c)), `모르는 카테고리 아이콘: ${cats}`).toBe(true);
    // 화면에 뜬 순서가 SSOT 배열의 순서를 따른다(해금이 덜 된 해라 부분집합이다).
    expect(cats).toEqual(known.filter(k => cats.includes(k)));
    // 팝업 안에 **걷어낸 이모지가 하나도** 남아 있으면 안 된다 — 제목 포함.
    // 📚/🌙/☀️는 슬롯 아이콘의 이모지판이라, 제목에 남으면 바로 아래 선화 목록과
    // 같은 그림이 두 언어로 나란히 선다(실제로 그랬다).
    const title = document.querySelector('#slot-edit-title');
    expect(title, '전제: 팝업 제목을 찾았다').toBeTruthy();
    expect(title!.textContent, '제목이 사라지면 안 된다').toMatch(/활동$/);
    const dialog = title!.closest('[role="dialog"]');
    expect(dialog, '전제: 팝업이 dialog 역할을 갖는다 — 못 찾으면 범위가 통째로 어긋난다').toBeTruthy();
    // **범위는 팝업이 소유한 크롬까지.** 활동 카드의 힌트 칩 문구는 엔진 데이터(`activityHints`)라
    // 이번 범위 밖인데(예: '🌙 지금 필요함'), 다이얼로그 전체를 훑으면 어떤 활동이 목록에 뜨느냐에
    // 따라 이 단언이 켜졌다 꺼졌다 한다. 지금 통과하는 건 루틴 팝업이 rest를 걸러내기 때문뿐이라,
    // 주말 팝업 케이스를 하나 더하는 순간 깨지는 **잠재 flake**였다(3자 검수).
    expect(emojiInText(title!), '제목에 이모지가 돌아왔다').toEqual([]);
    for (const head of dialog!.querySelectorAll('button[aria-expanded]')) {
      expect(emojiInText(head), '카테고리 헤더에 이모지가 돌아왔다').toEqual([]);
    }
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
    // 자유시간 버튼 자신만 본다 — 이유는 위 단언의 주석과 같다(활동 힌트 칩은 범위 밖).
    expect(emojiInText(free!), '자유시간 버튼에 이모지가 돌아왔다').toEqual([]);
  });

  /**
   * **주간 결산도 그림 채널이다.** `icons.tsx` 주석이 그림 채널을 "StatsPanel · 주간 결산
   * 스탯 표" 둘이라고 선언했는데, 정작 결산 쪽은 배선 테스트가 0건이었다 — 실측:
   * `<StatIcon>`을 통째로 지워도 2582개 전부 초록. 이 화면을 바꾼 명분이 "한쪽만 선화로
   * 바꾸면 매주 두 화면을 오가며 그림이 바뀐다"였으니, 그 한쪽이 잠겨 있어야 말이 된다.
   */
  /** 결산 화면을 원하는 주간 로그로 띄운다 — 칩 유무를 픽스처로 정하기 위해서다. */
  function renderResult(patch: Partial<import('../../engine/types').WeekLog>) {
    let st = createInitialState('male', ['strict', 'emotional'], { rngSeed: 11 });
    st = { ...st, year: 3, week: 12, routineSlot2: 'self-study', routineSlot3: 'light-exercise' };
    st = processWeek(st);
    const weekLog = { ...st.weekLog!, ...patch };
    // 이벤트가 걸리면 결산이 아니라 이벤트 화면이 뜬다 — 결산만 보고 싶으므로 비운다.
    useGameStore.setState({ state: { ...st, weekLog, currentEvent: null, phase: 'result' } });
    const { container } = render(<GameScreen />);
    expect(container.textContent, '전제: 결산 화면이다').toMatch(/이번 주의 기록|주차/);
    return container;
  }

  it('주간 결산의 스탯 5행도 선화를 쓴다', () => {
    // **칩이 없는 주로 고정한다.** 이 단언의 대상은 표 5행인데 '잃은 것' 칩도 이제 같은
    // `stat:` 선화라 한 화면에 섞인다(실측: 손 안 댄 픽스처에서 6개였다). 칩은 아래 전용 단언이 본다.
    const container = renderResult({ statChanges: {}, fatigueChange: 0 });
    expect(iconIds(container, 'stat'), '결산 스탯 표의 선화가 없다')
      .toEqual(STAT_KEYS.map(k => `stat:${k}`));
    // 주간 화면과 **같은 막대**라야 한다. 아이콘만 맞추고 막대를 안 맞추면 반쪽이다.
    const tracks = [...container.querySelectorAll<HTMLElement>('div')]
      .filter(d => d.style.height === `${STAT_BAR_HEIGHT}px`);
    expect(tracks.length, '결산 막대가 주간 화면과 다른 높이다').toBe(STAT_KEYS.length);
  });

  /**
   * **같은 화면에서 학업이 두 그림이었다.** 표 20줄 위의 '잃은 것' 칩은 `icon: string` 한 필드에
   * `STAT_ICONS[k]`와 `'🥱'`를 같이 담고 있어서, 표가 선화로 바뀐 뒤에도 📚로 남았다.
   * 데이터를 판별 유니온으로 나눈 뒤의 계약을 잠근다 — 스탯은 선화, 피로만 이모지.
   */
  it('결산 "잃은 것" 칩도 표와 같은 선화를 쓴다 — 피로만 이모지', () => {
    const container = renderResult({
      statChanges: { academic: -2.4, mental: -0.8 },
      fatigueChange: 30,
    });

    // 칩은 자식이 둘(아이콘·문구)이고, 표 행은 여섯이다 — 그래서 텍스트가 겹쳐도 안 섞인다.
    const chipByText = (text: string): HTMLElement => {
      const hits = [...container.querySelectorAll<HTMLElement>('div')]
        .filter(d => d.children.length === 2 && (d.textContent ?? '').includes(text));
      expect(hits.length, `'${text}' 칩을 하나로 못 집었다`).toBe(1);
      return hits[0];
    };

    const academic = chipByText('학업 -2.4');
    expect(academic.querySelector('[data-icon="stat:academic"]'),
      '칩이 표와 다른 그림을 쓴다 — 한 화면에서 학업이 두 얼굴이 된다').toBeTruthy();
    expect(emojiInText(academic), '칩에 이모지가 돌아왔다').toEqual([]);

    expect(chipByText('멘탈 -0.8').querySelector('[data-icon="stat:mental"]'),
      '두 번째 칩이 선화가 아니다').toBeTruthy();

    // 피로는 스탯 축이 아니다 — 여기만 이모지로 남는 게 맞다.
    const fatigue = chipByText('피로 누적');
    expect(fatigue.textContent, '피로 이모지까지 걷어내면 범위를 넘은 것이다').toContain('🥱');
    expect(fatigue.querySelector('[data-icon]'), '피로에 스탯 선화가 붙었다').toBeFalsy();

    // 칩 2 + 표 5. 칩이 표보다 앞이다 — 개수만 세면 칩이 표에서 새어 나온 경우도 통과한다.
    expect(iconIds(container, 'stat'), '칩과 표의 구성이 바뀌었다').toEqual([
      'stat:academic', 'stat:mental', ...STAT_KEYS.map(k => `stat:${k}`),
    ]);
  });

  /**
   * **칩 선택 규칙은 이번에 안 건드렸다 — 그걸 잠근다.**
   *
   * 실측으로 한 번 헛짚었다. 처음엔 `{academic:-2.4, mental:-0.8, social:-0.2}` 한 판에서
   * "인기 -0.2 칩이 없다"로 문턱을 보려 했는데, 그 판은 **상위 2개 자르기만으로도** 인기가
   * 빠진다. 문턱을 0.5에서 0.1로 풀어도 칩 목록이 그대로라 단언이 공허했다(뮤테이션 MISSED).
   * 두 규칙은 서로를 가리므로, 각각 **혼자 결과를 가르는** 판에서 따로 본다.
   */
  it('칩 선택 규칙(문턱 0.5 · 상위 2개)이 그대로다', () => {
    // 문턱만 가른다 — 후보가 둘뿐이라 자르기는 아무것도 안 뺀다.
    // 문턱을 풀면(≤ -0.1) 인기가 칩이 된다.
    const byThreshold = renderResult({ statChanges: { academic: -2.4, social: -0.2 }, fatigueChange: 0 });
    expect(byThreshold.textContent, '문턱 아래 변화까지 칩이 됐다').not.toContain('인기 -0.2');
    expect(iconIds(byThreshold, 'stat'), '문턱 판의 칩은 학업 하나여야 한다')
      .toEqual(['stat:academic', ...STAT_KEYS.map(k => `stat:${k}`)]);

    // 자르기만 가른다 — 셋 다 문턱을 넘으니 빠지는 이유가 상위 2개뿐이다.
    const bySlice = renderResult({ statChanges: { academic: -2.4, mental: -1.5, health: -0.9 }, fatigueChange: 0 });
    expect(bySlice.textContent, '셋째 칩까지 나왔다 — 상위 2개 자르기가 풀렸다').not.toContain('체력 -0.9');
    expect(iconIds(bySlice, 'stat'), '자르기 판의 칩은 학업·멘탈 둘이어야 한다')
      .toEqual(['stat:academic', 'stat:mental', ...STAT_KEYS.map(k => `stat:${k}`)]);

    // 피로 문턱(25)도 같은 함정에 있었다 — 위 두 판은 30과 0이라 5로 낮춰도 결과가 같았다
    // (뮤테이션 MISSED). 25와 5 **사이**를 하나 둔다. 위쪽은 30을 쓰는 칩 단언이 잡는다.
    const byFatigue = renderResult({ statChanges: { academic: -2.4 }, fatigueChange: 10 });
    expect(byFatigue.textContent, '피로 문턱 아래인데 칩이 떴다').not.toContain('피로 누적');
  });

  /**
   * **엔딩 표도 반복 5행이다.** 주간 화면·결산과 한 규칙인데 #496의 범위 밖이라 이모지로 남아
   * 있었다. 화면 전체가 아니라 **표로 좁혀서** 이모지를 본다 — 엔딩에는 `PARENT_RECALL_MAP`의
   * `resilience: '⭐'`가 있고, 그건 `STAT_ICONS.social`과 **같은 글자**다. 화면 전체를 훑으면
   * 전환 뒤에도 빨갛고, 잘못 고치면 보호 대상인 부모 아이콘을 지우게 된다.
   */
  it('엔딩 스탯 5행도 같은 선화를 쓴다 (부모 ⭐는 그대로)', () => {
    const state = makeState({ year: 8, week: 1, parents: ['resilience', 'freedom'] });
    const { container } = render(
      <EndingScreen
        ending={calculateEnding(state)}
        track={state.track}
        stats={state.stats}
        parents={state.parents}
        burnoutCount={0}
        money={0}
        bgProps={{ bg: getBackground(1, false, 'normal', 8), bgImgError: true, onImgError: () => {} }}
        runDelta={null}
        gender="male"
        onRestartSameHome={null}
        onExitToTitle={() => {}}
      />,
    );

    const first = container.querySelector('[data-icon^="stat:"]');
    expect(first, '엔딩 스탯 표에 선화가 없다').toBeTruthy();
    const table = first!.closest('div')!.parentElement!;   // svg → span → 행 → 표
    expect(iconIds(table, 'stat'), '엔딩 표의 축 순서가 다르다')
      .toEqual(STAT_KEYS.map(k => `stat:${k}`));
    expect(emojiInText(table), '엔딩 표에 이모지가 돌아왔다').toEqual([]);

    // 막대도 같은 상수다 — 아이콘만 맞추고 막대를 두면 반쪽이다(결산에서 실제로 그랬다).
    const tracks = [...table.querySelectorAll<HTMLElement>('div')]
      .filter(d => d.style.height === `${STAT_BAR_HEIGHT}px`);
    expect(tracks.length, '엔딩 막대가 주간 화면과 다른 높이다').toBe(STAT_KEYS.length);

    // 범위 가드 — 부모 ⭐는 이번 경계 밖이라 남아 있어야 한다.
    expect(container.textContent, '부모 아이콘까지 걷어내면 경계를 넘은 것이다').toContain('⭐');
  });

  /**
   * **테두리는 두 화면이 같고, 그림자는 사진 위에만 있다.**
   *
   * 예전 이 단언은 `outline`만 봤다 — 그래서 그림자를 켜든 끄든 통과했고, 실제로 T63 전까지
   * 카드 안에도 그림자가 돌고 있었다. 실측으로 그 한 줄이 카드 바닥의 초상 둘레 4px을 17%
   * 어둡게 한다(42.4 vs 51.0). 두 축을 따로 잠근다.
   */
  it('HUD 초상은 테두리만, 그림자는 없다', () => {
    const root = mount();
    const hud = root.querySelector('[data-tutorial="hud"]')!;
    const img = hud.querySelector('img');
    expect(img, '전제: HUD에 초상 이미지가 있다').toBeTruthy();
    const style = img!.getAttribute('style') ?? '';
    expect(style, '액자가 없으면 파스텔 사각형이 카드에 박힌 것처럼 보인다').toMatch(/outline/);
    expect(style, '카드 안인데 그림자가 돌아왔다 — 초상 둘레가 한 겹 어두워진다')
      .not.toMatch(/box-shadow/);
  });

  it('주간 결산 초상은 그림자까지 받는다 (사진 위)', () => {
    const container = renderResult({ statChanges: {}, fatigueChange: 0 });
    const img = container.querySelector('img[alt^="player_"]');
    expect(img, '전제: 결산에 주인공 초상이 있다').toBeTruthy();
    const style = img!.getAttribute('style') ?? '';
    expect(style, '사진 위 초상의 테두리가 없다').toMatch(/outline/);
    expect(style, '그림자까지 끄면 사진 위에서 초상이 바탕에 박힌다 — 카드 안과는 다른 자리다')
      .toMatch(/box-shadow/);
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

  it('걷어낸 이모지 풀이 줄어들지 않았다', () => {
    // 풀이 줄면 위 부정형 단언들이 비례해서 헐거워진다. 18은 세 집합의 옛 이모지 총수다.
    expect(RETIRED_EMOJI.length, '풀을 줄이면 그만큼의 이모지가 무검사로 돌아온다').toBe(18);
    expect(new Set(RETIRED_EMOJI).size, '중복이 있으면 실제 덮는 글자는 더 적다').toBe(18);
  });

  // **전수로 돈다.** 한 글자만 양성 대조를 받으면 나머지 17개는 탐지되는지 아무도 모른다.
  it.each(RETIRED_EMOJI)('emojiInText가 %s 를 잡는다 (양성 전수)', (emoji) => {
    const { container } = render(<div>{emoji} 무언가</div>);
    expect(emojiInText(container)).toEqual([emoji]);
  });

  it('emojiInText는 선화를 이모지로 오인하지 않는다 (음성)', () => {
    // 여기서 걸리면 과검출이라 게이트가 죽는다.
    const { container } = render(<SlotIcon kind="plan" />);
    expect(emojiInText(container)).toEqual([]);
  });

  it('shapeCount는 빈 svg·빈 path·반지름 0을 전부 0으로 센다 (양성·음성)', () => {
    const { container: a } = render(<svg data-icon="fake:empty" />);
    expect(shapeCount(a.querySelector('svg')!), '요소가 없다').toBe(0);
    cleanup();
    // **d 없는 path**가 요점이다 — 요소만 세면 아이콘이 안 보이는데 1이 나온다.
    const { container: b } = render(<svg><path /><circle r="0" /><rect width="0" /></svg>);
    expect(shapeCount(b.querySelector('svg')!), '그리는 지시가 없으면 0이라야 한다').toBe(0);
    cleanup();
    expect(shapeCount(svgOf(<StatIcon stat="academic" />))).toBeGreaterThanOrEqual(1);
  });

  /**
   * 위 두 화면 단언은 `outline`과 `box-shadow`라는 **두 탐침**에 얹혀 있다. 탐침이 죽으면
   * 부정형 쪽("그림자가 없다")은 조용히 통과한다 — 그래서 세 변형을 **각각 따로 렌더해**
   * 두 탐침이 실제로 값을 가르는지 본다. 한 렌더 안에서 돌리면 대조가 대상을 소진한다(#495).
   */
  it('액자 탐지가 frame 세 갈래를 가른다 (양성·음성)', () => {
    const styleOf = (c: HTMLElement) => c.querySelector('img')?.getAttribute('style') ?? '';
    const photo = styleOf(render(<Portrait characterId="player_m" size={52} year={3} frame="photo" />).container);
    const card = styleOf(render(<Portrait characterId="player_m" size={52} year={3} frame="card" />).container);
    const bare = styleOf(render(<Portrait characterId="player_m" size={52} year={3} />).container);

    expect(photo, '전제: 사진 위 초상이 이미지로 렌더된다').toMatch(/outline/);
    expect(photo, '전제: 사진 위에는 그림자가 있다').toMatch(/box-shadow/);

    // 카드 변형은 **테두리는 같고 그림자만 없다** — 두 축이 따로 움직이는지 여기서 갈린다.
    expect(card, '카드 변형이 테두리까지 잃었다 — 두께는 안 건드리기로 했다').toMatch(/outline/);
    expect(card, 'box-shadow 탐침이 죽었다 — 위 "그림자 없다"는 근거가 없다').not.toMatch(/box-shadow/);

    // 테두리 값 자체가 같아야 한다. 있다/없다만 보면 1px로 낮춰도 통과한다(실측 0.6/255라 눈엔 안 보인다).
    const outlineOf = (st: string) => /outline:\s*([^;]+)/.exec(st)?.[1]?.trim();
    expect(outlineOf(card), '두 자리의 테두리가 갈라졌다').toBe(outlineOf(photo));
    expect(outlineOf(card), '테두리 두께가 바뀌었다').toMatch(/2px/);

    expect(bare, '액자를 안 주면 outline이 없어야 한다 — 남으면 탐지기가 아무것도 안 보는 것이다')
      .not.toMatch(/outline/);
    expect(bare, '액자를 안 줬는데 그림자가 있다').not.toMatch(/box-shadow/);
  });
});
