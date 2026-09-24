// @vitest-environment jsdom
// **엔딩 타이틀 갈래 전부가 화면에 실제로 그려지는가.**
//
// 엔진의 타이틀 분기는 세 곳이 잘 잠근다(`ending.test.ts` · `bondEndingTitle.test.ts` ·
// `scripts/verify/verify-ending-branches.ts`). 그런데 **화면**은 #469(T30)가 관계 타이틀
// 하나만 잠갔을 뿐이었다 — 그때 실측으로 확인된 사실: `EndingScreen.tsx`의
// `<div className="ending-title">{ending.title}</div>` / `.ending-desc` 두 줄을 통째로
// 지워도 기존 타이틀 갈래는 **하나도 빨강이 되지 않았다**. #435/#436과 똑같은 구멍
// ("값은 잠갔는데 화면은 안 잠갔다")이 관계 타이틀 밖 다섯 갈래에 그대로 남아 있었던 것이다.
//
// 그래서 이 파일은 **갈래마다 픽스처를 만들어 실제로 렌더**한다. 규칙 셋:
//  1. `ending` 객체를 손으로 만들지 않는다 — `calculateEnding(state)`에서 뽑는다.
//     필드 이름이 갈라지면(title→headline 등) 여기서 걸린다(#436 방식).
//  2. 갈래마다 **전제 단언**을 먼저 둔다. 픽스처가 의도한 분기에 못 닿으면 그 뒤의
//     렌더 단언은 아무것도 증명하지 못한다(#437: 코퍼스가 0건이면 게이트는 자기가
//     지워져도 초록이다).
//  3. **음성**: 다른 갈래의 타이틀 문자열이 화면 어디에도 없어야 한다. 렌더가 통째로
//     죽은 상태를 "통과"로 오독하지 않게, 양성 단언과 항상 짝으로 쓴다.
//
// 「곁에 남은 이름들」의 **양성** 렌더는 `endingBondTitleWiring.test.tsx`가 이미 잠근다
// (친구 이름이 설명에 닿는지까지 본다). 픽스처를 베끼지 않으려고 여기서는 그 갈래를
// 음성 행렬에만 넣는다 — 다른 갈래의 어느 행에서든 「곁에 남은 이름들」이 새어 나오면 걸린다.
import { describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { EndingScreen } from '../EndingScreen';
import { BOND_TITLE, calculateEnding } from '../../../engine/ending';
import { getBackground } from '../../../engine/backgrounds';
import { createInitialState } from '../../../engine/gameEngine';
import type { EndingData } from '../../../engine/ending';
import type { ExamResult, GameState, Gender, ParentStrength, Stats } from '../../../engine/types';

vi.mock('../../../engine/assetWebp', () => ({ webpSrc: (p: string) => p }));
vi.mock('../../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));
vi.mock('../../../audio/sfx', () => ({ playSfx: vi.fn() }));

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];
const RNG_SEED = 42;

// 특수 타이틀의 식별 문자열. **`BOND_TITLE`만 코드 상수이고 나머지 넷은 `ending.ts`의
// 인라인 리터럴**이라 여기서 파생시킬 수 없다(제품 코드를 건드리지 않는 것이 이 작업의 조건).
// 그래서 이 배열은 "코드 상수의 복사본"이 아니라 **화면에 나와야 할 문자열의 목록**으로 쓴다:
// 문구를 고치면 아래 전제 단언이 먼저 터져서 여기도 같이 고치게 된다.
const TITLE_MARKERS = [
  '완벽한 청춘',
  '고독한 승리자',
  '대가를 치른 승리자',
  '불꽃은 꺼지지 않는다',
  BOND_TITLE,
  '행복한 평범함',
] as const;
type TitleMarker = (typeof TITLE_MARKERS)[number];

function suneung(mockGrade: number): ExamResult {
  const blank = { score: 0, grade: 'C' as const, delta: 0 };
  return {
    subjects: { korean: blank, english: blank, math: blank, socialScience: blank, artsPhysical: blank },
    average: 0, rank: null, prevRank: null, comment: '', parentReaction: '', teacherReaction: '',
    examType: 'suneung', schoolLevel: 'high', year: 7, semester: 2, mockGrade,
  };
}

// 7년을 갈아 넣은 궤적 — 행복 D를 여는 유일한 경로(T21). 스냅샷만으로는 D가 안 열린다.
const GRIND_TRAJECTORY: Partial<GameState> = {
  lowMentalWeeksByYear: [22, 22, 22, 21, 22, 21, 21],
  veryLowMentalWeeksByYear: [5, 5, 5, 5, 5, 5, 4],
  burnoutCountByYear: [2, 2, 2, 1, 2, 1, 1],
};

function endingState(stats: Stats, over: Partial<GameState> = {}, gender: Gender = 'male'): GameState {
  const st = createInitialState(gender, PARENTS, { rngSeed: RNG_SEED });
  st.stats = { ...stats };
  // **엔딩 시점의 실제 상태는 year 7이 아니라 8이다** — applyYearTransition이 Y7 마감에서
  // year++ 한 뒤 phase='ending'으로 넘긴다(EndingScreen.tsx의 CG 주석 · archiveWiring 전례).
  // 픽스처가 7이면 이 화면이 실제로 받는 상태와 다른 것을 잠그게 된다.
  st.year = 8;
  st.phase = 'ending';
  return Object.assign(st, over);
}

function renderEnding(st: GameState, ending: EndingData) {
  render(
    <EndingScreen
      ending={ending} track={st.track} stats={st.stats} parents={st.parents}
      burnoutCount={st.burnoutCount}
      money={st.money}
      moneySpentByYear={st.moneySpentByYear}
      moneyBlockedWeeksByYear={st.moneyBlockedWeeksByYear}
      bgProps={{ bg: getBackground(48, false, 'normal', 7), bgImgError: true, onImgError: vi.fn() }}
      runDelta={null} gender={st.gender}
      onRestartSameHome={null}
      onExitToTitle={() => {}}
    />,
  );
}

type Branch = {
  name: string;
  /** 이 갈래를 식별하는 타이틀 문자열. 기본 갈래(진로 이름 그대로)는 null. */
  marker: TitleMarker | null;
  /** 이 갈래에 닿는 GameState. ending은 여기서 calculateEnding으로 뽑는다. */
  state: () => GameState;
};

// 각 게이트 조건은 `ending.ts` calculateEnding의 if/else 사슬 순서 그대로다.
const BRANCHES: Branch[] = [
  {
    // flawlessTop && happiness === 'S' && suneungGrade <= 2
    name: '완벽한 청춘',
    marker: '완벽한 청춘',
    state: () => endingState(
      { academic: 95, talent: 90, social: 95, mental: 95, health: 95 },
      { examResults: [suneung(1)], track: 'humanities' },
    ),
  },
  {
    // flawlessTop && happiness === 'D' && suneungGrade <= 2, wasAlone = social < 40 → false
    // **social을 경계값 40으로 둔다.** 실측: `social < 40`을 `< 50`으로 올려도 리포 전체가
    // 초록이었다(엔진 테스트의 짝은 social 88·30이라 둘 사이 칸이 비어 있다). 40이면 한 칸만
    // 움직여도 화면 문구가 「고독한」으로 갈려 여기서 걸린다.
    name: '대가를 치른 승리자 (social 40 — 고립 경계 바로 위)',
    marker: '대가를 치른 승리자',
    state: () => endingState(
      { academic: 95, talent: 90, social: 40, mental: 85, health: 85 },
      { ...GRIND_TRAJECTORY, examResults: [suneung(1)], track: 'humanities' },
    ),
  },
  {
    // 같은 게이트 · wasAlone = social < 40 → true. 문구가 갈리는 유일한 갈래라 두 행으로 둔다.
    name: '고독한 승리자 (social < 40)',
    marker: '고독한 승리자',
    state: () => endingState(
      { academic: 95, talent: 90, social: 30, mental: 85, health: 85 },
      { ...GRIND_TRAJECTORY, examResults: [suneung(1)], track: 'humanities' },
    ),
  },
  {
    // state.burnoutCount >= 3 && suneungGrade <= 4 — 두 값을 **경계에 딱 맞춰** 둔다.
    // 번아웃 3은 이미 잠겨 있었지만(>=4로 올리면 빨강), 수능 임계는 <=5로 올려도 리포 전체가
    // 초록이었다(실측). 아래 음성 행(수능 5등급)과 짝을 이룬다.
    name: '불꽃은 꺼지지 않는다 (번아웃 3 · 수능 4등급 — 양쪽 경계)',
    marker: '불꽃은 꺼지지 않는다',
    state: () => endingState(
      { academic: 70, talent: 50, social: 40, mental: 40, health: 50 },
      { examResults: [suneung(4)], track: 'humanities', burnoutCount: 3 },
    ),
  },
  {
    // happiness === 'S' && !flawlessTop && academic < 60 — academic도 경계값(59)으로.
    // `< 60`을 `< 70`으로 올려도, 조건을 통째로 지워도 리포 전체가 초록이었다(실측).
    name: '행복한 평범함 (academic 59 — 경계 바로 아래)',
    marker: '행복한 평범함',
    state: () => endingState(
      { academic: 59, talent: 45, social: 60, mental: 80, health: 60 },
      { examResults: [suneung(5)], track: 'humanities' },
    ),
  },
  {
    // 어느 특수 조합에도 안 걸리는 판 — 타이틀 = 진로 이름 그대로.
    // **수능 카드가 같이 뜨는 모양**이라 진로 문자열이 화면에 두 번 나온다(타이틀 + 카드).
    // 그래서 이 행은 `.ending-title` 셀렉터로 자리를 특정한다 — "문자열이 어딘가 있다"만
    // 보는 게이트는 타이틀 줄을 지워도 카드 때문에 초록이 된다(#434 계열).
    name: '기본 — 진로 이름 그대로 (수능 카드 있음)',
    marker: null,
    state: () => endingState(
      { academic: 75, talent: 60, social: 70, mental: 70, health: 65 },
      { examResults: [suneung(3)], track: 'humanities' },
    ),
  },
  {
    // 수능을 못 본 판(examResults 빈 배열) — suneungGrade가 null이라 진로 카드 자체가 안 뜬다.
    // 위 행과 짝: 카드가 있든 없든 타이틀 줄은 늘 그려져야 한다.
    name: '기본 — 진로 이름 그대로 (수능 카드 없음)',
    marker: null,
    state: () => endingState(
      { academic: 40, talent: 40, social: 45, mental: 50, health: 50 },
      { examResults: [], track: null },
    ),
  },

  // ── 경계 음성 행 ──────────────────────────────────────────────────────────────
  // 위 양성 행과 **한 값만 다른** 짝. 양성만 두면 게이트 임계를 한 칸 옮겨도 전부 초록이다
  // (#374/#460: 임계값은 양방향 뮤테이션 필수). 아래 넷은 실측으로 리포 전체가 놓치던
  // 뮤테이션 다섯 개를 각각 잡는다.
  {
    // 「완벽한 청춘」의 나머지 조건은 전부 그대로, 수능만 3등급. `<= 2`를 `<= 3`으로 올리면 빨강.
    name: '기본 — 수능 3등급이면 「완벽한 청춘」이 아니다 (≤2 경계)',
    marker: null,
    state: () => endingState(
      { academic: 95, talent: 90, social: 95, mental: 95, health: 95 },
      { examResults: [suneung(3)], track: 'humanities' },
    ),
  },
  {
    // 번아웃은 그대로 3회인데 수능만 5등급. `<= 4`를 올리거나 수능 조건을 지우면 빨강.
    name: '기본 — 번아웃 3회여도 수능 5등급이면 「불꽃」이 아니다 (≤4 경계)',
    marker: null,
    state: () => endingState(
      { academic: 70, talent: 50, social: 40, mental: 40, health: 50 },
      { examResults: [suneung(5)], track: 'humanities', burnoutCount: 3 },
    ),
  },
  {
    // 행복 S · 비(非)최상위는 그대로, academic만 경계값 60. `< 60`을 올리거나 지우면 빨강.
    name: '기본 — academic 60이면 「행복한 평범함」이 아니다 (<60 경계)',
    marker: null,
    state: () => endingState(
      { academic: 60, talent: 45, social: 60, mental: 80, health: 60 },
      { examResults: [suneung(5)], track: 'humanities' },
    ),
  },
  {
    // academic은 55(<60)이고 행복도 S인데 **특기로 무결점 최상위**라 flawlessTop이 true다.
    // 「성적은 평범했지만」은 이 판에 거짓이므로 열리면 안 된다. `!flawlessTop`을 지우면 빨강.
    name: '기본 — 무결점 최상위는 「행복한 평범함」이 아니다 (!flawlessTop)',
    marker: null,
    state: () => endingState(
      { academic: 55, talent: 90, social: 85, mental: 90, health: 85 },
      { examResults: [suneung(3)], track: 'humanities' },
    ),
  },
];

describe('EndingScreen — 타이틀 갈래 렌더 잠금', () => {
  // **빈 표는 통과가 아니다.** it.each는 행이 0개여도 조용히 초록이므로, 표가 실제로
  // 모든 특수 갈래를 덮는지 먼저 단언한다(#437: 코퍼스 0건이면 게이트는 자기가 지워져도 ✅).
  it('갈래 표가 특수 타이틀을 전부 덮는다 (기본 갈래 포함)', () => {
    expect(BRANCHES.length).toBeGreaterThan(0);
    const covered = new Set(BRANCHES.map(b => b.marker).filter((m): m is TitleMarker => m !== null));
    for (const m of TITLE_MARKERS) {
      // 관계 타이틀의 양성 렌더는 endingBondTitleWiring.test.tsx 소관 — 픽스처를 베끼지 않는다.
      if (m === BOND_TITLE) continue;
      expect(covered, `${m} 갈래를 덮는 행이 없다`).toContain(m);
    }
    expect(BRANCHES.some(b => b.marker === null), '기본 갈래(진로 이름 그대로) 행이 없다').toBe(true);
  });

  it.each(BRANCHES)('$name — 타이틀·설명이 화면에 그려진다', ({ marker, state }) => {
    const st = state();
    const ending = calculateEnding(st);

    // ── 전제: 픽스처가 정말 이 갈래에 닿았나 ──
    if (marker) {
      expect(ending.title, '픽스처 자기검사: 의도한 갈래에 닿지 못했다').toContain(marker);
    } else {
      for (const m of TITLE_MARKERS) {
        expect(ending.title, `픽스처 자기검사: 기본 갈래인데 ${m}에 걸렸다`).not.toContain(m);
      }
      expect(ending.title, '기본 갈래의 타이틀은 진로 이름 그 자체다').toBe(ending.career);
    }
    // 특수 타이틀도 진로를 지우지 않고 뒤에 붙인다 — 다섯 갈래 공통 모양.
    expect(ending.title, '진로 문자열이 타이틀에서 사라졌다').toContain(ending.career);
    expect(ending.description, '설명은 진로 문장을 품는다').toContain(ending.careerDetail);

    // ── 렌더 ──
    renderEnding(st, ending);

    // 화면에 뜬 문자열이 곧 엔진이 낸 문자열이어야 한다(요약·자름·다른 필드 참조 금지).
    // 셀렉터로 자리까지 특정한다 — 진로 카드가 같은 문자열을 들고 있는 행이 있기 때문.
    const titleEl = screen.getByText(ending.title, { selector: '.ending-title' });
    expect(titleEl.textContent).toBe(ending.title);
    const descEl = screen.getByText(ending.description, { selector: '.ending-desc' });
    expect(descEl.textContent).toBe(ending.description);

    // ── 음성: 다른 갈래의 타이틀은 화면 어디에도 없다 ──
    for (const m of TITLE_MARKERS) {
      if (m === marker) continue;
      expect(document.body.textContent, `다른 갈래 「${m}」가 화면에 새어 나왔다`).not.toContain(m);
    }
  });

  // 「대가를 치른」/「고독한」은 같은 게이트에서 social 하나로 갈린다 — 설명 문장도 같이 갈린다.
  // 타이틀만 잠그면 문장 배선을 끊어도(둘 다 같은 설명) 초록이므로 여기서 한 번 더 못 박는다.
  it('승리자 두 판본은 설명 문장까지 화면에서 갈린다', () => {
    const alone = BRANCHES.find(b => b.marker === '고독한 승리자')!.state();
    const notAlone = BRANCHES.find(b => b.marker === '대가를 치른 승리자')!.state();

    const aloneEnding = calculateEnding(alone);
    renderEnding(alone, aloneEnding);
    expect(screen.getByText(aloneEnding.description, { selector: '.ending-desc' }).textContent)
      .toContain('곁에 아무도 없었다');
    cleanup();

    const notAloneEnding = calculateEnding(notAlone);
    renderEnding(notAlone, notAloneEnding);
    const desc = screen.getByText(notAloneEnding.description, { selector: '.ending-desc' }).textContent;
    expect(desc, '고립 경계 위(social 40)인데 "곁에 아무도 없었다"면 거짓말이다').not.toContain('곁에 아무도 없었다');
    expect(desc).toContain('그 몇 해가 통째로 어두웠다');
  });

  // gender는 required prop이고(회상 CG 판본), 엔딩 상태의 year는 8이다. 두 계약 위에서
  // 렌더가 터지지 않는지만 본다 — 다른 레이어(후회·근황·부모 에필로그)는 이 파일 범위 밖이다.
  it('엔딩 시점 계약(year=8 · gender 양쪽)에서 렌더가 터지지 않는다', () => {
    for (const gender of ['male', 'female'] as const) {
      const st = endingState(
        { academic: 95, talent: 90, social: 95, mental: 95, health: 95 },
        { examResults: [suneung(1)], track: 'humanities' },
        gender,
      );
      expect(st.year, '엔딩 상태의 year는 8이다').toBe(8);
      expect(st.gender).toBe(gender);
      const ending = calculateEnding(st);
      expect(() => renderEnding(st, ending)).not.toThrow();
      expect(screen.getByText(ending.title, { selector: '.ending-title' })).toBeTruthy();
      cleanup();
    }
  });
});
