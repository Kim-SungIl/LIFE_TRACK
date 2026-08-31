// @vitest-environment jsdom
// 학년말 카드가 스냅샷이 아니라 그 해 궤적으로 등급을 그리는지 — 소비 지점 잠금.
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { YearEndScreen } from '../YearEndScreen';
import { HAPPINESS_LABELS } from '../../../engine/ending';
import { getBackground } from '../../../engine/backgrounds';
import type { Stats } from '../../../engine/types';

vi.mock('../../../engine/assetWebp', () => ({
  webpSrc: (p: string) => p,
}));

const S_STATS: Stats = { academic: 70, talent: 40, mental: 89, social: 89, health: 78 };

function renderYearEnd(opts: {
  year?: number;
  stats?: Stats;
  lowMentalWeeksByYear?: number[];
  veryLowMentalWeeksByYear?: number[];
  burnoutCountByYear?: number[];
}) {
  return render(
    <YearEndScreen
      year={opts.year ?? 3}
      gender="male"
      memorySlots={[]}
      milestoneScenes={[]}
      stats={opts.stats ?? S_STATS}
      lowMentalWeeksByYear={opts.lowMentalWeeksByYear}
      veryLowMentalWeeksByYear={opts.veryLowMentalWeeksByYear}
      burnoutCountByYear={opts.burnoutCountByYear}
      bgProps={{ bg: getBackground(48, false, 'normal', opts.year ?? 3), bgImgError: true, onImgError: () => {} }}
      onAdvance={() => {}}
    />,
  );
}

describe('YearEndScreen — 그 해 궤적이 라벨을 바꾼다', () => {
  it('같은 S 스냅샷이라도 그 해 저멘탈 20주면 D 라벨이 보인다', () => {
    renderYearEnd({
      year: 3,
      lowMentalWeeksByYear: [0, 0, 20, 0, 0, 0, 0],
      veryLowMentalWeeksByYear: [0, 0, 0, 0, 0, 0, 0],
      burnoutCountByYear: [0, 0, 0, 0, 0, 0, 0],
    });
    expect(screen.getByText(HAPPINESS_LABELS.D.title)).toBeTruthy();
    expect(screen.getByText(HAPPINESS_LABELS.D.desc)).toBeTruthy();
    expect(screen.queryByText(HAPPINESS_LABELS.S.title)).toBeNull();
  });

  it('같은 S 스냅샷 + 깨끗한 그 해는 S 라벨이 보인다', () => {
    renderYearEnd({
      year: 3,
      lowMentalWeeksByYear: [0, 0, 0, 0, 0, 0, 0],
      veryLowMentalWeeksByYear: [0, 0, 0, 0, 0, 0, 0],
      burnoutCountByYear: [0, 0, 0, 0, 0, 0, 0],
    });
    expect(screen.getByText(HAPPINESS_LABELS.S.title)).toBeTruthy();
    expect(screen.getByText(HAPPINESS_LABELS.S.desc)).toBeTruthy();
    expect(screen.queryByText(HAPPINESS_LABELS.D.title)).toBeNull();
  });

  it('Y3만 갈아넣기면 Y1 카드는 S, Y3 카드는 D (창이 그 해다)', () => {
    const arrays = {
      lowMentalWeeksByYear: [0, 0, 20, 0, 0, 0, 0],
      veryLowMentalWeeksByYear: [0, 0, 4, 0, 0, 0, 0],
      burnoutCountByYear: [0, 0, 2, 0, 0, 0, 0],
    };
    const y1 = renderYearEnd({ year: 1, ...arrays });
    expect(y1.getByText(HAPPINESS_LABELS.S.title)).toBeTruthy();
    y1.unmount();

    const y3 = renderYearEnd({ year: 3, ...arrays });
    expect(y3.getByText(HAPPINESS_LABELS.D.title)).toBeTruthy();
    // 양성 바닥: 그늘/힘듦 라벨이 화면에 1개 있다.
    expect(y3.getAllByText(/한 해$/).length).toBeGreaterThanOrEqual(1);
  });

  it('19저멘탈주는 C, 20주면 D (학년말 창 양방향)', () => {
    const at19 = renderYearEnd({
      year: 1,
      lowMentalWeeksByYear: [19, 0, 0, 0, 0, 0, 0],
    });
    expect(at19.getByText(HAPPINESS_LABELS.C.title)).toBeTruthy();
    at19.unmount();

    const at20 = renderYearEnd({
      year: 1,
      lowMentalWeeksByYear: [20, 0, 0, 0, 0, 0, 0],
    });
    expect(at20.getByText(HAPPINESS_LABELS.D.title)).toBeTruthy();
  });
});

describe('GameScreen — 학년말·기록장 둘 다 궤적 배열을 넘긴다', () => {
  it('두 소비 지점이 state 배열을 그대로 넘긴다 (소스 잠금)', () => {
    const src = readFileSync(resolve(__dirname, '../../GameScreen.tsx'), 'utf8');
    const low = src.match(/lowMentalWeeksByYear=\{state\.lowMentalWeeksByYear\}/g) ?? [];
    const very = src.match(/veryLowMentalWeeksByYear=\{state\.veryLowMentalWeeksByYear\}/g) ?? [];
    const burn = src.match(/burnoutCountByYear=\{state\.burnoutCountByYear\}/g) ?? [];
    // 기록장 오버레이 + phase==='year-end' 본화면. 둘 중 하나만 있으면 한쪽이 스냅샷으로 남는다.
    expect(low).toHaveLength(2);
    expect(very).toHaveLength(2);
    expect(burn).toHaveLength(2);
  });
});
