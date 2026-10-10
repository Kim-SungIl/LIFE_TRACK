// 가장 자주 반복되는 사건 셋의 문장 변이. (T60)
//
// 결함의 모양(실측): balanced 5판에서 판당 총 발동 350건 중 **218건(62%)이 변이 1개짜리
// 27종**이었고, 그중 최다 셋이 fatigue-warning 13.0회 · good-grade 12.4회 ·
// music-discovery 10.4회다. 한 판에서 **같은 문장을 열 번 넘게** 읽는다.
// (반장 잡무 3종은 이미 변이 4개라 같은 문장이 ~2회였다 — 진단이 표적을 빗나갔던 자리다.)
//
// 여기서 잠그는 계약 넷:
//   1. 학교급마다 변이가 MIN_VARIANTS_PER_BAND 이상이다.
//   2. 카탈로그의 문장 = 변이 elementary[0] (폴백이 다른 문장을 내면 안 된다).
//   3. **수치가 안 바뀐다** — 변이는 text·message만 덮는다.
//   4. **실플레이에서 실제로 여러 문장이 나온다** — 데이터만 있고 축이 죽으면(모듈로 퇴화)
//      화면은 그대로 한 문장이다. 그건 순수함수 단언으로 원리상 안 잡힌다.
import { describe, expect, it } from 'vitest';
import { GAME_EVENTS } from '../events';
import { SCHOOL_LIFE_EVENTS } from '../events/school-life';
import { MIN_VARIANTS_PER_BAND, WATCHING_PRESIDENT_VARIANTS } from '../events/president';
import {
  FATIGUE_WARNING_VARIANTS, GOOD_GRADE_VARIANTS, MUSIC_DISCOVERY_VARIANTS,
} from '../events/repeat-variants';
import { createInitialState, getWeekInfo, processWeek } from '../gameEngine';
import { presentEvent } from '../eventPresentation';
import { resolveEventLikeStore } from '../../../scripts/lib/y1-sim-resolve';
import { PERSONAS, pickChoice } from '../../../scripts/sim/sim-qa-playthrough';
import type { GameEvent, GameState, SchoolVariants } from '../types';

const BANDS = ['elementary', 'middle', 'high'] as const;

const TARGETS = [
  { id: 'fatigue-warning', variants: FATIGUE_WARNING_VARIANTS },
  { id: 'good-grade', variants: GOOD_GRADE_VARIANTS },
  { id: 'music-discovery', variants: MUSIC_DISCOVERY_VARIANTS },
  // 넷째: 비반장 관찰. 한 해 4회까지 같은 장면이었고, 결과 문장 "…처음 느꼈다"가 반복에서 어긋났다.
  { id: 'watching-president', variants: WATCHING_PRESIDENT_VARIANTS },
] as const;

/** 카탈로그는 두 풀로 갈린다 — school-life는 GAME_EVENTS에 없다(selection.ts가 따로 뽑는다). */
function catalogEvent(id: string): GameEvent {
  // 두 풀의 원소 타입이 리터럴로 좁혀져 있어 합치면 거대한 유니온이 된다(fatigueEffect가
  // 있는 원소와 없는 원소가 섞인다). 읽기 전용 대조라 GameEvent로 본다.
  const pool = [...GAME_EVENTS, ...SCHOOL_LIFE_EVENTS] as readonly GameEvent[];
  const e = pool.find(x => x.id === id);
  if (!e) throw new Error(`카탈로그에 ${id}가 없다 — 두 풀 모두에서 못 찾았다`);
  return e;
}

describe('반복 사건 문장 변이 — 데이터 계약', () => {
  it('셋 다 카탈로그에 배선돼 있다 (양성 대조 — 이게 없으면 아래가 전부 공허하다)', () => {
    for (const t of TARGETS) {
      const e = catalogEvent(t.id) as { schoolVariants?: SchoolVariants };
      expect(e.schoolVariants, `${t.id}에 schoolVariants가 안 붙었다`).toBe(t.variants);
    }
  });

  it('학교급마다 변이가 최소 개수를 채운다', () => {
    const counts = TARGETS.flatMap(t => BANDS.map(b => [`${t.id}/${b}`, t.variants[b].length] as const));
    for (const [key, n] of counts) {
      expect(n, `${key} 변이 수`).toBeGreaterThanOrEqual(MIN_VARIANTS_PER_BAND);
    }
  });

  it('카탈로그 문장 = 변이 elementary[0] — 폴백이 다른 문장을 내지 않는다', () => {
    for (const t of TARGETS) {
      const e = catalogEvent(t.id);
      const v0 = t.variants.elementary[0];
      expect(e.description, `${t.id} description`).toBe(v0.description);
      expect(e.choices.length, `${t.id} 선택지 수`).toBe(v0.choices.length);
      e.choices.forEach((c, i) => {
        expect(c.text, `${t.id} 선택지 ${i} text`).toBe(v0.choices[i].text);
        expect(c.message, `${t.id} 선택지 ${i} message`).toBe(v0.choices[i].message);
      });
    }
  });

  it('빈 문장이 없다 — 변이 층의 빈 message는 카탈로그만 보는 검사로는 안 잡힌다', () => {
    const empties: string[] = [];
    for (const t of TARGETS) {
      for (const b of BANDS) {
        t.variants[b].forEach((v, i) => {
          if (!v.description.trim()) empties.push(`${t.id}/${b}[${i}].description`);
          v.choices.forEach((c, j) => {
            if (!c.text.trim()) empties.push(`${t.id}/${b}[${i}].choices[${j}].text`);
            if (!c.message.trim()) empties.push(`${t.id}/${b}[${i}].choices[${j}].message`);
          });
        });
      }
    }
    expect(empties, '빈 문장').toEqual([]);
  });

  it('같은 학교급 안에서 문장이 서로 다르다 — 복붙 변이는 변이가 아니다', () => {
    for (const t of TARGETS) {
      for (const b of BANDS) {
        const descs = t.variants[b].map(v => v.description);
        expect(new Set(descs).size, `${t.id}/${b} 서로 다른 description 수`).toBe(descs.length);
      }
    }
  });

  it('선택지 수가 카탈로그와 같다 — 모자라면 overlayChoices가 조용히 원문을 남긴다', () => {
    for (const t of TARGETS) {
      const want = catalogEvent(t.id).choices.length;
      for (const b of BANDS) {
        t.variants[b].forEach((v, i) => {
          expect(v.choices.length, `${t.id}/${b}[${i}] 선택지 수`).toBe(want);
        });
      }
    }
  });
});

describe('반복 사건 문장 변이 — 반복을 모르는 문장', () => {
  // 로테이션은 (절대주차 + 13·학년) % length라 **몇 번째 발동인지 모른다**. "처음"류 문장은
  // 첫 발동에만 참인데, 어느 변이가 첫 발동에 걸릴지 정해져 있지 않으니 변이 어디에도 쓰면 안 된다.
  // (watching-president는 Y1에 4회 뜨면서 "…처음 느꼈다"를 매번 읽혔다.)
  const FIRST_TIME = /처음|난생/;

  it('watching-president — 카탈로그·변이 어디에도 "처음"이 없다', () => {
    const e = catalogEvent('watching-president');
    const texts = [
      e.description, ...e.choices.flatMap(c => [c.text, c.message]),
      ...BANDS.flatMap(b => WATCHING_PRESIDENT_VARIANTS[b].flatMap(v => [
        v.description, ...v.choices.flatMap(c => [c.text, c.message]),
      ])),
    ];
    // 모수 하한 — 변이를 통째로 지우면 검사할 문장이 0이 돼 공허하게 통과한다.
    expect(texts.length, '검사한 문장 수').toBeGreaterThanOrEqual(1 + 4 + BANDS.length * MIN_VARIANTS_PER_BAND * 5);
    expect(texts.filter(t => FIRST_TIME.test(t)), '"처음"이 남은 문장').toEqual([]);
  });

  it('양성 대조 — 탐지식이 고치기 전 문장을 실제로 잡는다', () => {
    expect(FIRST_TIME.test('민재도 버거운 거구나. 전교 1등이 쉬운 게 아니라는 걸 처음 느꼈다.')).toBe(true);
  });

  it('Y1 학기 주에 네 변이가 모두 돈다 — 데이터만 넷이고 축이 죽으면 화면은 한 장면이다', () => {
    const seen = new Set<string>();
    for (let week = 7; week <= 42; week++) {
      if (getWeekInfo(week).isVacation) continue;
      seen.add(presentEvent(catalogEvent('watching-president'), { year: 1, week, gender: 'male' }).description);
    }
    expect(seen.size).toBe(WATCHING_PRESIDENT_VARIANTS.elementary.length);
  });
});

describe('반복 사건 문장 변이 — 수치 불변', () => {
  // 변이는 text·message만 덮는다. 이 표가 흔들리면 밸런스가 움직인 것이다.
  const EFFECTS: Record<string, { effects: Record<string, number>; fatigueEffect?: number }[]> = {
    'fatigue-warning': [
      { effects: { academic: 1, mental: -2 }, fatigueEffect: 3 },
      { effects: { mental: 2 }, fatigueEffect: -10 },
    ],
    'good-grade': [
      { effects: { academic: 2, mental: 3 } },
      { effects: { mental: 2, social: 1 } },
    ],
    'music-discovery': [
      { effects: { mental: 2, talent: 1 } },
      { effects: { social: 2, mental: 1 } },
    ],
    'watching-president': [
      { effects: { social: 3, mental: 2 } },
      { effects: { mental: 1 } },
    ],
  };

  it('사건의 효과·피로가 변이 도입 전과 같다', () => {
    for (const t of TARGETS) {
      const e = catalogEvent(t.id);
      const want = EFFECTS[t.id];
      expect(e.choices.length, `${t.id} 선택지 수`).toBe(want.length);
      e.choices.forEach((c, i) => {
        expect(c.effects, `${t.id} 선택지 ${i} effects`).toEqual(want[i].effects);
        expect(c.fatigueEffect, `${t.id} 선택지 ${i} fatigueEffect`).toBe(want[i].fatigueEffect);
      });
    }
  });

  it('변이에는 수치가 아예 없다 — 있으면 두 층이 갈린다', () => {
    for (const t of TARGETS) {
      for (const b of BANDS) {
        for (const v of t.variants[b]) {
          for (const c of v.choices) {
            expect(Object.keys(c).sort().filter(k => !['text', 'message', 'femaleText', 'femaleMessage'].includes(k)),
              `${t.id}/${b} 변이 선택지에 문장 아닌 키`).toEqual([]);
          }
        }
      }
    }
  });
});

describe('반복 사건 문장 변이 — 실플레이 도달', () => {
  // **데이터만 있고 축이 죽으면 화면은 한 문장 그대로다**(`% length`가 나눠떨어지면 축이 없다).
  // 순수함수 단언으로는 원리상 안 잡히므로 7년을 실제로 돌려 화면에 나간 문장을 센다.
  function playAndCollect(seed: number): Record<string, Set<string>> {
    const persona = PERSONAS.find(p => p.name === 'balanced') ?? PERSONAS[0];
    const seen: Record<string, Set<string>> = {};
    let s: GameState = createInitialState('male', persona.parents, { rngSeed: seed });
    for (let w = 0; w < 420; w++) {
      s.weekendChoices = persona.weekend;
      s.vacationChoices = persona.vacation;
      s = processWeek(s);
      let guard = 0;
      while (s.currentEvent && guard++ < 20) {
        const ev = s.currentEvent;
        if (TARGETS.some(t => t.id === ev.id)) (seen[ev.id] ??= new Set()).add(ev.description);
        const choices = s.gender === 'female' && ev.femaleChoices ? ev.femaleChoices : ev.choices;
        s = resolveEventLikeStore(s, pickChoice(choices, persona.policy));
      }
      if (s.phase === 'year-end') {
        s.week = 1; s.year++; s.currentEvent = null; s.phase = 'weekday';
        const next = getWeekInfo(s.week);
        s.semester = next.semester;
        s.isVacation = next.isVacation;
      }
      if (s.phase === 'ending') break;
    }
    return seen;
  }

  it('한 판에서 셋 다 여러 문장이 실제로 화면에 나간다', () => {
    const a = playAndCollect(1);
    const b = playAndCollect(2);
    const merged: Record<string, number> = {};
    // watching-president는 이 하네스(balanced, 루틴 미설정)에서 조건(인기 35+)에 안 닿아 0이다 —
    // 축 생존은 위 'Y1 학기 주에 네 변이가 모두 돈다'가 같은 presentEvent 경로로 잡는다.
    for (const t of TARGETS.filter(t => t.id !== 'watching-president')) {
      merged[t.id] = new Set([...(a[t.id] ?? []), ...(b[t.id] ?? [])]).size;
    }
    // 착지값을 먼저 못 박는다 — "1보다 크다"만 두면 축이 반쯤 죽어도 통과한다.
    // good-grade 10 → 6: 방학 주(W24·W48) 발동이 빠졌다(교실 장면 방학 가드).
    // music-discovery 10 → 8: 방학엔 학교 소재 변이가 빠지고(계절 축, 가드만 되돌리면 9) 그 위에
    // good-grade 발동이 줄며 굴림이 밀린 몫이 겹쳤다. 두 판 모두 방학 판본 문장이 실제로 나온다.
    expect(merged, '2판에서 화면에 나간 서로 다른 문장 수').toEqual({
      'fatigue-warning': 8,
      'good-grade': 6,
      'music-discovery': 8,
    });
    // 변이 도입 전에는 셋 다 정확히 1이었다.
    for (const [id, n] of Object.entries(merged)) {
      expect(n, `${id}는 변이 전 1종이었다`).toBeGreaterThan(MIN_VARIANTS_PER_BAND);
    }
  });
});
