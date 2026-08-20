import { describe, expect, it } from 'vitest';
import { npcAlbum, isSlotFilled, filledPath } from '../npcAlbum';
import { npcStoryRows, soloStoryRow, storyOwners, SOLO_ROOT } from '../npcStoryPool';
import { resolveEventCgRelPaths } from '../eventCg';
import { GAME_EVENTS } from '../events';
import { getSchoolLevel } from '../backgrounds';

const allSlots = (npcId: string) => npcAlbum(npcId).flatMap(b => b.slots);
const bucketKeys = (npcId: string) => npcAlbum(npcId).map(b => b.key);

describe('인물 앨범 슬롯 카탈로그 (npcAlbum)', () => {
  it('앨범이 있는 인물은 로스터 전원이다', () => {
    for (const r of npcStoryRows([])) {
      expect(allSlots(r.id).length, `${r.name}의 앨범이 비었다`).toBeGreaterThan(0);
    }
  });

  // 슬롯 단위가 파일이 아니라 (이벤트, 선택지, 학교급)이어야 하는 이유. 폴백 체인은 `_c` 없는
  // CG를 **모든 choiceIndex**에 되돌려주므로, 그림 서명으로 접지 않으면 선택지 수만큼 칸이
  // 불어난다(지훈 52 → 88로 부푼 것을 실제로 관측했다).
  it('선택지가 달라도 그림이 같으면 한 칸이다', () => {
    // 선택지가 2개 이상이면서 선택지별 CG가 없는 이벤트를 정의에서 찾는다.
    const flat = GAME_EVENTS.find(e => {
      if ((e.choices?.length ?? 0) < 2) return false;
      const paths = new Set<string>();
      for (let ci = 0; ci < e.choices!.length; ci++) {
        for (const y of [1, 2, 3, 4, 5, 6, 7]) {
          const p = resolveEventCgRelPaths(e.id, ci, 'male', y)[0];
          if (p) paths.add(p);
        }
      }
      if (paths.size === 0) return false;
      // 선택지별 변형이 있으면 이 테스트의 대상이 아니다.
      return ![...paths].some(p => /_c\d+/.test(p));
    });
    expect(flat, '전제 붕괴: 선택지별 CG가 없는 다중선택 이벤트가 사라졌다').toBeTruthy();

    const owner = flat!.reach?.npc ?? flat!.speakers?.[0];
    expect(owner, '전제: 그 이벤트에 귀속 인물이 있어야 앨범에 뜬다').toBeTruthy();
    const mine = allSlots(owner!).filter(s => s.eventId === flat!.id);
    // 학교급이 다르면 다른 그림이므로 칸이 여럿일 수 있다. 학교급별로는 정확히 하나여야 한다.
    for (const level of ['elementary', 'middle', 'high'] as const) {
      const n = mine.filter(s => s.level === level).length;
      expect(n, `${flat!.id}의 ${level} 칸이 ${n}개 — 선택지 수만큼 불어났다`).toBeLessThanOrEqual(1);
    }
    expect(mine.length).toBeGreaterThan(0);
  });

  it('같은 버킷 안에 같은 그림이 두 번 들어가지 않는다', () => {
    for (const r of npcStoryRows([])) {
      for (const b of npcAlbum(r.id)) {
        const sigs = b.slots.map(s => s.paths.join('|'));
        expect(new Set(sigs).size, `${r.name}/${b.label}에 중복 칸이 있다`).toBe(sigs.length);
      }
    }
  });

  // 초등은 Y1 하나뿐이라(backgrounds: year<=1) 학년이 항상 확정된다.
  it('초등 그림은 초6 학년 버킷에만 들어간다', () => {
    for (const r of npcStoryRows([])) {
      for (const b of npcAlbum(r.id)) {
        for (const s of b.slots) {
          if (s.level === 'elementary') expect(b.key, `${r.name}: 초등 그림이 ${b.key}에 있다`).toBe('y1');
        }
      }
    }
    expect(bucketKeys('doyun'), '초등 전용 인물은 y1 버킷을 가진다').toContain('y1');
    expect(bucketKeys('doyun'), '초등 버킷에 학교급 행이 생기면 안 된다').not.toContain('elementary');
  });

  it('도달형은 reach.year 학년 버킷에 못박힌다', () => {
    const reach = GAME_EVENTS.filter(e =>
      e.reach?.npc && e.reach.year && e.reach.year > 1 &&
      resolveEventCgRelPaths(e.id, 0, 'male', e.reach.year).length > 0);
    expect(reach.length, '전제: reach.year가 있고 CG가 있는 도달형이 있어야 한다').toBeGreaterThan(0);

    for (const e of reach) {
      const level = getSchoolLevel(e.reach!.year!);
      const slot = allSlots(e.reach!.npc!).find(s => s.eventId === e.id && s.level === level);
      if (!slot) continue;   // 그 학교급 디렉터리에 그림이 없으면 칸이 없다
      const bucket = npcAlbum(e.reach!.npc!).find(b => b.slots.includes(slot))!;
      expect(bucket.key, `${e.id}는 y${e.reach!.year}에 있어야 한다`).toBe(`y${e.reach!.year}`);
    }
  });

  // 학년을 특정할 수 없는 그림(매년 열리는 행사·시험류)은 학년 행이 아니라 그 학교급 행에 담는다.
  it('학년 미정 그림은 학교급 행에 담기고, 그 행에는 다른 학교급이 섞이지 않는다', () => {
    for (const r of npcStoryRows([])) {
      for (const b of npcAlbum(r.id)) {
        if (b.key.startsWith('y')) continue;
        for (const s of b.slots) {
          expect(s.level, `${r.name}/${b.key} 행에 ${s.level} 그림이 섞였다`).toBe(b.key);
        }
      }
    }
    // 지훈은 매년 열리는 행사 때문에 중·고 학교급 행을 둘 다 가진다(실측).
    expect(bucketKeys('jihun')).toContain('middle');
    expect(bucketKeys('jihun')).toContain('high');
  });

  // 없는 칸을 그리면 "못 모은 것"과 "애초에 없는 것"이 구별되지 않는다.
  it('슬롯이 0인 학년 행은 만들지 않는다', () => {
    for (const r of npcStoryRows([])) {
      for (const b of npcAlbum(r.id)) {
        expect(b.slots.length, `${r.name}/${b.label}이 빈 행이다`).toBeGreaterThan(0);
      }
    }
    // 도윤은 전출 인물이라 초등 뒤가 없다. 7행을 무조건 그리면 6행이 빈 행이 된다.
    expect(bucketKeys('doyun')).not.toContain('y5');
    expect(bucketKeys('doyun')).not.toContain('y7');
    // 준하는 고2 전학생이라 초등·중등 행이 없다.
    expect(bucketKeys('junha')).not.toContain('y1');
    expect(bucketKeys('junha')).not.toContain('y3');
  });

  it('버킷 순서는 학년 행 다음에 그 학교급 행이다', () => {
    const ORDER = ['y1', 'elementary', 'y2', 'y3', 'y4', 'middle', 'y5', 'y6', 'y7', 'high'];
    for (const r of npcStoryRows([])) {
      const idx = bucketKeys(r.id).map(k => ORDER.indexOf(k));
      expect(idx.every(i => i >= 0), `${r.name}에 모르는 버킷 키가 있다`).toBe(true);
      for (let i = 1; i < idx.length; i++) {
        expect(idx[i], `${r.name}의 버킷 순서가 어긋났다`).toBeGreaterThan(idx[i - 1]);
      }
    }
  });

  it('도달형은 대상 한 명에게만 귀속된다 (npcStoryPool과 같은 규칙)', () => {
    const e = GAME_EVENTS.find(x =>
      x.reach?.npc === 'seoa' && resolveEventCgRelPaths(x.id, 0, 'male', x.reach.year ?? 5).length > 0);
    expect(e, '전제: CG 있는 서아 도달형이 있어야 한다').toBeTruthy();
    for (const r of npcStoryRows([])) {
      const has = allSlots(r.id).some(s => s.eventId === e!.id);
      expect(has, `${r.name}이 남의 도달형을 앨범에 가졌다`).toBe(r.id === 'seoa');
    }
  });
});

describe('앨범 채움 판정', () => {
  const slotOf = (npcId: string) => allSlots(npcId).find(s => s.paths.length === 2)!;

  it('성별 변형 중 어느 쪽을 봤어도 채워진다', () => {
    const s = slotOf('jihun');
    expect(s, '전제: 남·여 두 경로를 가진 칸이 있어야 한다').toBeTruthy();
    const [male, female] = s.paths;

    expect(isSlotFilled(s, [male]), '남성 경로로 본 칸이 안 채워졌다').toBe(true);
    expect(isSlotFilled(s, [female]), '여성 경로로 본 칸이 안 채워졌다').toBe(true);
    expect(isSlotFilled(s, []), '아무것도 안 봤는데 채워졌다').toBe(false);
    expect(isSlotFilled(s, ['elementary/전혀-다른-그림.png'])).toBe(false);
  });

  it('보여줄 그림은 실제로 본 변형이다', () => {
    const s = slotOf('jihun');
    const [male, female] = s.paths;
    expect(filledPath(s, [female])).toBe(female);
    expect(filledPath(s, [male])).toBe(male);
    expect(filledPath(s, []), '안 본 칸은 그림이 없어야 한다 — 있으면 안 본 그림을 싣는다').toBeNull();
  });

  it('한 판에서 성별을 바꿔도 칸 수는 늘지 않는다', () => {
    const slots = allSlots('jihun');
    const male = slots.flatMap(s => s.paths.filter(p => /_m\.png$/.test(p)));
    const both = slots.flatMap(s => s.paths);
    // 파일을 세면 남·여를 다 해본 사람의 앨범만 칸이 두 배가 된다. 칸은 그보다 적어야 한다.
    expect(slots.length).toBeLessThan(both.length);
    expect(slots.length).toBeGreaterThan(male.length - 1);
  });
});

// 주인 없는 장면(개학·시험·졸업 준비·번아웃·정체성 위기)은 누락이 아니라 실제로 혼자 지나온
// 시간이다. 예전에는 앨범 빌더가 여기서 버려서 **어디에도 뜨지 않았다**(69장 = 전체 CG의 16%).
describe('혼자 지나온 것 (SOLO_ROOT)', () => {
  it('사람 뿌리에 안 붙는 장면은 solo 뿌리로 간다', () => {
    const solo = npcAlbum(SOLO_ROOT);
    expect(solo.length, 'solo 앨범이 비었다 — 주인 없는 장면이 다시 버려지고 있다').toBeGreaterThan(0);
    const slots = solo.flatMap(b => b.slots);
    expect(slots.length).toBeGreaterThan(20);

    // 이 게임에서 가장 무거운 장면들이 여기 있다. 하나라도 빠지면 앨범에서 볼 길이 없다.
    for (const id of ['suneung-eve', 'middle-burnout', 'high-panic', 'identity-crisis', 'graduation-prep-high']) {
      expect(slots.some(s => s.eventId === id), `${id}가 solo 앨범에 없다`).toBe(true);
    }
  });

  it('solo 뿌리와 사람 뿌리는 겹치지 않는다', () => {
    const soloIds = new Set(npcAlbum(SOLO_ROOT).flatMap(b => b.slots).map(s => s.eventId));
    for (const r of npcStoryRows([])) {
      for (const s of npcAlbum(r.id).flatMap(b => b.slots)) {
        expect(soloIds.has(s.eventId), `${s.eventId}가 ${r.name}과 solo 양쪽에 있다`).toBe(false);
      }
    }
  });

  it('solo 줄은 본 것이 있을 때만 셀 수 있다', () => {
    expect(soloStoryRow([]).seen).toBe(0);
    expect(soloStoryRow([]).total).toBeGreaterThan(0);
    expect(soloStoryRow(['suneung-eve']).seen).toBe(1);
    // 사람 이벤트를 봐도 solo 카운트는 안 오른다(뿌리가 섞이면 두 줄이 같은 걸 센다).
    expect(soloStoryRow(['first-week']).seen).toBe(0);
  });

  it('solo 뿌리는 사람 목록에 섞이지 않는다', () => {
    expect(npcStoryRows([]).some(r => r.id === SOLO_ROOT), 'solo가 사람 줄로 새어 들어갔다').toBe(false);
  });
});

// speakers는 "화면에 그려질 사람"이고 storyOf는 "누구의 이야기인가"다. 나누지 않으면
// haeun-distance(떠난 하은이 남긴 편지)를 귀속시키려다 EventScene이 떠난 사람을 다시 세운다.
describe('storyOf 귀속 (화면에 없어도 그 사람 이야기)', () => {
  const known = (id: string) => npcStoryRows([]).some(r => r.id === id);

  it('haeun-distance는 하은에게 귀속되고 speakers에는 넣지 않는다', () => {
    const e = GAME_EVENTS.find(x => x.id === 'haeun-distance')!;
    expect(e, '이벤트가 사라졌다').toBeTruthy();
    expect(e.speakers ?? [], '떠난 하은을 화면에 다시 세우고 있다').toEqual([]);
    expect(e.storyOf).toEqual(['haeun']);
    expect(storyOwners(e, known)).toEqual(['haeun']);

    const inHaeun = npcAlbum('haeun').flatMap(b => b.slots).some(s => s.eventId === 'haeun-distance');
    expect(inHaeun, '하은 앨범에 편지가 없다').toBe(true);
    const inSolo = npcAlbum(SOLO_ROOT).flatMap(b => b.slots).some(s => s.eventId === 'haeun-distance');
    expect(inSolo, '귀속됐는데 solo에도 남아 있다').toBe(false);
    expect(npcStoryRows([]).find(r => r.id === 'haeun')!.total, '하은 이야기 풀에도 들어가야 한다')
      .toBeGreaterThanOrEqual(18);
  });

  it('귀속 우선순위는 reach.npc > storyOf > speakers', () => {
    const reachWin = { id: 'x', title: '', description: '', choices: [],
      reach: { npc: 'seoa', tier: 40 }, storyOf: ['jihun'], speakers: ['subin'] } as unknown as typeof GAME_EVENTS[number];
    expect(storyOwners(reachWin, known)).toEqual(['seoa']);

    const storyWin = { id: 'x', title: '', description: '', choices: [],
      storyOf: ['jihun'], speakers: ['subin'] } as unknown as typeof GAME_EVENTS[number];
    expect(storyOwners(storyWin, known)).toEqual(['jihun']);

    const speakersOnly = { id: 'x', title: '', description: '', choices: [],
      speakers: ['subin'] } as unknown as typeof GAME_EVENTS[number];
    expect(storyOwners(speakersOnly, known)).toEqual(['subin']);

    // 로스터에 없는 id는 무시된다 — 그러면 주인 없는 장면이 되어 solo로 간다.
    const unknownOnly = { id: 'x', title: '', description: '', choices: [],
      storyOf: ['없는사람'], speakers: ['또없는사람'] } as unknown as typeof GAME_EVENTS[number];
    expect(storyOwners(unknownOnly, known)).toEqual([]);
  });
});
