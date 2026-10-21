// 이벤트 문장의 달력 단어가 그 주차의 달(월 블록)과 맞는가.
//
// 2026-10-22: 월 블록(4주 × 12)을 도입하며 대조해 보니 옛 표에서도 넷이 갈려 있었다 —
// W29 "2학기가 시작되고 9월"·W32 "9월 모의고사"(라벨 10월), W43 "크리스마스가 다가오고"(1월),
// W47 "12월 31일 밤"(2월). 게임 달력이 2학기를 18주에 압축해서 생긴 어긋남이라 문장을 고쳤고,
// 누가 다시 "12월"을 2월 주차 사건에 쓰면 여기서 빨개진다.
//
// **고정 주차(`week`)가 있는 사건만 본다.** 시점이 조건으로만 정해지는 사건은 달이 하나로 정해지지 않는다.
// 미래·회상을 말하는 문장("결과는 12월에 나온다")은 예외 표에 이유와 함께 적는다 — 예외가 더 이상
// 문장에 없으면 그 칸도 지우게 한다(낡은 예외가 새 위반을 가리지 않게).
import { describe, expect, it } from 'vitest';
import { GAME_EVENTS } from '../events';
import { getMonthBlock } from '../weekMath';
import type { GameEvent } from '../types';

/** 달력 단어 → 그 단어가 현재 시점으로 쓰여도 되는 달. */
const RULES: { word: RegExp; months: (label: string) => boolean; name: string }[] = [
  { name: 'N월', word: /(\d{1,2})월/g, months: () => true }, // 아래에서 숫자와 라벨을 직접 비교한다
  { name: '크리스마스', word: /크리스마스|캐롤|성탄/g, months: l => l === '12월' },
  { name: '새해', word: /새해|설날/g, months: l => l === '1월' || l === '2월' },
  { name: '벚꽃', word: /벚꽃/g, months: l => l === '3월' || l === '4월' },
  { name: '졸업식', word: /졸업식/g, months: l => l === '2월' },
  { name: '입학식', word: /입학식/g, months: l => l === '3월' },
];

/** 현재 시점이 아니라 미래·회상을 말하는 문장. [사건 id, 규칙 이름, 이유] */
const EXCEPTIONS: [string, string, string][] = [
  ['suneung-done', 'N월', '"결과는 12월에 나온다" — 미래'],
  ['suneung-done', '벚꽃', '"벚꽃이 질 때 시작해서, 낙엽이 질 때 끝났다" — 1년 회상'],
  ['elementary-unit-test-2', '졸업식', '"시험보다는 졸업식이 더 기대된다" — 미래'],
];

function texts(e: GameEvent): string[] {
  const out = [e.title, e.description, e.femaleDescription ?? ''];
  for (const c of [...(e.choices ?? []), ...(e.femaleChoices ?? [])]) out.push(c.text, c.message ?? '');
  return out.filter(Boolean);
}

interface Hit { id: string; week: number; label: string; rule: string; word: string }

/** 위반 목록. 순수함수라 아래 자기검사가 합성 사건으로 같은 함수를 부른다. */
function findViolations(events: readonly GameEvent[]): { violations: Hit[]; checked: Hit[] } {
  const violations: Hit[] = [];
  const checked: Hit[] = [];
  for (const e of events) {
    if (typeof e.week !== 'number') continue;
    const label = getMonthBlock(e.week).label;
    for (const t of texts(e)) {
      for (const r of RULES) {
        for (const m of t.matchAll(r.word)) {
          const hit = { id: e.id, week: e.week, label, rule: r.name, word: m[0] };
          checked.push(hit);
          const ok = r.name === 'N월' ? `${Number(m[1])}월` === label : r.months(label);
          if (!ok && !EXCEPTIONS.some(([id, rule]) => id === e.id && rule === r.name)) violations.push(hit);
        }
      }
    }
  }
  return { violations, checked };
}

describe('이벤트 문장의 달력 단어 ↔ 그 주차의 달', () => {
  it('위반 0건', () => {
    const { violations } = findViolations(GAME_EVENTS);
    expect(violations.map(v => `W${v.week}(${v.label}) ${v.id}: "${v.word}"`)).toEqual([]);
  });

  it('검사 모수가 비어 있지 않다 — 규칙마다 실제로 걸리는 문장이 있다', () => {
    const { checked } = findViolations(GAME_EVENTS);
    const byRule = new Set(checked.map(h => h.rule));
    // 졸업식·입학식·벚꽃·새해는 현재 콘텐츠에 실재한다. 'N월'은 예외(미래 문장)로만 남고, 크리스마스는 0건이 정상이다.
    for (const rule of ['N월', '새해', '벚꽃', '졸업식', '입학식']) expect(byRule.has(rule), rule).toBe(true);
    expect(checked.length).toBeGreaterThan(10);
  });

  it('예외 표가 낡지 않았다 — 예외마다 그 문장이 아직 있다', () => {
    const { checked } = findViolations(GAME_EVENTS);
    for (const [id, rule, why] of EXCEPTIONS) {
      expect(checked.some(h => h.id === id && h.rule === rule), `${id}/${rule} (${why})`).toBe(true);
    }
  });

  it('자기검사 — 옛 네 문장을 합성 사건으로 넣으면 넷 다 잡는다', () => {
    const fake = (id: string, week: number, description: string): GameEvent =>
      ({ id, title: '', description, week, choices: [] }) as unknown as GameEvent;
    const { violations } = findViolations([
      fake('t-subin', 29, '2학기가 시작되고 9월이다.'),
      fake('t-mock', 32, '9월 모의고사가 다가온다.'),
      fake('t-winter', 43, '크리스마스가 다가오고, 거리에 캐롤이 흘러나온다.'),
      fake('t-yearend', 47, '12월 31일 밤.'),
      fake('t-ok', 38, '크리스마스가 다가온다.'), // 12월 블록 — 맞는 문장은 안 잡는다(음성 대조)
    ]);
    expect(violations.map(v => v.id).sort()).toEqual(['t-mock', 't-subin', 't-winter', 't-winter', 't-yearend']);
  });
});
