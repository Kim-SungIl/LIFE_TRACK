import { describe, expect, it } from 'vitest';
import { getNpcSmalltalk, getAvailableNpcEvents } from '../talkSystem';
import { NPC_SMALLTALK, type SmalltalkTiers, type GenderedPool } from '../talkData/npcSmalltalk';
import { NPC_MINI_EVENTS } from '../talkData/miniEvents';
import { GAME_EVENTS } from '../events';
import { getWeekInfo } from '../gameEngine';
import { nextIntimacyThreshold } from '../relationshipSignals';
import { PARENT_MINI_EVENTS, miniEventFitsContext, type MiniTalkEvent } from '../talkData/miniEvents';
import { getAvailableHomeEvents } from '../talkSystem';
import { makeState } from '../../test/fixtures';
import type { GameState, Gender } from '../types';

// 달력: W1~19 1학기 / W20~24 여름방학 / W25~42 2학기 / W43~48 겨울방학 (gameEngine.getWeekInfo)
// 계절 축이 없던 시절엔 방학에도 "사물함 또 안 닫혀?"·"점심에 축구 나갈래?"가 나왔다.
// 이 파일은 **주차에서 파생한 계절**이 잡담·미니이벤트 양쪽을 실제로 가르는지 잠근다.

/** 주차는 코드에서 파생한다 — 달력이 움직이면 픽스처가 따라온다. */
const ALL_WEEKS = Array.from({ length: 48 }, (_, i) => i + 1);
const VACATION_WEEKS = ALL_WEEKS.filter(w => getWeekInfo(w).isVacation);
const SEMESTER_WEEKS = ALL_WEEKS.filter(w => !getWeekInfo(w).isVacation);

const LEVEL_YEAR = { elementary: 1, middle: 3, high: 6 } as const;
const GENDERS: Gender[] = ['male', 'female'];
const TIERS = [0, 30, 50, 70];

/** 실현 풀 하한 — 이보다 얇으면 같은 줄이 눈에 띄게 반복된다. */
const POOL_FLOOR = 8;
/** corpus 하한 — 분류가 통째로 지워지면 이 게이트가 제 손으로 초록이 된다.
 *  실측(326 / 246 / 14)의 약 80%. 전엔 90/25/10이라 슬랙이 64~88%여서
 *  "통째로 지워지면 잡는다"는 주석이 사실상 거짓이었다(3자 검수 지적). */
const SCHOOL_ONLY_FLOOR = 260;
const VACATION_ONLY_FLOOR = 195;
const SEMESTER_MINI_FLOOR = 12;

function lines(p: GenderedPool | undefined, gender: Gender): string[] {
  return p ? [...(p.common ?? []), ...(gender === 'female' ? p.female ?? [] : p.male ?? [])] : [];
}
function spread(t: SmalltalkTiers | undefined, gender: Gender, level: keyof typeof LEVEL_YEAR, intimacy: number): string[] {
  if (!t) return [];
  return [
    ...lines(t, gender),
    ...(intimacy >= 30 ? lines(t.warm?.[level], gender) : []),
    ...(intimacy >= 50 ? lines(t.close?.[level], gender) : []),
    ...(intimacy >= 70 ? lines(t.deep?.[level], gender) : []),
  ];
}
function stateFor(npcId: string, week: number, level: keyof typeof LEVEL_YEAR, gender: Gender, intimacy: number): GameState {
  const s = makeState({ year: LEVEL_YEAR[level], week, gender });
  for (const n of s.npcs) if (n.id === npcId) n.intimacy = intimacy;
  return s;
}
/** 픽업을 충분히 돌려 실현 풀을 모은다. pickRandomLine은 시드 RNG라 주차를 흔들어 표본을 넓힌다. */
function realizedPool(npcId: string, weeks: number[], level: keyof typeof LEVEL_YEAR, gender: Gender, intimacy: number): Set<string> {
  const seen = new Set<string>();
  for (const week of weeks) {
    const s = stateFor(npcId, week, level, gender, intimacy);
    for (let i = 0; i < 120; i++) seen.add(getNpcSmalltalk(s, npcId));
  }
  return seen;
}

const NPCS = Object.keys(NPC_SMALLTALK);
const LEVELS = Object.keys(LEVEL_YEAR) as (keyof typeof LEVEL_YEAR)[];

// 분류 리터럴 — 하한만 두면 **태그 한 개를 지우는 회귀**가 안 잡힌다(코퍼스 하한은 대량 삭제만 건다).
// 리포 관례대로 게이트 계약(파생)과 분류 수치(리터럴)를 나눠 잠근다.
// 판정 기준: **지금 학교에 있어야/이번 주 학교가 열려야 성립**하는 것만 학기 전용.
//   회상("체육 시간에 너 움직임 좋더라")·일반론·미래형("다음 체육대회는")은 방학에도 말이 되므로 제외.
//   졸업식 강당(talk_haeun_90_empty_line)은 졸업식이 W46=겨울방학이라 일부러 안 달았다.
const CLASSIFIED: Record<string, { schoolOnly: number; vacationOnly: number }> = {
  jihun: { schoolOnly: 48, vacationOnly: 3 },
  subin: { schoolOnly: 7, vacationOnly: 3 },
  minjae: { schoolOnly: 19, vacationOnly: 3 },
  yuna: { schoolOnly: 11, vacationOnly: 3 },
  doyun: { schoolOnly: 29, vacationOnly: 8 },
  haeun: { schoolOnly: 4, vacationOnly: 3 },
  junha: { schoolOnly: 5, vacationOnly: 3 },
  seoa: { schoolOnly: 7, vacationOnly: 3 },
  siwoo: { schoolOnly: 14, vacationOnly: 11 },
  yerin: { schoolOnly: 2, vacationOnly: 3 },
};

const SEMESTER_MINI_IDS = [
  'talk_jihun_badminton', 'talk_doyun_soccer', 'talk_doyun_classroom',
  'talk_haeun_50_window', 'talk_junha_50_seabreeze', 'talk_jihun_70_locker',
  'talk_yuna_70_chalk_dust', 'talk_haeun_70_direction', 'talk_junha_70_speech',
  'talk_jihun_90_bench', 'talk_minjae_90_unmasked',
  'talk_siwoo_30_railing', 'talk_siwoo_50_linked_corridor', 'talk_siwoo_70_dry_route',
];

function countLines(node: unknown): number {
  if (Array.isArray(node)) return node.filter(x => typeof x === 'string').length;
  if (node && typeof node === 'object') return Object.values(node).reduce((a: number, v) => a + countLines(v), 0);
  return 0;
}

describe('분류 수치 잠금 — 태그 하나가 조용히 빠지지 않는다', () => {
  it('검사 모수가 살아 있다 — NPC 전수를 덮는다', () => {
    expect(Object.keys(CLASSIFIED).sort()).toEqual(Object.keys(NPC_SMALLTALK).sort());
  });

  for (const [npc, spec] of Object.entries(CLASSIFIED)) {
    it(`${npc} — schoolOnly ${spec.schoolOnly}줄 · vacationOnly ${spec.vacationOnly}줄`, () => {
      expect(countLines(NPC_SMALLTALK[npc].schoolOnly), `${npc}.schoolOnly`).toBe(spec.schoolOnly);
      expect(countLines(NPC_SMALLTALK[npc].vacationOnly), `${npc}.vacationOnly`).toBe(spec.vacationOnly);
    });
  }

  it("season:'semester' 미니이벤트 전수가 목록과 정확히 같다", () => {
    const actual = NPC_MINI_EVENTS.filter(e => e.npcId && e.season === 'semester').map(e => e.id).sort();
    expect(actual).toEqual([...SEMESTER_MINI_IDS].sort());
  });

  // 줄 수만 세면 **방학 풀에 학교 소재를 써 넣는 회귀**를 못 잡는다(개수가 그대로라서).
  // 모호하지 않은 표지만 좁게 고른다 — 여기 있는 낱말은 방학에 절대 나오면 안 된다.
  // (교복·운동장·체육 시간처럼 해석 여지가 있는 것은 안 넣는다. 그건 분류 판단의 영역이다.)
  const SCHOOL_MARKERS = [
    '급식', '사물함', '쉬는 시간', '점심시간', '야자', '교실', '칠판', '매점', '담임',
    '자습실', '자습 시간', '자습 끝나고', '수행평가', '반 정리', '도서실', '교무실', '종례', '조회',
  ];

  // 잡담은 전부 대화 인용부호로 감싼 형식이다(UI가 그대로 출력). 새 줄을 넣다가 이 껍데기를
  // 빠뜨리면 그 줄만 따옴표 없이 떠서 톤이 깨지는데, 개수·내용 검사로는 안 보인다.
  it('모든 잡담 줄이 대화 인용부호로 감싸여 있다', () => {
    const offenders: string[] = [];
    for (const [npc, pool] of Object.entries(NPC_SMALLTALK)) {
      for (const level of LEVELS) for (const gender of GENDERS) {
        const every = [
          ...spread(pool, gender, level, 70),
          ...spread(pool.schoolOnly, gender, level, 70),
          ...spread(pool.vacationOnly, gender, level, 70),
        ];
        for (const line of every) {
          if (!(line.startsWith('"') && line.endsWith('"'))) offenders.push(`${npc}: ${line}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  // **base 풀까지 함께 본다.** 전엔 vacationOnly에만 걸어서 base에 남은 학교 대사를 못 봤다 —
  // '야자'는 이 목록에 이미 있는 낱말인데 yuna의 base 줄("야자 끝나고 학교 빠져나올 때")이
  // 방학에 그대로 나왔다(3자 검수 지적). 검사 대상은 "분류한 것"이 아니라 **방학에 실제로 뜨는 것**이다.
  // 마커는 낱말 단위라 두 줄에서 오탐한다. 지우지 않고 **이유를 적어 예외로 둔다** —
  // 마커를 빼면 다음에 진짜로 새는 줄을 놓친다. 예외가 데이터에서 사라지면 아래 테스트가 알려준다.
  const MARKER_EXCEPTIONS: Record<string, string> = {
    '"네가 오늘 한숨 쉬는 횟수가 늘었어. 데이터상으로 쉬는 시간이 필요해 보여."':
      "여기 '쉬는 시간'은 학교 시간표가 아니라 휴식 일반이다. 방학에 오히려 더 맞는 말이다.",
    '"조용한 데 알아. 도서실 말고. …아니다, 이건 아직 안 알려줄래."':
      "'도서실 말고'라는 부정문이다. 학교 도서실을 소재로 삼는 게 아니라 배제한다.",
  };

  it('마커 예외가 데이터에 실재한다 (낡은 예외가 가드를 뚫지 않는다)', () => {
    const all = new Set<string>();
    for (const pool of Object.values(NPC_SMALLTALK)) {
      for (const level of LEVELS) for (const gender of GENDERS) for (const intimacy of TIERS) {
        for (const l of spread(pool, gender, level, intimacy)) all.add(l);
        for (const l of spread(pool.vacationOnly, gender, level, intimacy)) all.add(l);
      }
    }
    for (const line of Object.keys(MARKER_EXCEPTIONS)) expect(all.has(line), line).toBe(true);
  });

  it('방학에 실제로 뜨는 풀 전체에 학교 한정 표지가 없다', () => {
    const offenders: string[] = [];
    for (const [npc, pool] of Object.entries(NPC_SMALLTALK)) {
      for (const level of LEVELS) for (const gender of GENDERS) for (const intimacy of TIERS) {
        const realized = [
          ...spread(pool, gender, level, intimacy),
          ...spread(pool.vacationOnly, gender, level, intimacy),
        ];
        for (const line of realized) {
          if (MARKER_EXCEPTIONS[line]) continue;
          const hit = SCHOOL_MARKERS.filter(m => line.includes(m));
          if (hit.length > 0) offenders.push(`${npc}[${hit.join(',')}]: ${line}`);
        }
      }
    }
    expect([...new Set(offenders)]).toEqual([]);
  });

  it("season 값은 'semester' 아니면 'vacation'만 쓴다", () => {
    for (const e of NPC_MINI_EVENTS) {
      if (e.season !== undefined) expect(['semester', 'vacation'], e.id).toContain(e.season);
    }
  });
});

describe('계절 축 — 코퍼스가 살아 있다', () => {
  it('schoolOnly/vacationOnly 분류가 통째로 사라지지 않았다', () => {
    let school = 0, vac = 0;
    for (const pool of Object.values(NPC_SMALLTALK)) {
      for (const level of LEVELS) for (const gender of GENDERS) {
        school += spread(pool.schoolOnly, gender, level, 70).length;
        vac += spread(pool.vacationOnly, gender, level, 70).length;
      }
    }
    // 성별·학교급을 돌며 세므로 중복이 있다. 하한만 본다 — 0이면 이 파일의 모든 단언이 공허해진다.
    expect(school, 'schoolOnly 총량').toBeGreaterThanOrEqual(SCHOOL_ONLY_FLOOR);
    expect(vac, 'vacationOnly 총량').toBeGreaterThanOrEqual(VACATION_ONLY_FLOOR);
    expect(NPC_MINI_EVENTS.filter(e => e.npcId && e.season === 'semester').length)
      .toBeGreaterThanOrEqual(SEMESTER_MINI_FLOOR);
  });

  it('달력이 방학 주차와 학기 주차를 둘 다 낸다', () => {
    expect(VACATION_WEEKS.length).toBeGreaterThan(0);
    expect(SEMESTER_WEEKS.length).toBeGreaterThan(0);
    // 경계: 종업식 주(W19)는 학기, 그 다음 주(W20)부터 방학
    expect(getWeekInfo(19).isVacation).toBe(false);
    expect(getWeekInfo(20).isVacation).toBe(true);
    expect(getWeekInfo(42).isVacation).toBe(false);
    expect(getWeekInfo(43).isVacation).toBe(true);
  });
});

describe('방학식은 학기 마지막 주에 열린다', () => {
  // 종업식은 학기의 마지막 날이고 방학은 다음 주부터다. 전엔 week:20이라
  // "여름방학 1주차"에 교문에서 종업식을 치렀다. 주차를 박는 게 아니라 **성질**을 잠근다 —
  // 달력(getWeekInfo)이 움직여도 이 관계가 유지돼야 한다.
  it('summer-start는 학기 주차이고, 바로 다음 주가 방학이다', () => {
    const ev = GAME_EVENTS.find(e => e.id === 'summer-start');
    expect(ev, 'summer-start 이벤트').toBeDefined();
    expect(ev!.week, 'summer-start.week').toBeDefined();
    const w = ev!.week!;
    expect(getWeekInfo(w).isVacation, `W${w}는 학기여야 한다`).toBe(false);
    expect(getWeekInfo(w + 1).isVacation, `W${w + 1}는 방학이어야 한다`).toBe(true);
  });

  it('winter-start는 방학 첫 주에 열린다 (집에서 "겨울방학이 시작됐다" — 의도된 대조)', () => {
    const ev = GAME_EVENTS.find(e => e.id === 'winter-start');
    const w = ev!.week!;
    expect(getWeekInfo(w).isVacation, `W${w}는 방학이어야 한다`).toBe(true);
    expect(getWeekInfo(w - 1).isVacation, `W${w - 1}는 학기여야 한다`).toBe(false);
  });
});

describe('잡담 — 계절이 풀을 실제로 가른다', () => {
  for (const npcId of NPCS) {
    const pool = NPC_SMALLTALK[npcId];
    for (const level of LEVELS) for (const gender of GENDERS) for (const intimacy of TIERS) {
      const tag = `${npcId}/${level}/${gender}/친밀도${intimacy}`;

      it(`방학엔 학기 전용 줄이 한 줄도 안 나온다 — ${tag}`, () => {
        const school = new Set(spread(pool.schoolOnly, gender, level, intimacy));
        if (school.size === 0) return; // 이 셀엔 학기 전용이 없다
        const got = realizedPool(npcId, VACATION_WEEKS, level, gender, intimacy);
        expect([...got].filter(l => school.has(l)), tag).toEqual([]);
      });

      it(`학기엔 방학 전용 줄이 한 줄도 안 나온다 — ${tag}`, () => {
        const vac = new Set(spread(pool.vacationOnly, gender, level, intimacy));
        if (vac.size === 0) return;
        const got = realizedPool(npcId, SEMESTER_WEEKS.slice(0, 6), level, gender, intimacy);
        expect([...got].filter(l => vac.has(l)), tag).toEqual([]);
      });

      it(`양쪽 계절 모두 풀이 ${POOL_FLOOR}줄 이상이다 — ${tag}`, () => {
        const base = spread(pool, gender, level, intimacy).length;
        expect(base + spread(pool.vacationOnly, gender, level, intimacy).length, `${tag} 방학`).toBeGreaterThanOrEqual(POOL_FLOOR);
        expect(base + spread(pool.schoolOnly, gender, level, intimacy).length, `${tag} 학기`).toBeGreaterThanOrEqual(POOL_FLOOR);
      });
    }
  }

  it('학기엔 학기 전용 줄이 실제로 나온다 (배선이 한쪽만 살아 있지 않다)', () => {
    for (const npcId of NPCS) {
      const school = new Set(spread(NPC_SMALLTALK[npcId].schoolOnly, 'male', 'elementary', 70));
      if (school.size === 0) continue;
      const got = realizedPool(npcId, SEMESTER_WEEKS.slice(0, 6), 'elementary', 'male', 70);
      expect([...got].some(l => school.has(l)), `${npcId} 학기 전용 미노출`).toBe(true);
    }
  });

  it('방학엔 방학 전용 줄이 실제로 나온다', () => {
    for (const npcId of NPCS) {
      const vac = new Set(spread(NPC_SMALLTALK[npcId].vacationOnly, 'male', 'elementary', 0));
      if (vac.size === 0) continue;
      const got = realizedPool(npcId, VACATION_WEEKS, 'elementary', 'male', 0);
      expect([...got].some(l => vac.has(l)), `${npcId} 방학 전용 미노출`).toBe(true);
    }
  });
});

describe('미니 이벤트 — season 게이트', () => {
  it("season:'semester'인 이벤트는 방학에 목록에 없다", () => {
    const semesterOnly = NPC_MINI_EVENTS.filter(e => e.npcId && e.season === 'semester');
    expect(semesterOnly.length).toBeGreaterThanOrEqual(SEMESTER_MINI_FLOOR);
    for (const e of semesterOnly) {
      for (const week of VACATION_WEEKS) {
        const s = stateFor(e.npcId!, week, 'high', e.gender ?? 'male', 100);
        s.year = Math.max(e.yearMin ?? 1, Math.min(e.yearMax ?? 7, 6));
        expect(getAvailableNpcEvents(s, e.npcId!).map(x => x.id), `${e.id} W${week}`).not.toContain(e.id);
      }
    }
  });

  it("season:'semester'인 이벤트는 학기엔 목록에 있다 (게이트가 통째로 막지 않는다)", () => {
    for (const e of NPC_MINI_EVENTS.filter(x => x.npcId && x.season === 'semester')) {
      const year = Math.max(e.yearMin ?? 1, Math.min(e.yearMax ?? 7, 6));
      const s = stateFor(e.npcId!, 10, year <= 1 ? 'elementary' : year <= 4 ? 'middle' : 'high', e.gender ?? 'male', 100);
      s.year = year;
      expect(getAvailableNpcEvents(s, e.npcId!).map(x => x.id), e.id).toContain(e.id);
    }
  });
});

describe('관계 신호가 같은 계절 근거를 쓴다', () => {
  // 패널의 "곧 더 가까워질 듯"은 미니이벤트 후보를 **따로** 세던 자리다. 전엔 조건을 각자
  // 나열하고 주석만 "동일 필터"라고 주장했고, season이 한쪽에만 생기자 바로 갈렸다 —
  // 방학에 "곧 열린다"고 말해놓고 실제로는 아무것도 안 열렸다(#441).
  // 이제 두 곳이 miniEventFitsContext 한 함수를 쓴다. 그 배선을 잠근다.
  const cases = NPC_MINI_EVENTS.filter(e => e.npcId && e.season === 'semester' && e.intimacyMin !== undefined);

  it('검사 모수가 살아 있다', () => {
    expect(cases.length).toBeGreaterThanOrEqual(SEMESTER_MINI_FLOOR);
  });

  it('학기 전용 미니는 방학에 "다음 문턱"을 만들지 않는다', () => {
    let checked = 0;
    for (const e of cases) {
      const tier = e.intimacyMin!;
      const year = Math.max(e.yearMin ?? 1, Math.min(e.yearMax ?? 7, 6));
      const level = year <= 1 ? 'elementary' : year <= 4 ? 'middle' : 'high';
      const gender = e.gender ?? 'male';
      const semState = stateFor(e.npcId!, SEMESTER_WEEKS[5], level, gender, tier - 1);
      semState.year = year;
      const npcSem = semState.npcs.find(n => n.id === e.npcId)!;
      npcSem.met = true;
      // 학기엔 이 미니가 그 문턱을 만든다(= 신호의 근거로 살아 있다)
      if (nextIntimacyThreshold(npcSem, semState) !== tier) continue; // 다른 소스가 더 가까운 문턱을 가진 경우
      checked++;
      for (const week of VACATION_WEEKS) {
        const vacState = stateFor(e.npcId!, week, level, gender, tier - 1);
        vacState.year = year;
        const npcVac = vacState.npcs.find(n => n.id === e.npcId)!;
        npcVac.met = true;
        expect(nextIntimacyThreshold(npcVac, vacState), `${e.id} W${week}`).not.toBe(tier);
      }
    }
    // 한 건도 못 재면 이 테스트는 공허하다
    expect(checked, '실제로 검증된 미니 수').toBeGreaterThan(0);
  });
});

describe('부모 경로도 같은 술어를 쓴다', () => {
  // season은 MiniTalkEvent 공용 필드다. 부모 풀엔 아직 하나도 안 달려 있어서,
  // 배선이 빠져도 아무 테스트가 안 깨진다 — 합성 이벤트를 실제 풀에 넣어 배선을 직접 잠근다.
  const synthetic: MiniTalkEvent = {
    id: '__test_parent_semester_only',
    parentStrength: 'strict',
    season: 'semester',
    description: '합성 — 계절 배선 검사용',
    effects: {},
    message: '합성',
  };

  it('season이 달린 부모 이벤트는 방학에 후보에서 빠진다', () => {
    PARENT_MINI_EVENTS.push(synthetic);
    try {
      const semState = makeState({ year: 3, week: SEMESTER_WEEKS[5] });
      semState.parents = ['strict', 'emotional'];
      expect(getAvailableHomeEvents(semState).map(e => e.id), '학기엔 뜬다').toContain(synthetic.id);
      for (const week of VACATION_WEEKS) {
        const vacState = makeState({ year: 3, week });
        vacState.parents = ['strict', 'emotional'];
        expect(getAvailableHomeEvents(vacState).map(e => e.id), `방학 W${week}`).not.toContain(synthetic.id);
      }
    } finally {
      PARENT_MINI_EVENTS.splice(PARENT_MINI_EVENTS.indexOf(synthetic), 1);
    }
  });

  it('공용 술어가 세 축을 모두 본다 (학년·성별·계절)', () => {
    const base = makeState({ year: 3, week: 10 });
    expect(miniEventFitsContext({ ...synthetic, season: 'semester' }, base)).toBe(true);
    expect(miniEventFitsContext({ ...synthetic, season: 'vacation' }, base)).toBe(false);
    expect(miniEventFitsContext({ ...synthetic, season: undefined, yearMin: 5 }, base)).toBe(false);
    expect(miniEventFitsContext({ ...synthetic, season: undefined, yearMax: 2 }, base)).toBe(false);
    expect(miniEventFitsContext({ ...synthetic, season: undefined, gender: 'female' }, base)).toBe(false);
  });
});

describe('계절은 주차에서 파생한다 (state.isVacation을 읽지 않는다)', () => {
  // 세이브 변조·마이그레이션으로 state.isVacation이 낡으면, 필드를 읽는 구현은
  // "방학인데 학교 대사"로 조용히 되돌아간다. 달력 SSOT는 getWeekInfo 하나여야 한다.
  it('isVacation 필드가 거짓말해도 방학 주차면 학기 전용 줄이 안 나온다', () => {
    const npcId = 'doyun';
    const school = new Set(spread(NPC_SMALLTALK[npcId].schoolOnly, 'male', 'elementary', 45));
    expect(school.size).toBeGreaterThan(0);
    for (const week of VACATION_WEEKS) {
      const s = stateFor(npcId, week, 'elementary', 'male', 45);
      s.isVacation = false; // 낡은 필드
      const seen = new Set<string>();
      for (let i = 0; i < 200; i++) seen.add(getNpcSmalltalk(s, npcId));
      expect([...seen].filter(l => school.has(l)), `W${week}`).toEqual([]);
    }
  });

  it('isVacation 필드가 거짓말해도 학기 주차면 방학 전용 줄이 안 나온다', () => {
    const npcId = 'doyun';
    const vac = new Set(spread(NPC_SMALLTALK[npcId].vacationOnly, 'male', 'elementary', 45));
    expect(vac.size).toBeGreaterThan(0);
    for (const week of SEMESTER_WEEKS.slice(0, 8)) {
      const s = stateFor(npcId, week, 'elementary', 'male', 45);
      s.isVacation = true; // 낡은 필드
      const seen = new Set<string>();
      for (let i = 0; i < 200; i++) seen.add(getNpcSmalltalk(s, npcId));
      expect([...seen].filter(l => vac.has(l)), `W${week}`).toEqual([]);
    }
  });
});
