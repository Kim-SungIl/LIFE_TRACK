// 이벤트 배경 키는 실제 파일로 해석돼야 한다 — 없는 키는 오류 없이 대체 순서로 흘러가
// 그림 없는 그라데이션(수빈 첫 만남 'cafe')이나 계절 안 맞는 그림('park' → park_spring)이 된다.
// 2026-11-17 인게임 검증에서 둘 다 실제로 보였다. scripts/tools/check-background-assets.ts는 CI 게이트가 아니라
// 여기서 잠근다.
import { describe, expect, it } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { GAME_EVENTS } from '../events';

const BG_DIR = resolve(process.cwd(), 'public/images/backgrounds');
const LEVELS = ['elementary', 'middle', 'high'] as const;

/** 그림이 아직 없는 키 — 발주 대기. 그림이 들어오면 이 목록에서 빼야 테스트가 통과한다(아래 단언). */
const PENDING: Record<string, string> = {
  park: '공원 계절 4장 발주 대기 — 지금은 늘 park_spring(벚꽃)으로 대체돼 겨울 만남에도 벚꽃이 핀다',
};

/** 이벤트 객체 안 어디에 있든 background 문자열을 모은다(변이·후속 안쪽 포함). */
function backgroundKeys(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const seen = new Set<unknown>();
  const walk = (v: unknown, owner: string) => {
    if (!v || typeof v !== 'object' || seen.has(v)) return;
    seen.add(v);
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (k === 'background' && typeof x === 'string') out.set(x, [...(out.get(x) ?? []), owner]);
      else walk(x, owner);
    }
  };
  for (const e of GAME_EVENTS) walk(e, e.id);
  return out;
}
const files = (key: string) => key.includes('{school}') ? LEVELS.map(l => key.replace('{school}', l)) : [key];

describe('이벤트 배경 자산', () => {
  const keys = backgroundKeys();

  it('모은 키가 충분하다(수집기가 비면 이 파일 전체가 공허해진다)', () => {
    expect(keys.size).toBeGreaterThan(40);
    expect(keys.has('cafe_study'), '양성 대조: 알려진 키').toBe(true);
  });

  it('대기 목록 밖의 모든 키가 파일로 있다', () => {
    const missing = [...keys].filter(([k]) => !(k in PENDING))
      .flatMap(([k, owners]) => files(k).filter(f => !existsSync(`${BG_DIR}/${f}.png`)).map(f => `${f}.png ← ${owners.join(', ')}`));
    expect(missing).toEqual([]);
  });

  it('대기 목록은 실제로 쓰이고 아직 없는 키만 — 그림이 오면 목록에서 뺄 것', () => {
    for (const k of Object.keys(PENDING)) {
      expect(keys.has(k), `${k}: 쓰는 이벤트가 없다`).toBe(true);
      expect(files(k).some(f => !existsSync(`${BG_DIR}/${f}.png`)), `${k}: 그림이 들어왔다 — PENDING에서 빼라`).toBe(true);
    }
  });
});
