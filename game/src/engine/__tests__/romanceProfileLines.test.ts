// 친구 상세 창의 연인 줄(romanceProfileLines) — 관계 값·이벤트 기록에서만 파생하고, 숫자를 내지 않는다.
import { describe, expect, it } from 'vitest';
import { romanceProfileLines, ROMANCE_OUTING2_IDS, ROMANCE_OUTING_IDS } from '../romance';
import type { RomanceContext, RomanceRelationship } from '../romance';
import type { GameEvent } from '../types';

const rel = (patch: Partial<RomanceRelationship> = {}): RomanceRelationship =>
  ({ npcId: 'jihun', status: 'dating', year: 6, week: 26, ...patch });
const ev = (id: string, title: string, resolvedChoice?: number): GameEvent =>
  ({ id, title, description: '', choices: [], year: 6, week: 30, resolvedChoice } as GameEvent);
const ctx = (patch: Partial<RomanceContext> = {}): RomanceContext =>
  ({ gender: 'female', year: 7, week: 20, relationship: rel(), events: [], ...patch });

describe('romanceProfileLines', () => {
  it.each([[1, '고2 3월부터'], [26, '고2 9월부터'], [48, '고2 2월부터']])('시작 주 %i → %s', (week, head) => {
    expect(romanceProfileLines(ctx({ relationship: rel({ week }) }), 'jihun')[0]).toBe(`${head} 만나는 중`);
  });

  it('고3에 시작한 관계는 고3으로', () => {
    expect(romanceProfileLines(ctx({ relationship: rel({ year: 7, week: 2 }) }), 'jihun')).toEqual(['고3 3월부터 만나는 중']);
  });

  it('최근 만남은 두 번째가 있으면 두 번째, 없으면 첫 번째 — 미해결 기록은 세지 않는다', () => {
    const first = ev(ROMANCE_OUTING_IDS.jihun, '기록을 재지 않는 산책', 0);
    const second = ev(ROMANCE_OUTING2_IDS.jihun, '받기 좋은 공', 1);
    expect(romanceProfileLines(ctx({ events: [first] }), 'jihun')[1]).toBe('최근 만남 「기록을 재지 않는 산책」');
    expect(romanceProfileLines(ctx({ events: [first, second] }), 'jihun')[1]).toBe('최근 만남 「받기 좋은 공」');
    expect(romanceProfileLines(ctx({ events: [second, first] }), 'jihun')[1], '기록 순서와 무관').toBe('최근 만남 「받기 좋은 공」');
    expect(romanceProfileLines(ctx({ events: [first, ev(ROMANCE_OUTING2_IDS.jihun, '받기 좋은 공')] }), 'jihun')[1])
      .toBe('최근 만남 「기록을 재지 않는 산책」');
    expect(romanceProfileLines(ctx({ events: [ev(ROMANCE_OUTING_IDS.subin, '단어장을 덮은 뒤', 0)] }), 'jihun'), '다른 사람의 만남')
      .toEqual(['고2 9월부터 만나는 중']);
  });

  it('졸업에 계속 만나기로 했으면 그 줄이 붙는다', () => {
    expect(romanceProfileLines(ctx({ year: 7, week: 47, relationship: rel({ graduation: 'together' }) }), 'jihun'))
      .toEqual(['고2 9월부터 만나는 중', '졸업 뒤에도 계속 만나기로 했다']);
  });

  it('연인이 아니면 빈 배열 — 헤어짐·관계 없음·다른 사람·성별 손상·시작 전', () => {
    expect(romanceProfileLines(ctx({ relationship: rel({ status: 'ended', graduation: 'apart' }) }), 'jihun')).toEqual([]);
    expect(romanceProfileLines(ctx({ relationship: undefined }), 'jihun')).toEqual([]);
    expect(romanceProfileLines(ctx(), 'subin')).toEqual([]);
    expect(romanceProfileLines(ctx({ gender: 'male' }), 'jihun')).toEqual([]);
    expect(romanceProfileLines(ctx({ year: 5 }), 'jihun')).toEqual([]);
  });

  it('숫자를 내지 않는다(학년·달 이름 제외)', () => {
    const all = romanceProfileLines(ctx({ relationship: rel({ graduation: 'together' }),
      events: [ev(ROMANCE_OUTING2_IDS.jihun, '받기 좋은 공', 0)] }), 'jihun').join(' ');
    expect(all.replace(/고\d|\d+월/g, '')).not.toMatch(/\d/);
  });
});
