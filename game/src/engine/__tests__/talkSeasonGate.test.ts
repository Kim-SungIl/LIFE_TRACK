import { describe, expect, it } from 'vitest';
import { getNpcSmalltalk, getAvailableNpcEvents } from '../talkSystem';
import { NPC_SMALLTALK, type SmalltalkTiers, type GenderedPool } from '../talkData/npcSmalltalk';
import { NPC_MINI_EVENTS } from '../talkData/miniEvents';
import { GAME_EVENTS } from '../events';
import { getWeekInfo } from '../gameEngine';
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
/** corpus 하한 — 분류가 통째로 지워지면 이 게이트가 제 손으로 초록이 된다. */
const SCHOOL_ONLY_FLOOR = 90;
const VACATION_ONLY_FLOOR = 25;
const SEMESTER_MINI_FLOOR = 10;

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
  jihun: { schoolOnly: 41, vacationOnly: 3 },
  subin: { schoolOnly: 4, vacationOnly: 3 },
  minjae: { schoolOnly: 5, vacationOnly: 3 },
  yuna: { schoolOnly: 7, vacationOnly: 3 },
  doyun: { schoolOnly: 24, vacationOnly: 6 },
  haeun: { schoolOnly: 3, vacationOnly: 3 },
  junha: { schoolOnly: 4, vacationOnly: 3 },
  seoa: { schoolOnly: 5, vacationOnly: 3 },
  siwoo: { schoolOnly: 9, vacationOnly: 5 },
  yerin: { schoolOnly: 2, vacationOnly: 3 },
};

const SEMESTER_MINI_IDS = [
  'talk_jihun_badminton', 'talk_doyun_soccer', 'talk_doyun_classroom',
  'talk_haeun_50_window', 'talk_junha_50_seabreeze', 'talk_jihun_70_locker',
  'talk_yuna_70_chalk_dust', 'talk_haeun_70_direction', 'talk_junha_70_speech',
  'talk_jihun_90_bench', 'talk_minjae_90_unmasked',
  'talk_siwoo_50_linked_corridor', 'talk_siwoo_70_dry_route',
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
  // vacationOnly는 새로 쓴 작은 풀이라, 모호하지 않은 표지만 좁게 막는다. base 풀엔 적용하지 않는다
  //  — 거긴 회상·일반론이 정상적으로 학교 낱말을 쓴다("체육 시간에 너 움직임 좋더라").
  const SCHOOL_MARKERS = ['급식', '사물함', '쉬는 시간', '점심시간', '야자', '교실', '칠판', '매점', '담임'];

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

  it('방학 전용 대사에 학교 한정 표지가 없다', () => {
    for (const [npc, pool] of Object.entries(NPC_SMALLTALK)) {
      for (const level of LEVELS) for (const gender of GENDERS) {
        for (const line of spread(pool.vacationOnly, gender, level, 70)) {
          const hit = SCHOOL_MARKERS.filter(m => line.includes(m));
          expect(hit, `${npc}: ${line}`).toEqual([]);
        }
      }
    }
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
