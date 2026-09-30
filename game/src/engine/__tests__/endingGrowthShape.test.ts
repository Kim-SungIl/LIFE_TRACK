// 성장 모양(T58) 분류 계약.
//
// 이 층이 하는 일: 등급(bestAxis)이 뭉뚱그리는 "같은 S"를 **모양**으로 갈라 말한다.
// 그래서 잠글 것이 셋이다 — ① 경계 양쪽 ② 어느 갈래도 죽어 있지 않다 ③ 결정론.
//
// 임계는 전부 코드 상수에서 파생한다. 리터럴을 박으면 상수를 옮겨도 옛 값을 지키며
// 초록이 된다(BOND_MIN_FRIENDS 계열의 같은 함정).
import { describe, expect, it, vi } from 'vitest';
import {
  achievementAxes, achievementGradeOf, calculateEnding,
  GROWTH_EVEN_SPREAD, GROWTH_LEAD_GAP, GROWTH_NOTE, GROWTH_NOTE_FINAL,
  GROWTH_SHAPE_MIN_TOP, GROWTH_SHAPES,
  growthClaimHolds, growthNoteOf, growthShapeOf,
  type AchievementAxes, type GrowthShape,
} from '../ending';
import { createInitialState } from '../gameEngine';
import type { GameState, ParentStrength, Stats } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];
const RNG_SEED = 42;

/** 세 축을 **정확히** 원하는 값으로 만든다 — life는 셋의 평균이라 세 스탯을 같은 값으로 둔다. */
function statsFor(academic: number, talent: number, life: number): Stats {
  return { academic, talent, social: life, mental: life, health: life };
}

function axesOf(academic: number, talent: number, life: number): AchievementAxes {
  return achievementAxes(statsFor(academic, talent, life));
}

function endingState(stats: Stats): GameState {
  const st = createInitialState('male', PARENTS, { rngSeed: RNG_SEED });
  st.stats = { ...stats };
  return st;
}

describe('achievementAxes — 등급과 모양이 같은 세 값을 본다', () => {
  it('life 축은 멘탈·체력·인기의 평균이다', () => {
    const axes = achievementAxes({ academic: 71, talent: 33, mental: 90, health: 60, social: 30 });
    expect(axes.academic).toBe(71);
    expect(axes.talent).toBe(33);
    expect(axes.life).toBe(60);   // (90 + 60 + 30) / 3
  });

  it('픽스처 자기검사: statsFor가 의도한 세 축을 실제로 만든다', () => {
    const axes = axesOf(80, 62, 44);
    expect([axes.academic, axes.talent, axes.life]).toEqual([80, 62, 44]);
  });
});

describe('growthShapeOf — 경계 양쪽', () => {
  // ── 균형 경계(spread = 최고 − 최저) ───────────────────────────────
  // bottom을 68로 고정하고 top만 움직인다. lead는 작게 둬서 singular 분기가 끼어들지 않게.
  const BOTTOM = 68;
  const MID = BOTTOM + GROWTH_EVEN_SPREAD / 2;

  it(`spread가 정확히 ${GROWTH_EVEN_SPREAD}면 균형이다 (경계 포함)`, () => {
    const axes = axesOf(BOTTOM + GROWTH_EVEN_SPREAD, MID, BOTTOM);
    expect(axes.academic - axes.life, '픽스처 자기검사: spread가 문턱과 같다').toBe(GROWTH_EVEN_SPREAD);
    expect(growthShapeOf(axes)).toBe('even');
  });

  it(`spread가 ${GROWTH_EVEN_SPREAD}을 넘으면 균형이 아니다`, () => {
    const axes = axesOf(BOTTOM + GROWTH_EVEN_SPREAD + 0.5, MID, BOTTOM);
    expect(axes.academic - axes.life).toBeGreaterThan(GROWTH_EVEN_SPREAD);
    expect(growthShapeOf(axes)).not.toBe('even');
    expect(growthShapeOf(axes), '균형에서 떨어지면 두 갈래로 간다').toBe('twin');
  });

  it(`spread가 ${GROWTH_EVEN_SPREAD} 아래면 균형이다 (안쪽)`, () => {
    expect(growthShapeOf(axesOf(BOTTOM + GROWTH_EVEN_SPREAD - 0.5, MID, BOTTOM))).toBe('even');
  });

  // ── 전문화 경계(lead = 최고 − 차점) ───────────────────────────────
  // 차점과 최저를 같은 값에 두면 lead == spread라, 균형 분기는 이미 지나간 뒤다.
  const SECOND = 60;

  it(`lead가 정확히 ${GROWTH_LEAD_GAP}면 전문화다 (경계 포함)`, () => {
    const axes = axesOf(SECOND + GROWTH_LEAD_GAP, SECOND, SECOND);
    expect(axes.academic - axes.talent, '픽스처 자기검사: lead가 문턱과 같다').toBe(GROWTH_LEAD_GAP);
    expect(growthShapeOf(axes)).toBe('singular');
  });

  it(`lead가 ${GROWTH_LEAD_GAP}에 못 미치면 두 갈래다`, () => {
    const axes = axesOf(SECOND + GROWTH_LEAD_GAP - 0.5, SECOND, SECOND);
    expect(axes.academic - axes.talent).toBeLessThan(GROWTH_LEAD_GAP);
    expect(growthShapeOf(axes)).toBe('twin');
  });

  it(`lead가 ${GROWTH_LEAD_GAP}을 넘으면 여전히 전문화다 (바깥)`, () => {
    expect(growthShapeOf(axesOf(SECOND + GROWTH_LEAD_GAP + 10, SECOND, SECOND))).toBe('singular');
  });

  it('두 문턱은 겹치지 않는다 — 균형으로 분류된 판은 절대 전문화 조건을 만족하지 않는다', () => {
    // GROWTH_LEAD_GAP > GROWTH_EVEN_SPREAD 이므로 순서를 바꿔도 결과가 같다.
    // 이 관계가 깨지면(둘을 같게 두거나 뒤집으면) 분류가 분기 순서에 의존하게 된다.
    expect(GROWTH_LEAD_GAP).toBeGreaterThan(GROWTH_EVEN_SPREAD);
  });

  // ── 바닥 경계(top < GROWTH_SHAPE_MIN_TOP → 모양 없음) ─────────────
  it(`최고 축이 정확히 ${GROWTH_SHAPE_MIN_TOP}면 모양을 말한다 (경계 포함)`, () => {
    const axes = axesOf(GROWTH_SHAPE_MIN_TOP, GROWTH_SHAPE_MIN_TOP - GROWTH_LEAD_GAP, GROWTH_SHAPE_MIN_TOP - GROWTH_LEAD_GAP);
    expect(axes.academic).toBe(GROWTH_SHAPE_MIN_TOP);
    expect(growthShapeOf(axes)).toBe('singular');
  });

  it(`최고 축이 ${GROWTH_SHAPE_MIN_TOP}에 못 미치면 아무 모양도 말하지 않는다`, () => {
    const axes = axesOf(GROWTH_SHAPE_MIN_TOP - 0.5, GROWTH_SHAPE_MIN_TOP - GROWTH_LEAD_GAP, GROWTH_SHAPE_MIN_TOP - GROWTH_LEAD_GAP);
    expect(axes.academic).toBeLessThan(GROWTH_SHAPE_MIN_TOP);
    expect(growthShapeOf(axes)).toBeNull();
    expect(growthNoteOf(axes)).toBeNull();
  });

  it('바닥은 최고 축만 본다 — 같은 모양이라도 위에 있으면 말한다 (양성 짝)', () => {
    const low = axesOf(GROWTH_SHAPE_MIN_TOP - 0.5, 10, 10);
    const high = axesOf(GROWTH_SHAPE_MIN_TOP + 40, 10, 10);
    expect(growthShapeOf(low)).toBeNull();
    expect(growthShapeOf(high), '간격 모양은 같은데 높이만 다르다').toBe('singular');
  });
});

// ⚠️ 위 경계 테스트는 문턱을 **상수에서 파생**한다. 그래서 규칙의 모양(경계를 포함하는가,
// 두 문턱이 겹치지 않는가)은 잠그지만 **값 자체는 원리상 못 잠근다** — 상수를 옮기면
// 픽스처가 같이 따라 움직인다. 실제로 뮤테이션 6종(12→13/11 · 20→21/19 · 40→41/39)이
// **전부 초록으로 살아남았다**(실측). 그래서 값은 여기서 리터럴로 못 박는다.
// 둘 다 있어야 한다: 파생 픽스처는 규칙을, 이 블록은 숫자를 잠근다.
describe('문턱 값 — 리터럴로 못 박는다 (파생 픽스처가 못 보는 축)', () => {
  it('세 문턱의 값이 실측 분포의 틈에서 고른 그 값이다', () => {
    expect(GROWTH_EVEN_SPREAD, '실측 spread 틈: 11.8 │ 14.1').toBe(12);
    expect(GROWTH_LEAD_GAP, '실측 lead 틈: 15.1 │ 32.2').toBe(20);
    expect(GROWTH_SHAPE_MIN_TOP, '실측 최고 축 틈: 36.3 │ 79.9').toBe(40);
  });

  // 착지값을 리터럴 스탯으로 적는다 — 상수를 한 칸 옮기면 이 표가 먼저 빨개진다.
  it.each([
    { label: 'spread 12 (경계) → 균형', a: 80, t: 74, l: 68, expected: 'even' },
    { label: 'spread 13 (한 칸 밖) → 두 갈래', a: 81, t: 74, l: 68, expected: 'twin' },
    { label: 'lead 20 (경계) → 전문화', a: 80, t: 60, l: 60, expected: 'singular' },
    { label: 'lead 19 (한 칸 안) → 두 갈래', a: 79, t: 60, l: 60, expected: 'twin' },
    { label: '최고 축 40 (경계) → 모양 있음', a: 40, t: 20, l: 20, expected: 'singular' },
    { label: '최고 축 39 (한 칸 아래) → 모양 없음', a: 39, t: 19, l: 19, expected: null },
  ] as const)('$label', ({ a, t, l, expected }) => {
    expect(growthShapeOf(axesOf(a, t, l))).toBe(expected);
  });
});

describe('growthShapeOf — 어느 갈래도 죽어 있지 않다', () => {
  // 실측 모양(QA 하네스 33페르소나 × 3시드). 손으로 지어낸 극단만 잠그면
  // "제품에서 실제로 나오는 판"이 어디로 떨어지는지는 여전히 아무도 모른다.
  const MEASURED: { label: string; stats: Stats; expected: GrowthShape | null }[] = [
    { label: '공부 몰빵(acad 90 / tal 7 / life 50)', stats: { academic: 90, talent: 7, mental: 50, health: 55, social: 45 }, expected: 'singular' },
    { label: '청개구리(acad 47 / tal 85 / life 51)', stats: { academic: 47, talent: 85, mental: 52, health: 50, social: 51 }, expected: 'singular' },
    { label: '유료루틴(acad 91 / tal 9 / life 87)', stats: { academic: 91, talent: 9, mental: 90, health: 88, social: 83 }, expected: 'twin' },
    { label: '관계 극한(acad 70 / tal 84 / life 88)', stats: { academic: 70, talent: 84, mental: 92, health: 80, social: 92 }, expected: 'twin' },
    { label: '균형형(acad 82 / tal 81 / life 86)', stats: { academic: 82, talent: 81, mental: 88, health: 85, social: 86 }, expected: 'even' },
    { label: '풀지출(acad 88 / tal 99 / life 90)', stats: { academic: 88, talent: 99, mental: 92, health: 90, social: 89 }, expected: 'even' },
    { label: '최소투입(acad 35 / tal 5 / life 21)', stats: { academic: 35, talent: 5, mental: 20, health: 20, social: 22 }, expected: null },
  ];

  it.each(MEASURED)('$label → $expected', ({ stats, expected }) => {
    expect(growthShapeOf(achievementAxes(stats))).toBe(expected);
  });

  it('스탯 공간 격자를 훑으면 세 모양과 "모양 없음"이 전부 나온다', () => {
    const seen = new Map<string, number>();
    for (let a = 0; a <= 100; a += 5) {
      for (let t = 0; t <= 100; t += 5) {
        for (let l = 0; l <= 100; l += 5) {
          const shape = growthShapeOf(axesOf(a, t, l));
          const key = shape ?? 'none';
          seen.set(key, (seen.get(key) ?? 0) + 1);
        }
      }
    }
    for (const shape of GROWTH_SHAPES) {
      expect(seen.get(shape) ?? 0, `죽은 갈래: ${shape}`).toBeGreaterThan(0);
    }
    expect(seen.get('none') ?? 0, '"모양 없음"도 도달 가능해야 한다').toBeGreaterThan(0);
    expect([...seen.keys()].sort(), '분류가 낼 수 있는 값은 이 넷뿐이다')
      .toEqual([...GROWTH_SHAPES, 'none'].sort());
  });

  it('세 모양 모두 성취 S와 함께 나올 수 있다 — 이 층이 존재하는 이유', () => {
    // 같은 S 안에서 갈라 말하지 못하면 T58이 한 일이 없다.
    const sByShape: Record<string, Stats | undefined> = {};
    for (let a = 0; a <= 100; a += 5) {
      for (let t = 0; t <= 100; t += 5) {
        for (let l = 0; l <= 100; l += 5) {
          const axes = axesOf(a, t, l);
          if (achievementGradeOf(Math.max(axes.academic, axes.talent, axes.life)) !== 'S') continue;
          const shape = growthShapeOf(axes);
          if (shape && !sByShape[shape]) sByShape[shape] = statsFor(a, t, l);
        }
      }
    }
    for (const shape of GROWTH_SHAPES) {
      expect(sByShape[shape], `성취 S에서 못 나오는 갈래: ${shape}`).toBeTruthy();
    }
  });
});

describe('growthNoteOf / GROWTH_NOTE — 문장 계약', () => {
  it('모양마다 문장이 하나씩 있고, 서로 다르다', () => {
    const notes = GROWTH_SHAPES.map(s => GROWTH_NOTE[s]);
    expect(Object.keys(GROWTH_NOTE).sort()).toEqual([...GROWTH_SHAPES].sort());
    for (const n of notes) expect(n.length).toBeGreaterThan(0);
    expect(new Set(notes).size, '두 모양이 같은 문장을 쓰면 갈라 말한 게 아니다').toBe(GROWTH_SHAPES.length);
  });

  it('hide-numbers — 수치·퍼센트·등급 글자를 쓰지 않는다', () => {
    for (const shape of GROWTH_SHAPES) {
      const note = GROWTH_NOTE[shape];
      // "7년"은 이 게임이 화면 곳곳에서 쓰는 기간 표현이라 수치 노출이 아니다.
      expect(note.replace(/7년/g, ''), `${shape}: 숫자 노출`).not.toMatch(/[0-9]/);
      expect(note, `${shape}: 퍼센트/점수 노출`).not.toMatch(/[%％]|점|상위/);
      expect(note, `${shape}: 등급 글자 노출`).not.toMatch(/\b[SABCD]\b|등급/);
    }
  });

  // ⚠️ 배선 테스트는 `GROWTH_NOTE[shape]`로 기대값을 만든다 — 그래서 **문장을 서로 뒤바꾸면
  // 양쪽이 같이 움직여 초록으로 살아남는다**(뮤테이션 M15 실측: 94개 전부 통과).
  // 모양↔문장의 짝은 여기서 내용으로 못 박는다.
  it('모양과 문장의 짝이 고정돼 있다', () => {
    expect(GROWTH_NOTE.singular, '전문화 = 한 줄로 곧은 7년').toContain('한 줄로 곧았다');
    expect(GROWTH_NOTE.twin, '두 갈래 = 나란히 쥔 둘').toContain('두 갈래를 나란히');
    expect(GROWTH_NOTE.even, '균형 = 어느 쪽으로도 안 기운 7년').toContain('어느 한쪽으로도 기울지 않은');
    // 표식만 보면 나머지 문장은 통째로 바뀌어도 통과한다 — 전문을 함께 굳힌다.
    expect(GROWTH_NOTE).toMatchInlineSnapshot(`
      {
        "even": "어느 한쪽으로도 기울지 않은 7년이었다. 공부도, 좋아하던 것도, 사는 일도 비슷한 무게로 들고 갔다.",
        "singular": "7년이 한 줄로 곧았다. 하나를 앞세운 뒤로, 나머지는 끝내 그 뒤에서 나오지 못했다.",
        "twin": "두 갈래를 나란히 쥐고 걸었다. 나머지 하나는 7년 내내 그다음 순서였다.",
      }
    `);
  });

  // T62 — 판본이 둘이 됐다. 약한 쪽도 같은 계약을 진다(비면 화면이 빈 줄을 그린다).
  it('최종 상태 판본도 모양마다 하나씩 있고 서로 다르다', () => {
    expect(Object.keys(GROWTH_NOTE_FINAL).sort()).toEqual([...GROWTH_SHAPES].sort());
    const notes = GROWTH_SHAPES.map(s => GROWTH_NOTE_FINAL[s]);
    for (const n of notes) expect(n.length).toBeGreaterThan(0);
    expect(new Set(notes).size).toBe(GROWTH_SHAPES.length);
  });

  // 약한 판본의 **존재 이유**가 여기 있다. 한 글자라도 "7년"을 주장하면 이 층은 무의미해진다.
  it('최종 상태 판본은 7년을 주장하지 않는다', () => {
    for (const shape of GROWTH_SHAPES) {
      const note = GROWTH_NOTE_FINAL[shape];
      expect(note, `${shape}: 약한 판본이 기간을 주장한다`).not.toMatch(/7년|내내|끝내/);
      expect(note.replace(/7년/g, ''), `${shape}: 숫자 노출`).not.toMatch(/[0-9]/);
      expect(GROWTH_NOTE[shape], `${shape}: 두 판본이 같은 문장이다`).not.toBe(note);
    }
    // 반대쪽 — 강한 판본은 **반드시** 기간을 말한다. 안 그러면 두 판본을 나눈 이유가 없다.
    for (const shape of GROWTH_SHAPES) {
      expect(GROWTH_NOTE[shape], `${shape}: 강한 판본이 7년을 안 말한다`).toMatch(/7년|내내|끝내/);
    }
  });

  it('growthNoteOf — 궤적이 뒷받침할 때만 7년 문장을 쓴다', () => {
    // 궤적 없음(구세이브) = 판정 불가 → 최종 상태 문구
    expect(growthNoteOf(axesOf(90, 40, 40))).toBe(GROWTH_NOTE_FINAL.singular);
    expect(growthNoteOf(axesOf(90, 88, 40))).toBe(GROWTH_NOTE_FINAL.twin);
    expect(growthNoteOf(axesOf(90, 88, 85))).toBe(GROWTH_NOTE_FINAL.even);

    // 궤적이 주장을 뒷받침하면 7년 문구
    expect(growthNoteOf(axesOf(90, 40, 40), [[60, 40, 40], [90, 40, 40]])).toBe(GROWTH_NOTE.singular);
    expect(growthNoteOf(axesOf(90, 88, 40), [[60, 55, 40], [90, 88, 40]])).toBe(GROWTH_NOTE.twin);
    expect(growthNoteOf(axesOf(90, 88, 85), [[60, 58, 55], [90, 88, 85]])).toBe(GROWTH_NOTE.even);

    // 궤적이 주장과 어긋나면 다시 최종 상태 문구 — **같은 최종 스탯인데 문장이 갈린다**
    expect(growthNoteOf(axesOf(90, 40, 40), [[40, 60, 40], [90, 40, 40]])).toBe(GROWTH_NOTE_FINAL.singular);
    expect(growthNoteOf(axesOf(90, 88, 40), [[60, 40, 55], [90, 88, 40]])).toBe(GROWTH_NOTE_FINAL.twin);
    expect(growthNoteOf(axesOf(90, 88, 85), [[90, 60, 55], [90, 88, 85]])).toBe(GROWTH_NOTE_FINAL.even);
  });
});

describe('growthClaimHolds — 모양마다 다른 것을 묻는다', () => {
  // 셋을 한 검사로 묶으면 안 된다. 특히 even에 순위 불변을 요구하면 **거의 모든 판이 거짓**이
  // 된다(셋이 한 뼘 안이라 순위가 흔들리는 게 균형의 정의다) — 초안에서 실제로 밟은 오판이다.
  it('even은 간격만 본다 — 순위가 뒤집혀도 참이다', () => {
    const axes = axesOf(85, 84, 83);
    const swapped: [number, number, number][] = [[60, 65, 62], [70, 68, 72], [85, 84, 83]];
    expect(growthClaimHolds('even', axes, swapped), '순위 흔들림을 기울었다고 읽었다').toBe(true);
    const tilted: [number, number, number][] = [[80, 50, 55], [85, 84, 83]];
    expect(growthClaimHolds('even', axes, tilted), '기운 해를 못 봤다').toBe(false);
  });

  it('singular은 1위를, twin은 3위를 본다 — 서로 다른 축이다', () => {
    const axes = axesOf(90, 88, 40);   // 1위 학업 · 3위 생활
    // 1위는 내내 학업인데 3위가 바뀐 궤적: singular은 참, twin은 거짓이어야 한다.
    const topStableBottomMoves: [number, number, number][] = [[90, 40, 55], [90, 88, 40]];
    expect(growthClaimHolds('singular', axes, topStableBottomMoves)).toBe(true);
    expect(growthClaimHolds('twin', axes, topStableBottomMoves)).toBe(false);
    // 반대 — 3위는 내내 생활인데 1위가 바뀐 궤적.
    const bottomStableTopMoves: [number, number, number][] = [[60, 80, 40], [90, 88, 40]];
    expect(growthClaimHolds('singular', axes, bottomStableTopMoves)).toBe(false);
    expect(growthClaimHolds('twin', axes, bottomStableTopMoves)).toBe(true);
  });

  it('근거가 없으면 참도 거짓도 아니다 (null)', () => {
    const axes = axesOf(90, 88, 40);
    expect(growthClaimHolds('twin', axes, undefined), '구세이브').toBeNull();
    expect(growthClaimHolds('twin', axes, []), '빈 배열도 근거가 아니다').toBeNull();
  });

  it('모양이라 부를 게 없던 해는 안 센다 — 문턱은 GROWTH_SHAPE_MIN_TOP 하나다', () => {
    const axes = axesOf(90, 88, 40);
    // 첫 해는 주장과 어긋나지만 최고 축이 문턱 아래라 세지 않는다.
    const below = GROWTH_SHAPE_MIN_TOP - 1;
    expect(growthClaimHolds('twin', axes, [[below, below - 20, below - 5], [90, 88, 40]])).toBe(true);
    // 문턱 위로 한 칸만 올리면 같은 해가 판정에 들어와 거짓이 된다(양방향).
    const at = GROWTH_SHAPE_MIN_TOP;
    expect(growthClaimHolds('twin', axes, [[at, at - 20, at - 5], [90, 88, 40]])).toBe(false);
  });

  it('손상된 궤적 줄은 판정에서 빠진다 (세이브가 낡거나 잘렸을 때)', () => {
    const axes = axesOf(90, 88, 40);
    const dirty = [
      null, [1, 2], [NaN, 50, 60], ['a', 'b', 'c'], [90, 88, 40],
    ] as unknown as [number, number, number][];
    expect(growthClaimHolds('twin', axes, dirty), '손상 줄에 걸려 거짓을 냈다').toBe(true);
  });
});

describe('growthShapeOf — 결정론', () => {
  it('난수를 쓰지 않는다 (Math.random을 막아도 돈다)', () => {
    const spy = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('성장 모양 분류가 난수를 읽었다');
    });
    try {
      expect(growthShapeOf(axesOf(90, 88, 40))).toBe('twin');
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('같은 입력을 여러 번 넣어도 같은 값이다', () => {
    const stats = statsFor(88, 61, 55);
    const first = growthShapeOf(achievementAxes(stats));
    for (let i = 0; i < 50; i++) expect(growthShapeOf(achievementAxes(stats))).toBe(first);
  });

  it('정렬이 입력 배열을 망가뜨리지 않는다 — 같은 객체를 다시 넣어도 결과가 같다', () => {
    const axes = axesOf(88, 61, 55);
    const before = { ...axes };
    const shape = growthShapeOf(axes);
    expect(axes).toEqual(before);
    expect(growthShapeOf(axes)).toBe(shape);
  });
});

describe('calculateEnding — 성장 모양이 엔딩 페이로드에 실린다', () => {
  it('엔진이 내는 값은 순수함수가 내는 값과 같다 (두 층이 갈리지 않는다)', () => {
    for (const stats of [
      statsFor(90, 7, 50), statsFor(91, 9, 87), statsFor(82, 81, 86), statsFor(35, 5, 21),
    ]) {
      const e = calculateEnding(endingState(stats));
      expect(e.growthShape).toBe(growthShapeOf(achievementAxes(stats)));
      expect(e.growthNote).toBe(growthNoteOf(achievementAxes(stats)));
    }
  });

  it('모양이 없는 판은 문장도 null이다 (음성 짝)', () => {
    const e = calculateEnding(endingState(statsFor(35, 5, 21)));
    expect(e.growthShape).toBeNull();
    expect(e.growthNote).toBeNull();
    // 등급은 여전히 나온다 — 엔딩이 통째로 비어 있는 걸 통과로 오독하지 않게.
    expect(e.achievement).toBe('C');
  });

  it('등급이 같아도 모양이 갈린다 — 성취 S 세 판이 서로 다른 문장을 받는다', () => {
    const runs = [statsFor(90, 20, 20), statsFor(91, 9, 87), statsFor(88, 86, 90)]
      .map(s => calculateEnding(endingState(s)));
    for (const e of runs) expect(e.achievement, '전제: 셋 다 성취 S').toBe('S');
    expect(new Set(runs.map(e => e.growthNote)).size).toBe(3);
  });
});
