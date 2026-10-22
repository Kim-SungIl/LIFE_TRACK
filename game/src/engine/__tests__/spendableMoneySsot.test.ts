// 쓸 수 있는 돈 SSOT — "새로 돈을 쓸 수 있는가"는 spendableMoney.ts만 읽는다.
//
// 월 단위 계획에서 주말 활동비를 봉투처럼 예약하면 잔액(state.money)과 쓸 수 있는 돈이 갈린다.
// 그때 한 화면이라도 잔액을 직접 읽으면 그 화면만 예약금을 써 버린다(#441 — 두 근거가 갈리면 라벨이
// 거짓말한다). 그래서 잔액을 **직접 비교하는** 자리를 허용 목록으로 묶고, 새로 생기면 빨개지게 한다.
//
// 허용 목록에 남는 자리는 "실제로 돈을 빼는 순간"의 판정뿐이다 — 그때는 예약된 그 돈을 쓰는 것이라
// 실제 잔액이 맞다. 0 하한 클램프(`< 0`)는 비교가 아니라 보정이라 세지 않는다.
//
// 정규식 소스 검사는 서식에 기대는 약한 잠금이다. 그래서 짝으로 **행위** 대조를 둔다(spendableMoneyWiring.test.ts) —
// getSpendableMoney가 잔액보다 적게 말하면 이벤트 선택지·상점·확정 잠금이 실제로 그 값을 따르는지.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../gameEngine';
import { canSpend, getSpendableMoney } from '../spendableMoney';

const SRC = new URL('../../', import.meta.url).pathname; // game/src/

/** 잔액을 직접 비교하는 표현 — `s.money >= 3`, `state.money < cost`, `x > state.money` 등. `< 0` 클램프는 뺀다. */
const DIRECT = /\b(?:s|st|state|newState|next|curr)\??\.money\s*(?:<=|>=|<(?!\s*0\b)|>)|(?:<=|>=|<|>)\s*(?:s|st|state|newState|next|curr)\??\.money\b/g;

/** [파일(src 기준), 허용 개수, 이유] */
const ALLOWED: [string, number, string][] = [
  ['engine/gameEngine.ts', 3, '루틴 2칸·주말 활동을 실제로 실행하며 그 주 비용을 뺄 때 — 예약된 돈을 쓰는 순간이라 실제 잔액'],
  ['engine/activities.ts', 10, '활동의 requires(자기 비용) — 계획 목록뿐 아니라 엔진 실행(canApplyActivity)에서도 평가된다. ' +
    '쓸 수 있는 돈으로 바꾸면 예약이 생긴 뒤 자기 몫의 예약 때문에 자기 실행이 막힌다'],
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

function directSites(): Map<string, string[]> {
  const sites = new Map<string, string[]>();
  for (const file of walk(SRC)) {
    const rel = relative(SRC, file);
    const text = readFileSync(file, 'utf8');
    const hits = text.split('\n').flatMap((line, i) => (line.match(DIRECT) ? [`${i + 1}: ${line.trim()}`] : []));
    if (hits.length) sites.set(rel, hits);
  }
  return sites;
}

describe('잔액 직접 비교는 허용 목록에만', () => {
  it('허용 목록 밖에서 state.money를 직접 비교하는 곳이 없다', () => {
    const extra: string[] = [];
    for (const [file, hits] of directSites()) {
      if (!ALLOWED.some(([f]) => f === file)) extra.push(...hits.map(h => `${file}:${h}`));
    }
    expect(extra, '새로 돈을 쓸 수 있는지는 spendableMoney.canSpend/getSpendableMoney로 물을 것').toEqual([]);
  });

  it('허용된 파일의 개수가 정확하다 — 늘면 새 자리, 줄면 목록이 낡았다', () => {
    const sites = directSites();
    for (const [file, n, why] of ALLOWED) {
      expect(sites.get(file)?.length ?? 0, `${file} (${why})`).toBe(n);
    }
  });

  it('자기검사 — 정규식이 실제로 잡는 모양과 안 잡는 모양', () => {
    const hit = (s: string) => (s.match(DIRECT) ?? []).length > 0;
    expect(hit('if (state.money < cost) return')).toBe(true);
    expect(hit('requires: (s) => s.money >= 2')).toBe(true);
    expect(hit('const over = total > state.money')).toBe(true);
    expect(hit('if (state.money < 0) state.money = 0;')).toBe(false); // 클램프
    expect(hit('canSpend(state, cost)')).toBe(false);
    expect(hit('applied.money > 0')).toBe(false); // 상태가 아닌 효과 델타
  });
});

describe('getSpendableMoney / canSpend', () => {
  it('예약이 없는 지금은 잔액과 같다', () => {
    const s = createInitialState('male', ['wealth', 'info'], { rngSeed: 3 });
    s.money = 7;
    expect(getSpendableMoney(s)).toBe(7);
    expect(canSpend(s, 7)).toBe(true);
    expect(canSpend(s, 7.1)).toBe(false);
    expect(canSpend(s, 0)).toBe(true);
    expect(canSpend({ money: 0 }, -3)).toBe(true); // 수입은 항상 가능
  });
});
