import { describe, expect, it } from 'vitest';
import { josa } from '../korean';

describe('josa', () => {
  it('picks the no-batchim form for open syllables', () => {
    expect(josa('학교', '은/는')).toBe('학교는');
    expect(josa('학교', '이/가')).toBe('학교가');
    expect(josa('학교', '을/를')).toBe('학교를');
    expect(josa('하나', '와/과')).toBe('하나와');
    expect(josa('민수', '아/야')).toBe('민수야');
    expect(josa('학교', '으로/로')).toBe('학교로');
  });

  it('picks the batchim form for closed syllables (non-rieul)', () => {
    expect(josa('책', '은/는')).toBe('책은');
    expect(josa('책', '이/가')).toBe('책이');
    expect(josa('책', '을/를')).toBe('책을');
    expect(josa('지훈', '와/과')).toBe('지훈과');
    expect(josa('산', '으로/로')).toBe('산으로');
  });

  it('treats rieul (ㄹ) batchim like other for most pairs, but 로 for 으로/로', () => {
    expect(josa('길', '은/는')).toBe('길은');
    expect(josa('길', '이/가')).toBe('길이');
    expect(josa('길', '을/를')).toBe('길을');
    expect(josa('서울', '와/과')).toBe('서울과');
    expect(josa('길', '으로/로')).toBe('길로');
  });

  it('uses Korean digit pronunciation finality on trailing digits', () => {
    // 2 → '이' (none), 1 → '일' (rieul), 3 → '삼' (other)
    expect(josa('중2', '이/가')).toBe('중2가');
    expect(josa('반1', '으로/로')).toBe('반1로');
    expect(josa('팀3', '이/가')).toBe('팀3이');
  });
});
