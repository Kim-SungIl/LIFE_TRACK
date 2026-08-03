// @vitest-environment jsdom
// StatsPanel — 현재 소스 실제 동작 계약:
// 접힘 기본, 헤더 토글, 스탯 행 단일 확장, year별 academic 설명 배선.
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { StatsPanel } from '../screens/main/StatsPanel';
import {
  STAT_LABELS,
  STAT_FLAVOR_LABELS,
  getGrade,
  type Stats,
  type StatKey,
} from '../../engine/types';
import { STAT_ICONS } from '../screens/shared';
import { getStatDescription } from '../../engine/statDescriptions';

// grade 임계값 손계산: >=80 A / >=60 B / >=40 C / >=20 D / >=0 E
const STATS_FIXTURE: Stats = {
  academic: 85, // A
  social: 65,   // B
  talent: 45,   // C
  mental: 25,   // D
  health: 10,   // E
};
const STAT_KEYS = Object.keys(STATS_FIXTURE) as StatKey[];

function renderPanel(stats: Stats = STATS_FIXTURE, year = 3) {
  return render(<StatsPanel stats={stats} year={year} />);
}

// ── 1. 접힘 기본 ───────────────────────────────────────────────────────────────

describe('StatsPanel 접힘 기본', () => {
  it('최초 렌더 시 헤더 버튼 "📊 능력치"가 존재하고 aria-expanded=false다', () => {
    renderPanel();
    const header = screen.getByRole('button', { name: /📊 능력치/ });
    expect(header).toBeInTheDocument();
    expect(header).toHaveAttribute('aria-expanded', 'false');
  });

  it('접힘 상태에서 각 스탯의 미니 요약 "레이블+등급" 텍스트가 보인다', () => {
    renderPanel();
    for (const key of STAT_KEYS) {
      const grade = getGrade(STATS_FIXTURE[key]);
      const expected = `${STAT_LABELS[key]}${grade.grade}`;
      expect(screen.getByText(expected)).toBeInTheDocument();
    }
  });

  it('접힘 상태에서 상세 행(스탯 아이콘)은 렌더되지 않는다', () => {
    renderPanel();
    // 상세 행에서만 나타나는 아이콘은 collapsed 시 존재하지 않음
    for (const key of STAT_KEYS) {
      expect(screen.queryByText(STAT_ICONS[key])).not.toBeInTheDocument();
    }
  });
});

// ── 2. 헤더 토글 ──────────────────────────────────────────────────────────────

describe('StatsPanel 헤더 토글', () => {
  it('헤더 클릭 후 aria-expanded=true로 바뀌고 5개 스탯 상세 행이 나타난다', () => {
    renderPanel();
    const header = screen.getByRole('button', { name: /📊 능력치/ });
    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'true');

    for (const key of STAT_KEYS) {
      const grade = getGrade(STATS_FIXTURE[key]);
      // 아이콘
      expect(screen.getByText(STAT_ICONS[key])).toBeInTheDocument();
      // 레이블
      expect(screen.getAllByText(STAT_LABELS[key]).length).toBeGreaterThanOrEqual(1);
      // 등급 문자
      expect(screen.getAllByText(grade.grade).length).toBeGreaterThanOrEqual(1);
      // 플레이버 라벨
      expect(screen.getByText(STAT_FLAVOR_LABELS[key][grade.grade])).toBeInTheDocument();
      // 수치(Math.round)
      expect(screen.getByText(String(Math.round(STATS_FIXTURE[key])))).toBeInTheDocument();
    }
  });

  it('헤더를 다시 클릭하면 접히고 aria-expanded=false로 돌아온다', () => {
    renderPanel();
    const header = screen.getByRole('button', { name: /📊 능력치/ });
    fireEvent.click(header);
    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
    // 상세 행 사라짐
    for (const key of STAT_KEYS) {
      expect(screen.queryByText(STAT_ICONS[key])).not.toBeInTheDocument();
    }
  });
});

// ── 3. 스탯 행 확장(단일) ─────────────────────────────────────────────────────

describe('StatsPanel 스탯 행 확장', () => {
  function expandPanel() {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /📊 능력치/ }));
  }

  it('스탯 행 클릭 시 aria-expanded=true, 설명 블록(what/high/low)이 표시된다', () => {
    expandPanel();
    const statButtons = screen.getAllByRole('button').filter(
      btn => btn !== screen.getByRole('button', { name: /📊 능력치/ }),
    );
    // 첫 번째 스탯 행 클릭 (academic)
    fireEvent.click(statButtons[0]);
    expect(statButtons[0]).toHaveAttribute('aria-expanded', 'true');

    const desc = getStatDescription('academic', 3);
    expect(screen.getByText(desc.what)).toBeInTheDocument();
    expect(screen.getByText(`▲ ${desc.high}`)).toBeInTheDocument();
    expect(screen.getByText(`▼ ${desc.low}`)).toBeInTheDocument();
  });

  it('다른 행 클릭 시 이전 행은 닫히고 새 행만 열린다(단일 expandedStat)', () => {
    expandPanel();
    const statButtons = screen.getAllByRole('button').filter(
      btn => btn !== screen.getByRole('button', { name: /📊 능력치/ }),
    );
    // academic 열기
    fireEvent.click(statButtons[0]);
    expect(statButtons[0]).toHaveAttribute('aria-expanded', 'true');

    // social 열기 → academic 닫혀야 함
    fireEvent.click(statButtons[1]);
    expect(statButtons[0]).toHaveAttribute('aria-expanded', 'false');
    expect(statButtons[1]).toHaveAttribute('aria-expanded', 'true');

    const descAcademic = getStatDescription('academic', 3);
    expect(screen.queryByText(descAcademic.what)).not.toBeInTheDocument();

    const descSocial = getStatDescription('social', 3);
    expect(screen.getByText(descSocial.what)).toBeInTheDocument();
  });

  it('같은 행 재클릭 시 닫힌다', () => {
    expandPanel();
    const statButtons = screen.getAllByRole('button').filter(
      btn => btn !== screen.getByRole('button', { name: /📊 능력치/ }),
    );
    fireEvent.click(statButtons[0]);
    expect(statButtons[0]).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(statButtons[0]);
    expect(statButtons[0]).toHaveAttribute('aria-expanded', 'false');

    const desc = getStatDescription('academic', 3);
    expect(screen.queryByText(desc.what)).not.toBeInTheDocument();
  });

  it('스탯 행 확장 시 설명 블록의 what/high/low가 getStatDescription 반환과 정확히 일치한다', () => {
    expandPanel();
    const statButtons = screen.getAllByRole('button').filter(
      btn => btn !== screen.getByRole('button', { name: /📊 능력치/ }),
    );

    STAT_KEYS.forEach((key, idx) => {
      fireEvent.click(statButtons[idx]);
      const desc = getStatDescription(key, 3);
      expect(screen.getByText(desc.what)).toBeInTheDocument();
      expect(screen.getByText(`▲ ${desc.high}`)).toBeInTheDocument();
      expect(screen.getByText(`▼ ${desc.low}`)).toBeInTheDocument();
      // 다음 행을 위해 닫기
      fireEvent.click(statButtons[idx]);
    });
  });
});

// ── 4. year → academic 설명 배선 ─────────────────────────────────────────────

describe('StatsPanel year별 academic 설명 배선', () => {
  function getAcademicWhat(year: number): string {
    return getStatDescription('academic', year).what;
  }

  it('year=1(초등)과 year=3(중등)의 academic what 설명이 다르다', () => {
    expect(getAcademicWhat(1)).not.toBe(getAcademicWhat(3));
  });

  it('year=3(중등)과 year=5(고등)의 academic what 설명이 다르다', () => {
    expect(getAcademicWhat(3)).not.toBe(getAcademicWhat(5));
  });

  it('year=1 렌더 시 academic what이 getStatDescription("academic",1).what과 일치한다', () => {
    render(<StatsPanel stats={STATS_FIXTURE} year={1} />);
    fireEvent.click(screen.getByRole('button', { name: /📊 능력치/ }));
    const statButtons = screen.getAllByRole('button').filter(
      btn => btn !== screen.getByRole('button', { name: /📊 능력치/ }),
    );
    fireEvent.click(statButtons[0]); // academic
    const desc = getStatDescription('academic', 1);
    expect(screen.getByText(desc.what)).toBeInTheDocument();
  });

  it('year=5 렌더 시 academic what이 getStatDescription("academic",5).what과 일치한다', () => {
    render(<StatsPanel stats={STATS_FIXTURE} year={5} />);
    fireEvent.click(screen.getByRole('button', { name: /📊 능력치/ }));
    const statButtons = screen.getAllByRole('button').filter(
      btn => btn !== screen.getByRole('button', { name: /📊 능력치/ }),
    );
    fireEvent.click(statButtons[0]); // academic
    const desc = getStatDescription('academic', 5);
    expect(screen.getByText(desc.what)).toBeInTheDocument();
  });

  it('year=1(초등) what에 "한번 익힌 건 잘 잊지 않는다" 힌트가 포함된다', () => {
    render(<StatsPanel stats={STATS_FIXTURE} year={1} />);
    fireEvent.click(screen.getByRole('button', { name: /📊 능력치/ }));
    const statButtons = screen.getAllByRole('button').filter(
      btn => btn !== screen.getByRole('button', { name: /📊 능력치/ }),
    );
    fireEvent.click(statButtons[0]);
    expect(screen.getByText(/한번 익힌 건 잘 잊지 않는다/)).toBeInTheDocument();
  });

  it('year=5(고등) what에 "80을 넘긴 실력" 힌트가 포함된다', () => {
    render(<StatsPanel stats={STATS_FIXTURE} year={5} />);
    fireEvent.click(screen.getByRole('button', { name: /📊 능력치/ }));
    const statButtons = screen.getAllByRole('button').filter(
      btn => btn !== screen.getByRole('button', { name: /📊 능력치/ }),
    );
    fireEvent.click(statButtons[0]);
    expect(screen.getByText(/80을 넘긴 실력/)).toBeInTheDocument();
  });
});

// ── 5. 미니 요약 내 within 검증 ────────────────────────────────────────────────

describe('StatsPanel 미니 요약 within 검증', () => {
  it('접힘 상태에서 헤더 버튼 내 미니 요약이 5개 스탯 모두 포함한다', () => {
    renderPanel();
    const header = screen.getByRole('button', { name: /📊 능력치/ });
    for (const key of STAT_KEYS) {
      const grade = getGrade(STATS_FIXTURE[key]);
      expect(within(header).getByText(`${STAT_LABELS[key]}${grade.grade}`)).toBeInTheDocument();
    }
  });
});
