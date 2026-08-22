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
//
// 성별은 **칸이 아니라 판본**이다. 한 칸이 남주판·여주판 두 그림을 갖고, 화면은 한 번에 한
// 판본만 센다(albumFor). 판본을 합쳐서 "하나라도 봤으면 채움"으로 두면 실측 172칸 — 그림
// 424장 중 40% — 이 앨범에서 영구히 안 보인다: 여주로 다 모은 뒤 남주로 다시 다 모아도
// 칸이 이미 채워져 있어 앨범이 그대로다. 그래서 판본별로 따로 센다.
import { GAME_EVENTS } from './events';
import { INITIAL_NPCS } from './npcRoster';
import { getSchoolLevel } from './backgrounds';
import { resolveEventCgRelPaths } from './eventCg';
import { SOLO_ROOT, storyOwners } from './npcStoryPool';
import type { Gender } from './types';

/** 학교급별 대표 학년 — resolver는 학년을 학교급으로만 쓰므로(eventCg의 getSchoolLevel) 이걸로 충분하다. */
const LEVEL_YEAR = { elementary: 1, middle: 2, high: 5 } as const;
type Level = keyof typeof LEVEL_YEAR;
const LEVELS: Level[] = ['elementary', 'middle', 'high'];

export interface AlbumSlot {
  eventId: string;
  choiceIndex: number;
  level: Level;
  title: string;
  /**
   * 판본별 그림 경로. 주인공이 그려지지 않은 공용 그림은 둘이 **같은 경로**이고(실측 76칸),
   * 그 성별로는 열리지 않는 장면은 null이다(도윤 첫 만남 4칸 — 남주판·여주판이 다른 이벤트다).
   */
  male: string | null;
  female: string | null;
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
  // 뿌리 → 버킷키 → 슬롯. 귀속 판정은 **npcStoryPool.storyOwners 하나**를 쓴다 — 여기서 규칙을
  // 복제하면 기록실의 커버리지 분모와 앨범 내용이 조용히 어긋난다.
  const perRoot = new Map<string, Map<string, AlbumSlot[]>>();
  for (const n of INITIAL_NPCS) perRoot.set(n.id, new Map());
  const isNpc = (id: string) => perRoot.has(id);
  // 주인 없는 장면(개학·시험·졸업 준비·번아웃·정체성 위기 등 18종/66장)도 자기 뿌리를 갖는다.
  // 예전에는 여기서 버려서 앨범 어디에도 뜨지 않았다.
  perRoot.set(SOLO_ROOT, new Map());

  for (const e of GAME_EVENTS) {
    const named = storyOwners(e, isNpc);
    const owners = named.length > 0 ? named : [SOLO_ROOT];
    const nChoices = Math.max(1, e.choices?.length ?? 1);

    // 같은 (이벤트, 선택지)가 학교급마다 다른 그림을 가질 수 있으므로 학교급별로 칸을 만든다.
    for (const level of LEVELS) {
      // 선택지가 달라도 **그림이 같으면 같은 칸**이다. 폴백 체인이 `_c` 없는 CG를 모든
      // choiceIndex에 되돌려주므로, 그림 서명으로 접지 않으면 선택지 수만큼 칸이 불어난다
      // (지훈 52 → 88로 부풀었다). 대표 choiceIndex는 가장 작은 값을 쓴다.
      const bySignature = new Map<string, AlbumSlot>();
      for (let ci = 0; ci < nChoices; ci++) {
        // 적립층이 실제로 저장하는 값과 같아야 한다 — resolveCg가 폴백 체인의 첫 항목만 쓴다.
        const top = (gender: Gender) => {
          const p = resolveEventCgRelPaths(e.id, ci, gender, LEVEL_YEAR[level])[0];
          return p && p.startsWith(`${level}/`) ? p : null;
        };
        const male = top('male');
        const female = top('female');
        if (!male && !female) continue;
        // 서명에 판본을 **둘 다** 넣는다 — 한쪽만 넣으면 공용 그림을 공유하는 선택지들이
        // 접히지 않거나, 반대로 판본이 다른 칸이 같은 칸으로 접힌다.
        const signature = `${male}|${female}`;
        if (bySignature.has(signature)) continue;
        bySignature.set(signature, { eventId: e.id, choiceIndex: ci, level, title: e.title, male, female });
      }
      if (bySignature.size === 0) continue;

      const year = level === 'elementary' ? 1
        : (e.reach?.year && getSchoolLevel(e.reach.year) === level ? e.reach.year : null);
      const key = year === null ? level : `y${year}`;
      for (const slot of bySignature.values()) {
        for (const npcId of owners) {
          const buckets = perRoot.get(npcId)!;
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
  for (const [npcId, buckets] of perRoot) {
    out.set(npcId, ORDER
      .filter(o => (buckets.get(o.key)?.length ?? 0) > 0)
      .map(o => ({ key: o.key, label: o.label, slots: buckets.get(o.key)! })));
  }
  return out;
})();

/** 그 사람의 앨범 버킷들(정적, 판본 무관 전체). 없는 npcId면 빈 배열. */
export function npcAlbum(npcId: string): AlbumBucket[] {
  return ALBUM.get(npcId) ?? [];
}

/** 그 판본에서 이 칸의 그림 경로. 그 성별로는 없는 칸이면 null. */
export function slotPath(slot: AlbumSlot, gender: Gender): string | null {
  return gender === 'male' ? slot.male : slot.female;
}

/**
 * 한 판본의 앨범 — 그 성별에 **존재하는 칸만** 남기고, 그래서 빈 행이 되면 행도 지운다.
 * 없는 칸을 빈 칸으로 그리면 "아직 못 모은 것"과 "그 판본엔 애초에 없는 것"이 구별되지 않는다
 * (도윤 첫 만남이 그 경우다 — 남주판 2칸과 여주판 2칸이 서로 다른 이벤트다).
 */
export function albumFor(npcId: string, gender: Gender): AlbumBucket[] {
  return npcAlbum(npcId)
    .map(b => ({ ...b, slots: b.slots.filter(s => slotPath(s, gender) !== null) }))
    .filter(b => b.slots.length > 0);
}

/** 이 칸의 그 판본을 본 적이 있나. */
export function isSlotFilled(slot: AlbumSlot, seenCgFiles: readonly string[], gender: Gender): boolean {
  const p = slotPath(slot, gender);
  return p !== null && seenCgFiles.includes(p);
}

/** 그 칸에 실제로 보여줄 그림 — 그 판본을 봤을 때만. 안 본 칸이면 null. */
export function filledPath(slot: AlbumSlot, seenCgFiles: readonly string[], gender: Gender): string | null {
  const p = slotPath(slot, gender);
  return p !== null && seenCgFiles.includes(p) ? p : null;
}

/**
 * 앨범을 처음 열 때 보여줄 판본 — 적립된 그림 파일의 접미사로 판단한다. 기록에는 성별이
 * 남지 않으므로(archive는 판별 정보를 저장하지 않는다) 실제로 모은 그림이 유일한 근거다.
 *
 * 사람마다 다시 계산하지 않고 기록 전체로 한 번 정하는 이유: 앨범마다 첫 탭이 바뀌면
 * 목록을 훑는 동안 판본이 멋대로 갈아치워진다. 동수·0장이면 남주판(성별 선택 화면의 왼쪽).
 */
export function dominantGender(seenCgFiles: readonly string[]): Gender {
  let f = 0;
  for (const p of seenCgFiles) if (p.endsWith('_f.png')) f++; else if (p.endsWith('_m.png')) f--;
  return f > 0 ? 'female' : 'male';
}
