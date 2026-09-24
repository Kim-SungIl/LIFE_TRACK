// 「곁에 남은 이름들」 — 관계 중심 인생 타이틀(T30)의 게이트 계약.
//
// 왜 필요한가: 이 타이틀이 생기기 전까지 특수 타이틀 넷은 전부 수능(≤2·≤4) 아니면 저학업(<60)
// 게이트였다. 24시드 실측에서 최적 관계형 빌드(soc 97.1 · men 92.4 · hea 79.6 · 성취 S 24/24 ·
// 행복 S 24/24 · 절친 8명)가 받는 화면은 「수도권 대학」 하나뿐이었다 — 특수 타이틀 0/24.
//
// 임계는 전부 **코드 상수에서 파생**한다(BOND_MIN_FRIENDS · BEST_TIER · AXIS_WEAKNESS).
// 리터럴을 박으면 상수를 옮겨도 테스트가 옛 값을 지키며 초록이 된다.
import { describe, expect, it } from 'vitest';
import {
  AXIS_WEAKNESS, BOND_MIN_FRIENDS, BOND_TITLE, calculateEnding, closeFriends, connectedNpcs,
} from '../ending';
import { BEST_TIER, DEPARTED_NPC_ID, isClosureExcluded } from '../endingNpc';
import { GAME_EVENTS } from '../events/data';
import { INITIAL_NPCS } from '../npcRoster';
import { createInitialState } from '../gameEngine';
import type { ExamResult, GameState, ParentStrength, Stats } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['emotional', 'freedom'];
const RNG_SEED = 42;

// 관계형 빌드의 스탯 모양 — 24시드 실측(acad 69.8 / tal 86.1 / soc 97.1 / men 92.4 / hea 79.6)을
// 반올림해 쓴다. 학업·특기는 이 타이틀의 게이트가 아니므로 **일부러 평범하지 않게** 둔다:
// "학업이 낮아서 받은 상"이 아니라는 것을 픽스처 자체가 말하게 하기 위해서다.
const RELATIONAL_STATS: Stats = { academic: 70, talent: 86, social: 97, mental: 92, health: 80 };

function suneungResult(mockGrade: number): ExamResult {
  const blank = { score: 0, grade: 'C' as const, delta: 0 };
  return {
    subjects: { korean: blank, english: blank, math: blank, socialScience: blank, artsPhysical: blank },
    average: 0, rank: null, prevRank: null, comment: '', parentReaction: '', teacherReaction: '',
    examType: 'suneung', schoolLevel: 'high', year: 7, semester: 2, mockGrade,
  };
}

/**
 * 절친 `count`명짜리 엔딩 상태. 전출 레인(도윤)은 근황과 같은 규칙으로 빼고 나머지에서 채운다.
 * `intimacy`를 낮추면 "같은 인원수인데 티어만 모자란" 음성 짝이 된다.
 */
function bondState(
  count: number,
  opts: { intimacy?: number; stats?: Partial<Stats>; overrides?: Partial<GameState>; friendIds?: string[] } = {},
): GameState {
  const st = createInitialState('female', PARENTS, { rngSeed: RNG_SEED });
  const intimacy = opts.intimacy ?? BEST_TIER;
  const targets = opts.friendIds
    ?? st.npcs.filter(n => n.id !== DEPARTED_NPC_ID).slice(0, count).map(n => n.id);
  st.npcs = st.npcs.map(n => (targets.includes(n.id)
    ? { ...n, met: true, intimacy }
    : { ...n, met: true, intimacy: 0 }));
  st.stats = { ...RELATIONAL_STATS, ...opts.stats };
  return Object.assign(st, opts.overrides ?? {});
}

describe('closeFriends / connectedNpcs — 근황 레인과 같은 모집단', () => {
  it('BEST_TIER 이상만 절친으로 센다 (양방향 경계)', () => {
    expect(closeFriends(bondState(BOND_MIN_FRIENDS, { intimacy: BEST_TIER }))).toHaveLength(BOND_MIN_FRIENDS);
    expect(closeFriends(bondState(BOND_MIN_FRIENDS, { intimacy: BEST_TIER - 1 })), 'grind 캡 안쪽은 절친이 아니다').toHaveLength(0);
  });

  it('절친은 근황 모집단의 부분집합이다 (두 층이 같은 필터를 쓴다)', () => {
    const st = bondState(BOND_MIN_FRIENDS);
    const connectedIds = connectedNpcs(st).map(n => n.id);
    for (const f of closeFriends(st)) expect(connectedIds).toContain(f.id);
  });

  it('만나지 않은 NPC와 전출한 도윤은 세지 않는다', () => {
    const unmet = bondState(BOND_MIN_FRIENDS);
    unmet.npcs = unmet.npcs.map(n => ({ ...n, met: false }));
    expect(closeFriends(unmet), 'met=false는 관계가 아니다').toHaveLength(0);

    const departedOnly = bondState(0);
    departedOnly.npcs = departedOnly.npcs.map(n => (n.id === DEPARTED_NPC_ID
      ? { ...n, met: true, intimacy: 100 } : n));
    expect(closeFriends(departedOnly), '전출 레인은 근황과 같은 규칙으로 제외').toHaveLength(0);
  });

  // 근황 레인이 침묵하는 관계(excludeWhen: 그 판이 관계를 명시적으로 닫았다)는 타이틀도 안 센다.
  // 이 짝이 없으면 `!isClosureExcluded`를 지워도 전부 초록이었다(뮤테이션 M12 실측).
  it('관계를 명시적으로 닫은 런은 절친에서 빠진다', () => {
    const SEVERED_ID = 'yerin';
    const ids = [...INITIAL_NPCS.map(n => n.id)
      .filter(id => id !== DEPARTED_NPC_ID && id !== SEVERED_ID)
      .slice(0, BOND_MIN_FRIENDS - 1), SEVERED_ID];

    const intact = bondState(0, { friendIds: ids });
    expect(isClosureExcluded(intact, SEVERED_ID), '픽스처 자기검사: 아직 안 닫힌 상태').toBe(false);
    expect(closeFriends(intact)).toHaveLength(BOND_MIN_FRIENDS);
    expect(calculateEnding(intact).title, '양성 짝').toContain(BOND_TITLE);

    // 단절 선택지를 실제 이벤트 데이터에서 가져온다 — id/인덱스가 바뀌면 아래 자기검사가 터진다.
    const severEvent = GAME_EVENTS.find(e => e.id === 'yerin-not-a-trade');
    expect(severEvent, '단절 분기를 가진 이벤트가 데이터에 있어야 한다').toBeTruthy();
    const severed = bondState(0, {
      friendIds: ids,
      overrides: { events: [{ ...severEvent!, resolvedChoice: 2 }] },
    });
    expect(isClosureExcluded(severed, SEVERED_ID), '픽스처 자기검사: 단절이 성립했다').toBe(true);
    expect(closeFriends(severed), '닫은 관계는 안 센다').toHaveLength(BOND_MIN_FRIENDS - 1);
    expect(calculateEnding(severed).title).not.toContain(BOND_TITLE);
  });

  it('내림차순 정렬 — 문장이 부르는 이름은 가장 가까운 친구다', () => {
    const st = bondState(BOND_MIN_FRIENDS);
    st.npcs = st.npcs.map(n => (n.id === 'yuna' ? { ...n, met: true, intimacy: 100 } : n));
    expect(closeFriends(st)[0].id).toBe('yuna');
  });
});

describe('엔딩 타이틀 — 관계 중심 인생', () => {
  // **문턱 값 자체를 잠근다.** 다른 케이스는 전부 BOND_MIN_FRIENDS에서 파생하므로 상수를
  // 4나 6으로 옮겨도 그대로 초록이었다(뮤테이션 M3·M4 실측 — 파생만 하면 값은 안 잠긴다).
  // 그래서 여기서만 **실측 분리선**을 숫자로 적는다. 이건 코드 상수의 복사본이 아니라 측정값이다:
  // QA 하네스 기존 30페르소나 × 12시드 = 360판에서, 마음·몸이 성한(mental·health ≥ AXIS_WEAKNESS)
  // 판의 절친 최대치가 4명이었다(balanced·mental-care·focus-haeun·focus-junha·paid-full-spend·
  // poor-resilience 각 12/12가 정확히 4). 동행을 분산하지 않은 관계형(bond-no-spread)도 4에서
  // 멈춘다. 문턱은 그 바로 위 칸이어야 한다 — 내리면 균형형이 들어오고(특수 타이틀이 아니게 된다),
  // 올려도 걸러지는 판은 그대로인데 자연 감쇠로 한 명을 놓친 판만 타이틀을 통째로 잃는다.
  // 측정을 다시 했다면 이 숫자와 BOND_MIN_FRIENDS를 **함께** 갱신할 것.
  it('문턱은 실측 분리선 바로 위 칸이다 (360판 최대 4명)', () => {
    const MEASURED_MAX_WITHOUT_COMPANION_SPREAD = 4;
    expect(BOND_MIN_FRIENDS).toBe(MEASURED_MAX_WITHOUT_COMPANION_SPREAD + 1);
  });

  it('양성: 절친이 문턱만큼 있고 마음·몸이 부서지지 않았으면 이 타이틀을 받는다', () => {
    const e = calculateEnding(bondState(BOND_MIN_FRIENDS));
    expect(e.title).toContain(BOND_TITLE);
    // 진로는 지워지는 게 아니라 뒤에 붙는다 — 다른 특수 타이틀 넷과 같은 모양.
    expect(e.title).toBe(`${BOND_TITLE} — ${e.career}`);
    // 이름은 손으로 적지 않는다 — 근황 레인과 같은 경로에서 온 top NPC여야 한다.
    expect(e.description).toContain(closeFriends(bondState(BOND_MIN_FRIENDS))[0].name);
    expect(e.description).toContain(e.careerDetail);
    // 문구 자체가 비거나 뒤바뀌면 리뷰에서 보이게 한 줄 남긴다(상수 공유만으로는 못 잡는 축).
    expect(BOND_TITLE).toMatchInlineSnapshot(`"곁에 남은 이름들"`);
  });

  it('음성: 절친이 한 명 모자라면 안 받는다 (N 양방향 잠금)', () => {
    expect(calculateEnding(bondState(BOND_MIN_FRIENDS - 1)).title).not.toContain(BOND_TITLE);
    expect(calculateEnding(bondState(BOND_MIN_FRIENDS + 1)).title, '더 많으면 당연히 받는다').toContain(BOND_TITLE);
  });

  it('음성: 인원은 맞는데 친밀도가 절친 임계 아래면 안 받는다', () => {
    expect(calculateEnding(bondState(BOND_MIN_FRIENDS, { intimacy: BEST_TIER - 1 })).title).not.toContain(BOND_TITLE);
  });

  it('음성: 마음이나 몸이 부서진 축이면 안 받는다 (양방향 경계)', () => {
    expect(calculateEnding(bondState(BOND_MIN_FRIENDS, { stats: { mental: AXIS_WEAKNESS } })).title).toContain(BOND_TITLE);
    expect(calculateEnding(bondState(BOND_MIN_FRIENDS, { stats: { mental: AXIS_WEAKNESS - 1 } })).title,
      '친구는 많은데 마음이 부서진 판은 다른 이야기다').not.toContain(BOND_TITLE);
    expect(calculateEnding(bondState(BOND_MIN_FRIENDS, { stats: { health: AXIS_WEAKNESS } })).title).toContain(BOND_TITLE);
    expect(calculateEnding(bondState(BOND_MIN_FRIENDS, { stats: { health: AXIS_WEAKNESS - 1 } })).title).not.toContain(BOND_TITLE);
  });

  it('수능·학업과 무관하게 열린다 (진로 문자열만 뒤에 붙는다)', () => {
    // 마음은 A대(멘탈 70) — 위 분기(완벽한 청춘·승리자)의 행복 게이트를 비켜 둔다.
    // 그래야 "수능 등급이 이 타이틀을 가르지 않는다"만 남고 다른 분기와 섞이지 않는다.
    for (const grade of [1, 3, 5, 9]) {
      const e = calculateEnding(bondState(BOND_MIN_FRIENDS, {
        stats: { mental: 70 },
        overrides: { examResults: [suneungResult(grade)], track: 'humanities' },
      }));
      expect(e.title, `수능 ${grade}등급`).toContain(BOND_TITLE);
      expect(e.title, '진로는 지워지지 않는다').toContain(e.career);
    }
    // 학업이 높아도(저학업 게이트가 아님) 열린다 — 「행복한 평범함」과 갈리는 지점.
    const highAcademic = calculateEnding(bondState(BOND_MIN_FRIENDS, { stats: { academic: 95, mental: 70 } }));
    expect(highAcademic.title).toContain(BOND_TITLE);
  });

  it('음성: 공부 몰빵·균형형은 절친이 없어 안 받는다', () => {
    const academicMax = bondState(0, {
      stats: { academic: 95, talent: 40, social: 45, mental: 60, health: 55 },
      overrides: { examResults: [suneungResult(1)], track: 'science' },
    });
    expect(calculateEnding(academicMax).title).not.toContain(BOND_TITLE);

    const balanced = bondState(0, {
      stats: { academic: 75, talent: 60, social: 70, mental: 70, health: 65 },
      overrides: { examResults: [suneungResult(3)], track: 'humanities' },
    });
    expect(calculateEnding(balanced).title).not.toContain(BOND_TITLE);
  });
});

describe('타이틀 우선순위 — 위로는 양보하고 아래는 이긴다', () => {
  const ALL_FRIENDS = 9;   // 전출 제외 전원

  it('「완벽한 청춘」이 위다 (무결점 S + 행복 S + 수능 ≤2)', () => {
    const e = calculateEnding(bondState(ALL_FRIENDS, {
      stats: { academic: 95, talent: 90, social: 95, mental: 95, health: 95 },
      overrides: { examResults: [suneungResult(1)], track: 'humanities' },
    }));
    expect(e.title).toContain('완벽한 청춘');
    expect(e.title).not.toContain(BOND_TITLE);
  });

  it('「불꽃은 꺼지지 않는다」가 위다 (번아웃 3회+ · 수능 ≤4)', () => {
    const e = calculateEnding(bondState(ALL_FRIENDS, {
      overrides: { examResults: [suneungResult(3)], track: 'humanities', burnoutCount: 3 },
    }));
    expect(e.title, '7년이 몇 번 무너진 판은 그 서사가 더 크다').toContain('불꽃은 꺼지지 않는다');
    expect(e.title).not.toContain(BOND_TITLE);
  });

  it('「행복한 평범함」보다 위다 (같은 조건이면 더 구체적인 사실이 이긴다)', () => {
    const stats: Partial<Stats> = { academic: 45, talent: 45, social: 70, mental: 85, health: 60 };
    const withFriends = calculateEnding(bondState(BOND_MIN_FRIENDS, { stats }));
    expect(withFriends.happiness, '행복 S — 「행복한 평범함」의 전제를 만족시켜 둔다').toBe('S');
    expect(withFriends.title).toContain(BOND_TITLE);

    // 절친만 빼면 그 자리는 「행복한 평범함」이 가져간다 — 두 분기가 실제로 경쟁 중임을 증명한다.
    const withoutFriends = calculateEnding(bondState(0, { stats }));
    expect(withoutFriends.title).toContain('행복한 평범함');
  });
});
