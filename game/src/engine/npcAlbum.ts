// ===== 인물 앨범 — 학년별 슬롯 =====
// 기록실에서 사람 줄을 누르면 열리는 그 사람의 앨범. 프린세스메이커식으로 **빈 칸이 보이고**
// 학년마다 "몇 개 중 몇 개"가 세어진다. 기록실 목록 쪽은 여전히 분모를 감추지만(미접촉 인물),
// 앨범 안에서는 채운 칸/빈 칸을 드러내는 것이 이 화면의 목적이다.
//
// 슬롯 단위 = (이벤트, 선택지, 학교급).
//   왜 파일이 아닌가: 같은 장면이 성별로 두 파일(`_f`/`_m`)이라, 파일을 세면 남·여를 다 해본
//   사람의 앨범만 칸이 두 배로 늘어난다(지훈 실측: 남 52 · 여 52 · 합집합 92 · 공용 12).
//   슬롯을 (이벤트, 선택지, 학교급)으로 두면 칸 수가 성별과 무관하게 고정되고(지훈 52),
//   성별을 바꿔 다시 본 장면은 새 칸이 아니라 같은 칸의 다른 변형이 된다.
//   왜 학교급이 키에 들어가는가: 매년 열리는 행사(#400·#402)는 CG가 학교급별로 따로 있어서
//   같은 (이벤트, 선택지)가 중학교판·고등학교판 두 장이다. 그 둘은 다른 칸이다.
import { GAME_EVENTS } from './events';
import { INITIAL_NPCS } from './npcRoster';
import { getSchoolLevel } from './backgrounds';
import { resolveEventCgRelPaths } from './eventCg';

/** 학교급별 대표 학년 — resolver는 학년을 학교급으로만 쓰므로(eventCg의 getSchoolLevel) 이걸로 충분하다. */
const LEVEL_YEAR = { elementary: 1, middle: 2, high: 5 } as const;
type Level = keyof typeof LEVEL_YEAR;
const LEVELS: Level[] = ['elementary', 'middle', 'high'];

export interface AlbumSlot {
  eventId: string;
  choiceIndex: number;
  level: Level;
  title: string;
  /** 이 칸에 해당하는 성별 변형 경로 전부. 하나라도 본 적 있으면 채워진 칸이다. */
  paths: string[];
}

export interface AlbumBucket {
  /** 안정 키 — 학년 버킷은 `y3`, 학년을 특정할 수 없는 학교급 버킷은 `middle`. */
  key: string;
  label: string;
  slots: AlbumSlot[];
}

// 이 게임의 7년은 초6(Y1) · 중1~3(Y2~4) · 고1~3(Y5~7)이다. 학교급 경계 SSOT는 backgrounds.ts.
const YEAR_LABEL: Record<number, string> = {
  1: '초6', 2: '중1', 3: '중2', 4: '중3', 5: '고1', 6: '고2', 7: '고3',
};
const LEVEL_LABEL: Record<Level, string> = {
  elementary: '초등학교 시절', middle: '중학교 시절', high: '고등학교 시절',
};

/**
 * npcId → 그 사람의 앨범 버킷들. 모듈 로드 시 1회 계산(정적 카탈로그 — 플레이와 무관하다).
 *
 * 학년 배치:
 *   - 초등 CG는 Y1 하나뿐이라(초등=year<=1) 항상 학년이 확정된다.
 *   - `reach.year`가 있고 그 학년의 학교급이 CG의 학교급과 같으면 그 학년으로 못박는다.
 *   - 나머지는 학년을 특정할 수 없다 — 매년 열리는 행사·시험류가 여기 걸리고, CG 자체가
 *     "중2 축제"가 아니라 "중학교 축제" 단위로만 존재한다. 그래서 학년 행이 아니라
 *     그 학교급의 "시절" 행에 담는다. 실측 55장(지훈 13 · 민재 14).
 */
const ALBUM: Map<string, AlbumBucket[]> = (() => {
  // npcId → 버킷키 → 슬롯. 귀속 규칙은 npcStoryPool의 POOL과 같아야 하므로 여기서 복제하지 않고
  // 같은 규칙을 한 번 더 적는 대신, 아래 attribute()가 그 규칙의 단일 표현이다.
  const perNpc = new Map<string, Map<string, AlbumSlot[]>>();
  for (const n of INITIAL_NPCS) perNpc.set(n.id, new Map());

  /** 그 이벤트가 누구의 기록에 잡히는가 — npcStoryPool.POOL과 동일 규칙(도달형은 대상 한 명). */
  const attribute = (e: typeof GAME_EVENTS[number]): string[] => {
    if (e.reach?.npc && perNpc.has(e.reach.npc)) return [e.reach.npc];
    return (e.speakers ?? []).filter(id => perNpc.has(id));
  };

  for (const e of GAME_EVENTS) {
    const owners = attribute(e);
    if (owners.length === 0) continue;   // 화자·대상 없는 장면(19종)은 사람 앨범에 자리가 없다
    const nChoices = Math.max(1, e.choices?.length ?? 1);

    // 같은 (이벤트, 선택지)가 학교급마다 다른 그림을 가질 수 있으므로 학교급별로 칸을 만든다.
    for (const level of LEVELS) {
      // 선택지가 달라도 **그림이 같으면 같은 칸**이다. 폴백 체인이 `_c` 없는 CG를 모든
      // choiceIndex에 되돌려주므로, 그림 서명으로 접지 않으면 선택지 수만큼 칸이 불어난다
      // (지훈 52 → 88로 부풀었다). 대표 choiceIndex는 가장 작은 값을 쓴다.
      const bySignature = new Map<string, AlbumSlot>();
      for (let ci = 0; ci < nChoices; ci++) {
        const paths: string[] = [];
        for (const gender of ['male', 'female'] as const) {
          // 적립층이 실제로 저장하는 값과 같아야 한다 — resolveCg가 폴백 체인의 첫 항목만 쓴다.
          const top = resolveEventCgRelPaths(e.id, ci, gender, LEVEL_YEAR[level])[0];
          if (top && top.startsWith(`${level}/`) && !paths.includes(top)) paths.push(top);
        }
        if (paths.length === 0) continue;
        const signature = paths.join('|');
        if (bySignature.has(signature)) continue;
        bySignature.set(signature, { eventId: e.id, choiceIndex: ci, level, title: e.title, paths });
      }
      if (bySignature.size === 0) continue;

      const year = level === 'elementary' ? 1
        : (e.reach?.year && getSchoolLevel(e.reach.year) === level ? e.reach.year : null);
      const key = year === null ? level : `y${year}`;
      for (const slot of bySignature.values()) {
        for (const npcId of owners) {
          const buckets = perNpc.get(npcId)!;
          const list = buckets.get(key);
          if (list) list.push(slot); else buckets.set(key, [slot]);
        }
      }
    }
  }

  // 버킷 순서: 학년 행을 먼저, 그 학교급의 "시절" 행을 그 뒤에. 슬롯이 0인 행은 만들지 않는다
  // (도윤은 초6 외 6개 학년이 0칸이고, 준하는 고3 하나뿐이다 — 없는 칸을 그리면 "못 모은 것"과
  //  "애초에 없는 것"이 구별되지 않는다).
  const ORDER: { key: string; label: string }[] = [
    { key: 'y1', label: YEAR_LABEL[1] }, { key: 'elementary', label: LEVEL_LABEL.elementary },
    { key: 'y2', label: YEAR_LABEL[2] }, { key: 'y3', label: YEAR_LABEL[3] }, { key: 'y4', label: YEAR_LABEL[4] },
    { key: 'middle', label: LEVEL_LABEL.middle },
    { key: 'y5', label: YEAR_LABEL[5] }, { key: 'y6', label: YEAR_LABEL[6] }, { key: 'y7', label: YEAR_LABEL[7] },
    { key: 'high', label: LEVEL_LABEL.high },
  ];

  const out = new Map<string, AlbumBucket[]>();
  for (const [npcId, buckets] of perNpc) {
    out.set(npcId, ORDER
      .filter(o => (buckets.get(o.key)?.length ?? 0) > 0)
      .map(o => ({ key: o.key, label: o.label, slots: buckets.get(o.key)! })));
  }
  return out;
})();

/** 그 사람의 앨범 버킷들(정적). 없는 npcId면 빈 배열. */
export function npcAlbum(npcId: string): AlbumBucket[] {
  return ALBUM.get(npcId) ?? [];
}

/** 이 칸을 본 적이 있나 — 성별 변형 중 하나라도 적립돼 있으면 채운 칸이다. */
export function isSlotFilled(slot: AlbumSlot, seenCgFiles: readonly string[]): boolean {
  return slot.paths.some(p => seenCgFiles.includes(p));
}

/** 그 칸에 실제로 보여줄 그림 — 본 변형 중 하나. 안 본 칸이면 null. */
export function filledPath(slot: AlbumSlot, seenCgFiles: readonly string[]): string | null {
  return slot.paths.find(p => seenCgFiles.includes(p)) ?? null;
}
