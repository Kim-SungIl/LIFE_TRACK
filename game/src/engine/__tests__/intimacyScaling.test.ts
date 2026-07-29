import { describe, expect, it } from 'vitest';
import {
  INTIMACY_GRIND_SOFTCAP,
  applyGrindIntimacyGain,
  scaleIntimacyChange,
} from '../intimacyScaling';

// intimacyScaling.ts 밴드·면제 임계를 테스트에 고정한 계약 상수.
// (소스 주석/문자열을 파싱하지 않음 — 값이 바뀌면 이 상수와 케이스를 함께 갱신)
const BAND_FRIEND = 40; // <40 → 1.0, >=40 → 0.8
const BAND_CLOSE = 60; // <60 → 0.8, >=60 → 0.6
const BAND_PLATEAU = 80; // <80 → 0.6, >=80 → 0.25
const EXEMPT_MAJOR_DELTA = 8; // exemptMajorReward && delta>=8 → 감쇠 면제

describe('scaleIntimacyChange', () => {
  it('returns non-positive delta unchanged', () => {
    expect(scaleIntimacyChange(0, 50)).toBe(0);
    expect(scaleIntimacyChange(-3, 90)).toBe(-3);
    expect(scaleIntimacyChange(-1, 0)).toBe(-1);
  });

  it('skips attenuation for exempt major rewards (delta >= EXEMPT_MAJOR_DELTA)', () => {
    // 이벤트 보상 통로: 높은 친밀도에서도 감쇠 없이 그대로
    expect(scaleIntimacyChange(EXEMPT_MAJOR_DELTA, 95, true)).toBe(EXEMPT_MAJOR_DELTA);
    expect(scaleIntimacyChange(12, BAND_PLATEAU, true)).toBe(12);
    // 면제 끄면 동일 delta도 감쇠
    expect(scaleIntimacyChange(EXEMPT_MAJOR_DELTA, BAND_PLATEAU, false)).toBe(
      Math.max(1, Math.floor(EXEMPT_MAJOR_DELTA * 0.25)),
    );
    // 면제 on이어도 임계 미만은 감쇠
    expect(scaleIntimacyChange(EXEMPT_MAJOR_DELTA - 1, BAND_PLATEAU, true)).toBe(
      Math.max(1, Math.floor((EXEMPT_MAJOR_DELTA - 1) * 0.25)),
    );
  });

  it('switches multipliers at band boundaries 39/40, 59/60, 79/80', () => {
    // delta < EXEMPT_MAJOR_DELTA 로 면제 통로를 피하고 감쇠만 본다
    const delta = 5;
    // 0~39: 1.0
    expect(scaleIntimacyChange(delta, BAND_FRIEND - 1)).toBe(Math.floor(delta * 1.0));
    // 40~59: 0.8
    expect(scaleIntimacyChange(delta, BAND_FRIEND)).toBe(Math.floor(delta * 0.8));
    expect(scaleIntimacyChange(delta, BAND_CLOSE - 1)).toBe(Math.floor(delta * 0.8));
    // 60~79: 0.6
    expect(scaleIntimacyChange(delta, BAND_CLOSE)).toBe(Math.floor(delta * 0.6));
    expect(scaleIntimacyChange(delta, BAND_PLATEAU - 1)).toBe(Math.floor(delta * 0.6));
    // 80+: 0.25
    expect(scaleIntimacyChange(delta, BAND_PLATEAU)).toBe(Math.floor(delta * 0.25));
    expect(scaleIntimacyChange(delta, 100)).toBe(Math.floor(delta * 0.25));
  });

  it('floors at Math.max(1, ...) so tiny positive gains never vanish', () => {
    // plateau 0.25 × 작은 delta → floor 0이지만 최소 1
    expect(scaleIntimacyChange(1, BAND_PLATEAU)).toBe(1);
    expect(scaleIntimacyChange(3, BAND_PLATEAU)).toBe(1); // floor(0.75)=0 → 1
    expect(scaleIntimacyChange(1, BAND_CLOSE)).toBe(1); // floor(0.6)=0 → 1
  });
});

describe('INTIMACY_GRIND_SOFTCAP', () => {
  it('is locked at 80', () => {
    expect(INTIMACY_GRIND_SOFTCAP).toBe(80);
  });
});

describe('applyGrindIntimacyGain', () => {
  it('does not push past the softcap when already at or above it', () => {
    expect(applyGrindIntimacyGain(INTIMACY_GRIND_SOFTCAP, 5)).toBe(INTIMACY_GRIND_SOFTCAP);
    expect(applyGrindIntimacyGain(INTIMACY_GRIND_SOFTCAP + 10, 20)).toBe(INTIMACY_GRIND_SOFTCAP + 10);
    expect(applyGrindIntimacyGain(99, 1)).toBe(99);
  });

  it('clamps gains so results never exceed the softcap from below', () => {
    // 79 + scaled(양수) → min(80, ...) — 캡을 넘기지 않음
    expect(applyGrindIntimacyGain(INTIMACY_GRIND_SOFTCAP - 1, 10)).toBe(INTIMACY_GRIND_SOFTCAP);
    expect(applyGrindIntimacyGain(70, 50)).toBeLessThanOrEqual(INTIMACY_GRIND_SOFTCAP);
    // 50은 [40,60) 밴드(×0.8) → 50 + floor(5*0.8)=4 = 54 (softcap 80 미도달)
    expect(applyGrindIntimacyGain(50, 5)).toBe(54);
  });

  it('clamps negative rawDelta into 0~100', () => {
    expect(applyGrindIntimacyGain(5, -10)).toBe(0);
    expect(applyGrindIntimacyGain(50, -3)).toBe(47);
    expect(applyGrindIntimacyGain(100, -1)).toBe(99);
    // 이미 100 초과처럼 보이더라도 음수 경로에서 100으로 클램프
    expect(applyGrindIntimacyGain(105, -1)).toBe(100);
  });

  it('never exceeds softcap under repeated grind from 79 (infinite-grind defense)', () => {
    let intimacy = INTIMACY_GRIND_SOFTCAP - 1;
    for (let i = 0; i < 200; i++) {
      intimacy = applyGrindIntimacyGain(intimacy, 10);
      expect(intimacy).toBeLessThanOrEqual(INTIMACY_GRIND_SOFTCAP);
    }
    expect(intimacy).toBe(INTIMACY_GRIND_SOFTCAP);
  });
});
