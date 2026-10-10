// 학교 장면은 방학에 뜨지 않는다 — 장소·배경 층과 문장(변이) 층 둘 다. (2026-10 장르 진단)
//
// 결함의 모양(실코드 확인):
//   · good-grade — 조건이 `week % 8 === 0`뿐이라 W24·W48(방학 주)에 교실·선생님 장면이 떴다.
//   · music-discovery·fatigue-warning — 집 장면이라 방학에도 뜨는 게 맞는데, 변이 문장이
//     「학교 방송」「짝꿍」「쉬는 시간」「오늘 학교 가기 싫다」「1교시」「야자」를 말했다.
//     이 둘은 조건에 방학 가드를 걸면 효과(피로 −10 회복 등)까지 방학에서 사라져 밸런스가 움직인다.
//     그래서 말걸기 계절 축과 같은 기준(학교의 장소·시간·일과가 소재면 학기 전용)으로 **변이에**
//     season 태그를 달고, presentEvent가 계절이 안 맞는 변이를 거른다.
//
// 잠그는 계약:
//   A. 장소·배경이 학교인 사건이 방학 주에 조건을 통과하면 **장부(VACATION_SCHOOL_SCENE_LEDGER)와
//      정확히 같아야 한다.** 새로 생기면 빨강, 장부의 항목이 더는 안 뜨면(고쳤으면) 장부도 지우라고 빨강.
//   B. 방학에 뜰 수 있는 변이 사건은 방학 주에 **화면에 나가는 문장**이 학교 어휘를 안 쓴다.
//      태그는 양방향으로 본다 — 'semester'를 단 변이는 실제로 학교 어휘를 써야 한다(헛태그는 문장을 버린다).
//
// 조건 탐침은 근사다: 능력치·피로·성별·친밀도를 넓게 흔들지만 사건 이력(반장 당선 등)은 안 만든다.
// 그래서 A는 "적어도 이만큼은 뜬다"의 하한이고, 탐침이 죽지 않았다는 건 학기 주 양성 대조로 확인한다.
import { describe, expect, it } from 'vitest';
import { GAME_EVENTS } from '../events';
import { SCHOOL_LIFE_EVENTS } from '../events/school-life';
import { pickVariantIndex, presentEvent, schoolBandForYear } from '../eventPresentation';
import { createInitialState } from '../gameEngine';
import { getSeason, getWeekInfo } from '../weekMath';
import type { EventTextVariant, GameEvent, GameState, SchoolBand } from '../types';

const POOL = [...GAME_EVENTS, ...SCHOOL_LIFE_EVENTS] as readonly GameEvent[];
const BANDS: SchoolBand[] = ['elementary', 'middle', 'high'];
const YEARS = [1, 2, 3, 4, 5, 6, 7];
const ALL_WEEKS = Array.from({ length: 48 }, (_, i) => i + 1);
const VACATION_WEEKS = ALL_WEEKS.filter(w => getWeekInfo(w).isVacation);
const SEMESTER_WEEKS = ALL_WEEKS.filter(w => !getWeekInfo(w).isVacation);

const SCHOOL_LOCATIONS = new Set(['classroom', 'hallway', 'rooftop', 'gym', 'school_gate', 'music_room', 'auditorium']);
const SCHOOL_BG = /classroom|school|hallway|rooftop|gym|auditorium|cafeteria/;

function isSchoolScene(e: GameEvent): boolean {
  return (!!e.location && SCHOOL_LOCATIONS.has(e.location)) || SCHOOL_BG.test(e.background ?? '');
}

// 학교의 장소·시간·일과 — 말걸기 계절 축(talkSeasonGate)과 같은 기준의 사건 문장판.
const SCHOOL_LEX = /학교|교실|쉬는 시간|짝꿍|체육 시간|수업|교시|야자|자습실|모의고사|교복|결석|지각|담임|급식|점심시간|반 애들|복도|등교|하교|종례|선생님/;

function probeStates(year: number, week: number): GameState[] {
  const out: GameState[] = [];
  for (const v of [10, 50, 95]) {
    for (const fatigue of [0, 90]) {
      for (const gender of ['male', 'female'] as const) {
        const s = createInitialState(gender, ['wealth', 'freedom'], { rngSeed: 1 });
        s.year = year;
        s.week = week;
        const info = getWeekInfo(week);
        s.semester = info.semester;
        s.isVacation = info.isVacation;
        for (const k of Object.keys(s.stats) as (keyof GameState['stats'])[]) s.stats[k] = v;
        s.fatigue = fatigue;
        for (const n of s.npcs) { n.met = true; n.intimacy = v; }
        out.push(s);
      }
    }
  }
  return out;
}

const STATES = new Map<string, GameState[]>();
function statesAt(year: number, week: number): GameState[] {
  const key = `${year}:${week}`;
  let v = STATES.get(key);
  if (!v) { v = probeStates(year, week); STATES.set(key, v); }
  return v;
}

function firesAt(e: GameEvent, year: number, week: number): boolean {
  if (e.week !== undefined && e.week !== week) return false;
  return statesAt(year, week).some(s => {
    try { return e.condition ? !!e.condition(s) : true; } catch { return false; }
  });
}

function firesInWeeks(e: GameEvent, weeks: number[]): boolean {
  return YEARS.some(y => weeks.some(w => firesAt(e, y, w)));
}

// 방학에 조건을 통과하는 학교 장면 — 판정이 끝난 것만 둔다(2026-10 #511 pending 13건 정리).
//   calendar    : 달력이 방학 쪽에 걸친 학교 행사(졸업식·졸업 준비·방학식·합격 발표 무렵). 의도.
//   vacation-text: 방학에도 뜨는 게 맞고(아래 이유), 방학 판본 지문이 "방학인데 왜 학교·교복인가"를 말한다(C가 잠근다).
//
// **도달형(reach)에는 조건 가드를 걸지 말 것.** 도달형은 임계를 넘은 주(fresh)에만 쿨다운을 면제받는다.
// 겨울방학(W43~48)에 넘은 판은 가드가 fresh 창을 닫고, 그 해 남은 학기 주가 없어 컷을 영영 잃는다 —
// scripts/sim/probe-reach-vacation-crossing.ts: 장부의 도달형 10건 전부 교차주 6/48에서 유실(쿨다운 진행 중이면 11/48).
// 그래서 졸업·합격 무렵 장면은 calendar, 등교일 장면은 vacation-text다. 가드를 걸면 A가 "장부에서 지우라"고
// 빨개지는데, 지우지 말고 가드를 되돌릴 것.
// good-grade·mental-low·doyun-comic-share·identity-crisis는 여기 없다 — 비도달형이라 가드를 넣었다.
const VACATION_SCHOOL_SCENE_LEDGER: Record<string, 'calendar' | 'vacation-text'> = {
  'elementary-graduation': 'calendar',
  'middle-school-graduation': 'calendar',
  'high-school-graduation': 'calendar',
  'haeun-graduation': 'calendar',
  'doyun-graduation-sign': 'calendar',
  'graduation-prep-elementary': 'calendar',
  'graduation-prep-high': 'calendar',
  'winter-start': 'calendar',
  'yuna-window-promise': 'calendar',
  'subin-paper-airplane': 'calendar',
  'junha-hs-farewell': 'calendar',
  // 도달형 졸업·합격 무렵 — 하은 졸업식(Y6)·중학 졸업식(Y4)·고교 졸업식(Y7)·졸업 직전 옥상·합격자 발표 시즌.
  // 겨울방학이 제자리다. (학기 초에 뜨는 건 별개의 시점 문제 — 방학 축이 아니다.)
  'haeun-hs-leaving': 'calendar',
  'seoa-torn-endless-line': 'calendar',
  'seoa-ending-page': 'calendar',
  'siwoo-where-you-stood': 'calendar',
  'yerin-not-a-trade': 'calendar',
  'subin-hs-after': 'calendar',
  // 도달형 등교일 장면 — CG가 교복이라 장소를 옮기지 않는다. 방학엔 방과후·보충·도서관 개방일로 나온 날.
  'haeun-brothers-book': 'vacation-text',
  'jihun-new-shoes': 'vacation-text',
  'minjae-dawn-on-hand': 'vacation-text',
  'siwoo-demolished-ground': 'vacation-text',
};

describe('A. 학교 장면(장소·배경) — 방학 주 조건', () => {
  const schoolScenes = POOL.filter(isSchoolScene);

  it('탐침이 살아 있다 — 학기 주에는 학교 장면이 넓게 뜬다(양성 대조)', () => {
    // 모수 자체가 0이면 아래가 전부 공허하게 초록이다.
    expect(schoolScenes.length, '학교 장면 모수').toBeGreaterThanOrEqual(180);
    const semesterReach = schoolScenes.filter(e => firesInWeeks(e, SEMESTER_WEEKS));
    expect(semesterReach.length, '학기 주에 탐침이 닿은 학교 장면 수').toBeGreaterThanOrEqual(150);
    // 이번에 고친 사건은 학기엔 닿아야 한다 — 안 닿으면 "방학에 안 뜬다"가 공허하다.
    const goodGrade = POOL.find(e => e.id === 'good-grade');
    expect(goodGrade && firesInWeeks(goodGrade, SEMESTER_WEEKS), 'good-grade 학기 도달').toBe(true);
  });

  it('good-grade — 8주 주기가 방학 주(W24·W48)에 걸려도 교실 장면이 안 뜬다', () => {
    const e = POOL.find(x => x.id === 'good-grade')!;
    for (const y of YEARS) {
      for (const w of [24, 48]) {
        expect(firesAt(e, y, w), `good-grade Y${y}W${w}`).toBe(false);
      }
    }
  });

  it('방학 주에 뜨는 학교 장면 = 장부 (새로 생기면 빨강, 고쳤으면 장부에서 지울 것)', () => {
    const fired = schoolScenes.filter(e => firesInWeeks(e, VACATION_WEEKS)).map(e => e.id).sort();
    expect(fired).toEqual(Object.keys(VACATION_SCHOOL_SCENE_LEDGER).sort());
  });
});

function variantTexts(v: EventTextVariant): string[] {
  return [
    v.description, v.femaleDescription ?? '',
    ...v.choices.flatMap(c => [c.text, c.message, c.femaleText ?? '', c.femaleMessage ?? '']),
  ].filter(Boolean);
}

function presentedTexts(e: GameEvent): string[] {
  return [e.description, e.femaleDescription ?? '', ...e.choices.flatMap(c => [c.text, c.message])].filter(Boolean);
}

describe('B. 방학에 뜨는 변이 사건 — 화면에 나가는 문장', () => {
  const variantEvents = POOL.filter(e => e.schoolVariants);
  const vacationReach = variantEvents.filter(e => firesInWeeks(e, VACATION_WEEKS));

  it('모수 — 방학에 닿는 변이 사건에 fatigue-warning·music-discovery가 있다', () => {
    // 탐침이 이 둘에 못 닿으면 아래 단언은 검사 0건으로 초록이다.
    const ids = vacationReach.map(e => e.id);
    expect(ids).toEqual(expect.arrayContaining(['fatigue-warning', 'music-discovery']));
  });

  it('양성 대조 — 어휘 탐지가 고치기 전 문장을 실제로 잡는다', () => {
    for (const t of ['학교 방송에서 나온 노래', '쉬는 시간 내내 이어폰을', '"오늘 학교 가기 싫다..."', '1교시부터 책상에 엎드렸다', '야자 때 들어봐']) {
      expect(SCHOOL_LEX.test(t), t).toBe(true);
    }
  });

  it('방학 주 전수 — presentEvent가 내보낸 문장에 학교 어휘가 없다', () => {
    const leaks: string[] = [];
    let checked = 0;
    for (const e of vacationReach) {
      for (const year of YEARS) {
        for (const week of VACATION_WEEKS) {
          if (!firesAt(e, year, week)) continue;
          for (const gender of ['male', 'female'] as const) {
            checked++;
            for (const t of presentedTexts(presentEvent(e, { year, week, gender }))) {
              const m = t.match(SCHOOL_LEX);
              if (m) leaks.push(`${e.id} Y${year}W${week} ${gender} 「${m[0]}」 ${t.slice(0, 30)}`);
            }
          }
        }
      }
    }
    // 7학년 × 방학 11주 × 2성별 × 2사건 = 308. 이보다 적으면 탐침이 주를 놓친 것이다.
    expect(checked, '검사한 (사건·주·성별) 수').toBeGreaterThanOrEqual(308);
    expect(leaks.slice(0, 10), `방학에 학교 문장 ${leaks.length}건`).toEqual([]);
  });

  it('태그 양방향 — semester 태그는 학교 어휘를 쓰고, 방학에 남는 변이는 안 쓴다', () => {
    const wrong: string[] = [];
    for (const e of vacationReach) {
      for (const b of BANDS) {
        e.schoolVariants![b].forEach((v, i) => {
          const hit = variantTexts(v).some(t => SCHOOL_LEX.test(t));
          if (v.season === 'semester' && !hit) wrong.push(`${e.id}/${b}[${i}] semester인데 학교 어휘가 없다(헛태그)`);
          if (v.season !== 'semester' && hit) wrong.push(`${e.id}/${b}[${i}] 방학에 남는데 학교 어휘가 있다`);
        });
      }
    }
    expect(wrong).toEqual([]);
  });

  it('방학에 남는 변이가 학교급마다 둘 이상 — 하나면 방학 내내 같은 문장이다', () => {
    for (const e of vacationReach) {
      for (const b of BANDS) {
        const n = e.schoolVariants![b].filter(v => v.season !== 'semester').length;
        expect(n, `${e.id}/${b} 방학 변이 수`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('학기 주 문장은 방학 판본 도입 전과 같다 — 학기 로테이션은 그대로', () => {
    // 학기엔 'vacation' 변이만 빠지고 나머지가 원래 순서라 인덱스가 같아야 한다.
    // (계절 필터를 지우면 방학 판본이 학기 로테이션에 섞여 여기서 빨강이 된다.)
    for (const e of vacationReach) {
      for (const year of YEARS) {
        const original = e.schoolVariants![schoolBandForYear(year)].filter(v => v.season !== 'vacation');
        for (const week of SEMESTER_WEEKS) {
          const shown = presentEvent(e, { year, week, gender: 'male' }).description;
          const want = original[pickVariantIndex(year, week, original.length)].description;
          expect(shown, `${e.id} Y${year}W${week}`).toBe(want);
          expect(shown.match(/방학/), `${e.id} Y${year}W${week} 학기에 방학 문장`).toBeNull();
        }
      }
    }
  });
});

// ===== C. 방학 판본(vacationText) — 로테이션 없는 장면의 계절 축 =====
// school: 학교 장면(장부 vacation-text + 탐지기 밖의 정류장 장면). 방학 지문이 학교에 나온 사유를 말한다.
// home  : 집 장면. 방학에 화면에 나가는 문장에 학교 어휘가 없다(B와 같은 기준).
const VACATION_TEXT: Record<string, 'school' | 'home'> = {
  'haeun-brothers-book': 'school',
  'jihun-new-shoes': 'school',
  'minjae-dawn-on-hand': 'school',
  'siwoo-demolished-ground': 'school',
  // 배경(bus_stop_evening)이 탐지기에 안 걸리지만 「하굣길」·명찰·교복 CG — 등교일 장면이다.
  'subin-name-or-school': 'school',
  // 집 장면 — 선택지 「내일 학교에서 말해」만 방학엔 거짓이었다.
  'subin-night-light': 'home',
};
// 학기 일과 — 방학 판본이 남기면 안 되는 말(SCHOOL_LEX보다 좁다: 방학 판본은 '학교'·'수업'을 정당하게 쓴다).
const SEMESTER_ROUTINE = /등굣길|하굣길|등교|하교|쉬는 시간|점심시간|야자|종례|내일 학교/;

function shownTexts(e: GameEvent, gender: 'male' | 'female'): string[] {
  const choices = gender === 'female' && e.femaleChoices ? e.femaleChoices : e.choices;
  const desc = gender === 'female' && e.femaleDescription ? e.femaleDescription : e.description;
  return [desc, ...choices.flatMap(c => [c.text, c.message])].filter(Boolean);
}

function choiceSkeleton(c: GameEvent['choices'][number]): unknown {
  const { text: _t, message: _m, ...rest } = c;
  void _t; void _m;
  return JSON.parse(JSON.stringify(rest));
}

describe('C. 방학 판본(vacationText)', () => {
  const withText = POOL.filter(e => e.vacationText);
  const vacWeeksOf = (e: GameEvent) => YEARS.flatMap(y => VACATION_WEEKS.filter(w => firesAt(e, y, w)).map(w => [y, w] as const));

  it('방학 판본을 단 사건 = 목록, 장부의 vacation-text는 전부 학교 장면으로 들어 있다', () => {
    expect(withText.map(e => e.id).sort()).toEqual(Object.keys(VACATION_TEXT).sort());
    for (const [id, kind] of Object.entries(VACATION_SCHOOL_SCENE_LEDGER)) {
      if (kind === 'vacation-text') expect(VACATION_TEXT[id], `${id}`).toBe('school');
    }
  });

  it('양성 대조 — 학기 일과 탐지가 고치기 전 문장을 잡는다', () => {
    for (const t of ['아침 등굣길, 민재가', '하굣길 시내버스 정류장', '"힘들면 내일 학교에서 말해" — 적는다']) {
      expect(SEMESTER_ROUTINE.test(t), t).toBe(true);
    }
  });

  it('방학 주 전수 — 화면에 나가는 문장이 방학 판본이다(학교 장면은 사유를, 집 장면은 학교 어휘 없음)', () => {
    const bad: string[] = [];
    let checked = 0;
    for (const e of withText) {
      for (const [year, week] of vacWeeksOf(e)) {
        for (const gender of ['male', 'female'] as const) {
          checked++;
          const texts = shownTexts(presentEvent(e, { year, week, gender }), gender);
          const at = `${e.id} Y${year}W${week} ${gender}`;
          for (const t of texts) {
            const m = t.match(SEMESTER_ROUTINE);
            if (m) bad.push(`${at} 학기 일과 「${m[0]}」`);
            if (VACATION_TEXT[e.id] === 'home' && SCHOOL_LEX.test(t)) bad.push(`${at} 집 장면에 학교 어휘 「${t.match(SCHOOL_LEX)![0]}」`);
          }
          if (VACATION_TEXT[e.id] === 'school' && !/방학/.test(texts[0])) bad.push(`${at} 지문이 방학을 말하지 않는다`);
        }
      }
    }
    // 6건 × 각자의 학년 1개 × 방학 11주 × 2성별 = 132. 적으면 탐침이 그 학년·주에 못 닿은 것이다.
    expect(checked, '검사한 (사건·주·성별) 수').toBeGreaterThanOrEqual(132);
    expect(bad.slice(0, 10), `방학 판본 위반 ${bad.length}건`).toEqual([]);
  });

  it('학기 주 문장은 원본 그대로 — 방학 판본이 학기에 새지 않는다', () => {
    let checked = 0;
    for (const e of withText) {
      for (const year of YEARS) {
        for (const week of SEMESTER_WEEKS) {
          if (!firesAt(e, year, week)) continue;
          for (const gender of ['male', 'female'] as const) {
            checked++;
            const { vacationText: _vt, ...plain } = e;
            void _vt;
            expect(shownTexts(presentEvent(e, { year, week, gender }), gender), `${e.id} Y${year}W${week} ${gender}`)
              .toEqual(shownTexts(presentEvent(plain as GameEvent, { year, week, gender }), gender));
          }
        }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(6 * 37 * 2);
  });

  it('효과 불변 — 방학 판본은 문장만 바꾼다(선택지의 효과·조건·기억은 원본)', () => {
    for (const e of withText) {
      const [year, week] = vacWeeksOf(e)[0];
      expect(getSeason(week)).toBe('vacation');
      for (const gender of ['male', 'female'] as const) {
        const shown = presentEvent(e, { year, week, gender });
        const src = gender === 'female' && e.femaleChoices ? e.femaleChoices : e.choices;
        const got = gender === 'female' && shown.femaleChoices ? shown.femaleChoices : shown.choices;
        expect(got.map(choiceSkeleton), `${e.id} ${gender}`).toEqual(src.map(choiceSkeleton));
      }
    }
  });

  it('여성 경로 — store가 집는 femaleChoices에도 방학 문장이 닿는다', () => {
    // GameScreen·resolveEvent는 여성일 때 femaleChoices를 직접 읽는다. choices만 덮으면 화면은 학기 문장이다.
    const e = POOL.find(x => x.id === 'subin-night-light')!;
    expect(e.femaleChoices, 'subin-night-light femaleChoices 전제').toBeDefined();
    const shown = presentEvent(e, { year: 1, week: 22, gender: 'female' });
    expect(shown.femaleChoices![1].text).toBe(shown.choices[1].text);
    expect(shown.femaleChoices![1].text).not.toMatch(/학교/);
  });

  it('카탈로그에 여성 지문이 있으면 방학 판본도 여성 지문을 갖는다', () => {
    for (const e of withText) {
      if (e.femaleDescription && e.vacationText!.description) {
        expect(e.vacationText!.femaleDescription, `${e.id} 방학 판본 여성 지문`).toBeDefined();
      }
    }
  });
});
