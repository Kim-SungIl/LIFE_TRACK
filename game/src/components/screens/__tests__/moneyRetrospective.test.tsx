// @vitest-environment jsdom
// 돈 회고(T25)의 **소비 지점** 계약 — 엔진이 아무리 잘 적립해도 화면이 안 부르면 없는 기능이다.
// (useAudioUnlock 호출 한 줄을 지워도 547개가 전부 초록이던 전례 참조 #397.)
//
// 이 파일이 잠그는 것:
//   ① 학년말 카드가 그 해 궤적으로 줄을 그린다 — **기록장(readonly) 회상에서도** 그린다.
//      "올해의 마음"은 현재 stats 종속이라 readonly에서 숨기지만, 돈은 학년별 배열이라 안 숨긴다.
//   ② 엔딩이 7년 합으로 줄을 그리고, 잔액은 money prop에서 온다(배선을 끊으면 문장이 바뀐다).
//   ③ 구세이브(배열 없음)면 두 화면 모두 줄을 아예 안 그린다.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { YearEndScreen } from '../YearEndScreen';
import { EndingScreen } from '../EndingScreen';
import { calculateEnding } from '../../../engine/ending';
import { moneyYearLine, moneyLifeLine } from '../../../engine/moneyTrajectory';
import { getBackground } from '../../../engine/backgrounds';
import { makeState } from '../../../test/fixtures';

vi.mock('../../../engine/assetWebp', () => ({ webpSrc: (p: string) => p }));
vi.mock('../../../audio/bgm', () => ({ setBgmTrack: vi.fn(), getBgmTrackId: vi.fn(() => 'main') }));
vi.mock('../../../audio/sfx', () => ({ playSfx: vi.fn() }));

// 라벨 문자열을 테스트에 다시 적지 않는다 — SSOT를 그대로 불러 비교해야 문구를 고쳐도 안 깨진다.
const YEAR = (spent: number, tightWeeks: number) => moneyYearLine({ spent, tightWeeks, years: 1 });
const LIFE = (spent: number, tightWeeks: number, money: number) =>
  moneyLifeLine({ spent, tightWeeks, years: 7 }, money);

function renderYearEnd(opts: {
  year?: number;
  moneySpentByYear?: number[];
  moneyTightWeeksByYear?: number[];
  readonly?: boolean;
}) {
  const year = opts.year ?? 3;
  return render(
    <YearEndScreen
      year={year}
      gender="male"
      memorySlots={[]}
      milestoneScenes={[]}
      stats={{ academic: 70, talent: 40, mental: 89, social: 89, health: 78 }}
      moneySpentByYear={opts.moneySpentByYear}
      moneyTightWeeksByYear={opts.moneyTightWeeksByYear}
      bgProps={{ bg: getBackground(48, false, 'normal', year), bgImgError: true, onImgError: () => {} }}
      onAdvance={() => {}}
      readonly={opts.readonly}
      examResults={opts.readonly ? [] : undefined}
      reachedYears={opts.readonly ? [1, 2, 3] : undefined}
      onSelectYear={opts.readonly ? () => {} : undefined}
      onClose={opts.readonly ? () => {} : undefined}
    />,
  );
}

function renderEnding(opts: {
  money: number;
  moneySpentByYear?: number[];
  moneyTightWeeksByYear?: number[];
}) {
  const state = makeState({ year: 7, week: 48 });
  return render(
    <EndingScreen
      ending={calculateEnding(state)}
      track={state.track}
      stats={state.stats}
      parents={state.parents}
      burnoutCount={0}
      money={opts.money}
      moneySpentByYear={opts.moneySpentByYear}
      moneyTightWeeksByYear={opts.moneyTightWeeksByYear}
      bgProps={{ bg: getBackground(48, false, 'normal', 7), bgImgError: true, onImgError: vi.fn() }}
      runDelta={null}
      gender={state.gender}
    />,
  );
}

describe('학년말 카드 — 올해의 돈', () => {
  it('돈에 자주 막힌 해는 접은 횟수를 이름으로 부른다', () => {
    renderYearEnd({ year: 3, moneySpentByYear: [0, 0, 30, 0, 0, 0, 0], moneyTightWeeksByYear: [0, 0, 14, 0, 0, 0, 0] });
    const line = YEAR(30, 14);
    expect(screen.getByText(line.title)).toBeTruthy();
    expect(screen.getByText(line.desc)).toBeTruthy();
    expect(line.desc).toContain('14주');
  });

  it('막힌 적 없이 안 쓴 해는 다른 문장이 나온다 — 두 극단이 같은 줄로 접히면 안 된다', () => {
    renderYearEnd({ year: 3, moneySpentByYear: [0, 0, 0, 0, 0, 0, 0], moneyTightWeeksByYear: [0, 0, 0, 0, 0, 0, 0] });
    expect(screen.getByText(YEAR(0, 0).title)).toBeTruthy();
    expect(screen.queryByText(YEAR(30, 14).title)).toBeNull();
  });

  it('창은 그 해다 — 같은 배열이라도 학년이 다르면 다른 줄이 뜬다', () => {
    const args = { moneySpentByYear: [200, 0, 0, 0, 0, 0, 0], moneyTightWeeksByYear: [0, 0, 20, 0, 0, 0, 0] };
    const a = renderYearEnd({ year: 1, ...args });
    expect(screen.getByText(YEAR(200, 0).title)).toBeTruthy();
    a.unmount();
    renderYearEnd({ year: 3, ...args });
    expect(screen.getByText(YEAR(0, 20).title)).toBeTruthy();
  });

  // 여기가 "올해의 마음"과 갈리는 지점 — 돈은 학년별 배열이라 과거 회상에도 시점 오염이 없다.
  it('기록장(readonly) 회상에서도 그 해의 돈은 그대로 뜬다', () => {
    renderYearEnd({
      year: 3, readonly: true,
      moneySpentByYear: [0, 0, 30, 0, 0, 0, 0], moneyTightWeeksByYear: [0, 0, 14, 0, 0, 0, 0],
    });
    expect(screen.getByText(YEAR(30, 14).title)).toBeTruthy();
  });

  it('구세이브(배열 없음)면 줄을 아예 그리지 않는다', () => {
    renderYearEnd({ year: 3 });
    for (const t of [YEAR(0, 0), YEAR(30, 14), YEAR(200, 0), YEAR(30, 3)]) {
      expect(screen.queryByText(t.title)).toBeNull();
    }
  });
});

describe('엔딩 — 7년의 돈', () => {
  it('쓰지 않은 7년은 남은 잔액을 이름으로 부른다', () => {
    renderEnding({ money: 1569, moneySpentByYear: [0, 0, 0, 0, 0, 0, 0], moneyTightWeeksByYear: [0, 0, 0, 0, 0, 0, 0] });
    const line = LIFE(0, 0, 1569);
    expect(screen.getByText(line.title)).toBeTruthy();
    expect(screen.getByText(line.desc)).toBeTruthy();
    expect(line.desc).toContain('1,569만원');
  });

  // money prop 배선이 끊기면(0으로 읽히면) 같은 자리에 "0만원이 남았다"가 나간다.
  it('잔액은 money prop에서 온다 — 값을 바꾸면 문장이 따라 바뀐다', () => {
    const a = renderEnding({ money: 1569, moneySpentByYear: [0, 0, 0, 0, 0, 0, 0], moneyTightWeeksByYear: [0, 0, 0, 0, 0, 0, 0] });
    expect(screen.getByText(LIFE(0, 0, 1569).desc)).toBeTruthy();
    a.unmount();
    renderEnding({ money: 0, moneySpentByYear: [0, 0, 0, 0, 0, 0, 0], moneyTightWeeksByYear: [0, 0, 0, 0, 0, 0, 0] });
    expect(screen.queryByText(LIFE(0, 0, 1569).desc)).toBeNull();
    expect(screen.getByText(LIFE(0, 0, 0).desc)).toBeTruthy();
  });

  it('7년 내내 접힌 판은 잔액이 아니라 접은 횟수를 말한다', () => {
    renderEnding({
      money: 0,
      moneySpentByYear: [180, 200, 200, 200, 200, 200, 200],
      moneyTightWeeksByYear: [12, 14, 15, 16, 18, 20, 22],
    });
    const line = LIFE(1380, 117, 0);
    expect(screen.getByText(line.title)).toBeTruthy();
    expect(line.desc).toContain('117주');
  });

  it('구세이브(배열 없음)면 엔딩에도 줄이 없다', () => {
    renderEnding({ money: 1569 });
    for (const t of [LIFE(0, 0, 1569), LIFE(1380, 117, 0), LIFE(1400, 0, 1569), LIFE(1400, 20, 0)]) {
      expect(screen.queryByText(t.title)).toBeNull();
    }
  });
});
