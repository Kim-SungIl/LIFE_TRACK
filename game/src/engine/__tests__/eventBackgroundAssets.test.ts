// 이벤트 배경 키는 실제 파일로 해석돼야 한다 — 없는 키는 오류 없이 대체 순서로 흘러가
// 그림 없는 그라데이션(수빈 첫 만남 'cafe')이나 계절 안 맞는 그림('park' → park_spring)이 된다.
// 2026-11-17 인게임 검증에서 둘 다 실제로 보였다. scripts/tools/check-background-assets.ts는 CI 게이트가 아니라
// 여기서 잠근다.
import { describe, expect, it } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { GAME_EVENTS } from '../events';
import { getBgSeason, getEventBackground } from '../backgrounds';
import { ROMANCE_OUTING_IDS, ROMANCE_OUTING2_IDS } from '../romance';

const BG_DIR = resolve(process.cwd(), 'public/images/backgrounds');
const LEVELS = ['elementary', 'middle', 'high'] as const;
const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;

/** 그림이 아직 없는 키 — 발주 대기. 그림이 들어오면 이 목록에서 빼야 테스트가 통과한다(아래 단언). */
const PENDING: Record<string, string> = {};

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
/** 자리표시자({school}·{season})를 펼친 모든 파일 이름. */
const files = (key: string): string[] => {
  let out = [key];
  if (key.includes('{school}')) out = out.flatMap(k => LEVELS.map(l => k.replace('{school}', l)));
  if (key.includes('{season}')) out = out.flatMap(k => SEASONS.map(x => k.replace('{season}', x)));
  return out;
};

describe('이벤트 배경 자산', () => {
  const keys = backgroundKeys();

  it('모은 키가 충분하다(수집기가 비면 이 파일 전체가 공허해진다)', () => {
    expect(keys.size).toBeGreaterThan(40);
    expect(keys.has('cafe_study'), '양성 대조: 알려진 키').toBe(true);
    expect(keys.has('park_{season}'), '양성 대조: 계절 키').toBe(true);
    expect(files('park_{season}')).toEqual(['park_spring', 'park_summer', 'park_autumn', 'park_winter']);
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

// 2026-11-17 인게임 검증: 1월 겨울방학 지훈 만남에 벚꽃(park_spring)이 피었다.
describe('공원 계절 배경', () => {
  it('주차 → 계절 경계(3월 시작, 한 달 4주)', () => {
    const at = (w: number) => getBgSeason(w);
    expect([at(1), at(12), at(13), at(24), at(25), at(36), at(37), at(48)])
      .toEqual(['spring', 'spring', 'summer', 'summer', 'autumn', 'autumn', 'winter', 'winter']);
    // 학년 전환 대기(W49)·손상값은 throw하지 않고 끝으로 접는다
    expect([at(49), at(0), at(NaN)]).toEqual(['winter', 'spring', 'spring']);
  });

  it('지훈 만남 두 장면은 계절 키, 수빈 두 번째 만남은 강변 언덕', () => {
    const bg = (id: string) => GAME_EVENTS.find(e => e.id === id)?.background;
    expect(bg(ROMANCE_OUTING_IDS.jihun)).toBe('park_{season}');
    expect(bg(ROMANCE_OUTING2_IDS.jihun)).toBe('park_{season}');
    expect(bg(ROMANCE_OUTING2_IDS.subin)).toBe('riverside_hill');
  });

  it('겨울방학(W45) 만남은 겨울 공원, 여름방학(W22)은 여름 공원으로 해석된다', () => {
    expect(getEventBackground('park_{season}', 6, 45)).toBe('/images/backgrounds/park_winter.png');
    expect(getEventBackground('park_{season}', 6, 22)).toBe('/images/backgrounds/park_summer.png');
    expect(getEventBackground('park_{season}', 6, 30)).toBe('/images/backgrounds/park_autumn.png');
    // {school}만 있는 키는 그대로
    expect(getEventBackground('classroom_{school}_afternoon', 6, 45)).toBe('/images/backgrounds/classroom_high_afternoon.png');
  });
});
