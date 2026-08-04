// NPC 엔딩 클로저 — "그리고 그 후"의 NPC별 전용 문장 + 결정적 선택(resolvedChoice) 해석.
// ending.ts getTopNpcStories 에서 소비. 설계·3자 리뷰 판정: tmp/npc-ending-motif-design.md (v2).
//
// 원칙:
// - 티어 프레임(best/good/faint)은 장면 무지시(ambient) 문장만. grind 소프트캡 80 아래서는
//   동행·선물만으로 누구나 도달 가능한 구간이라, 특정 장면을 지시하면 그 장면을 안 본 런에 거짓이 된다.
// - 장면·선택을 지시하는 문장은 전부 variant(chose/fired 게이트) 뒤에 둔다. variant는 위에서부터
//   첫 매치 — 구체 조건이 앞. 매치 시 sourceEvents 발 recallText 를 회상 후보에서 제외해
//   "프레임=회상" 동문반복을 막는다.
// - 도윤은 전출 후 상호작용 불가(말 걸기·선물 게이트 = relationshipSignals.isNpcInteractable) +
//   주간 자연 감쇠(floor 20)로 엔딩 시점 친밀도가 항상 20대라 티어 흐름으로는 영구 사문 —
//   친밀도 무관 이력 게이트의 별도 레인(departed)으로 회수한다.
import { GameState } from './types';

// ===== 이벤트 이력 조회 — resolvedChoice 해석의 단일 진입점 =====
export const fired = (s: GameState, id: string): boolean => s.events.some(e => e.id === id);
export const chose = (s: GameState, id: string, idx: number): boolean =>
  s.events.some(e => e.id === id && e.resolvedChoice === idx);
// 여주 분기는 "해결 당시 femaleChoices 경로였는가"(resolvedFemale)로만 판정한다.
// 현재 s.gender 로 과거 이벤트를 재해석하면 마이그레이션·조작 세이브에서 오판(3자 리뷰 지적).
export const choseF = (s: GameState, id: string, idx: number): boolean =>
  s.events.some(e => e.id === id && e.resolvedChoice === idx && e.resolvedFemale === true);

// ===== 티어 경계 (전 NPC 균일) =====
// 82: grind 캡(80) 초과 = 이벤트 보상 + 감쇠(-0.2/주)를 이겨낸 유지 관리의 증거.
// NPC별 차등은 기각 — 재학 NPC는 누구나 80까지 grind 가능해 천장 차등의 근거가 없다(3자 리뷰 검증).
export const BEST_TIER = 82;
export const GOOD_TIER = 62;
export const MIN_INTIMACY = 45;

export type NpcClosureVariant = {
  match: (s: GameState) => boolean;
  text: string;
  // 이 variant 가 딛고 선 이벤트 id — 매치 시 해당 이벤트발 기억을 recall 후보에서 제외.
  sourceEvents: string[];
};
export type NpcClosure = {
  best: string; good: string; faint: string;
  variants?: NpcClosureVariant[];
  // 근황 목록 자체에서 제외 — "아직 이어진 사이" 섹션이므로 관계를 명시적으로 닫은 런은
  // 침묵이 맞다(단절 서사는 해당 이벤트의 failure 기억이 후회 레이어로 회수).
  excludeWhen?: (s: GameState) => boolean;
};

export const NPC_CLOSURES: Record<string, NpcClosure> = {
  jihun: {
    variants: [
      { match: s => choseF(s, 'jihun-hs-graduation', 0), sourceEvents: ['jihun-hs-graduation'],
        text: '지훈이와는 지금도 모든 사진을 같이 찍는다. 반칙이라던 그 말은, 지켜지고 있다.' },
      { match: s => chose(s, 'jihun-hs-unsaid', 0), sourceEvents: ['jihun-hs-unsaid'],
        text: '지훈이와는 지금도 가장 친한 친구다. 노을 지는 교실의 그 한마디가, 아직 우리 사이에 있다.' },
      { match: s => chose(s, 'jihun-hs-unsaid', 1) || chose(s, 'jihun-hs-unsaid', 2), sourceEvents: ['jihun-hs-unsaid'],
        text: '지훈이와는 지금도 가장 친한 친구다. 그날 끝내 못 들은 한마디는, 아직도 가끔 궁금하다.' },
    ],
    best: '지훈이와는 지금도 가장 친한 친구다. 12년째, 제일 먼저 연락하는 사이다.',
    good: '지훈이와는 종종 만난다. 만나면 여전히, 말보다 몸이 먼저다.',
    faint: '지훈이는 가끔 생각난다. 노을 지는 하굣길에 나란히 걷던 두 그림자.',
  },
  minjae: {
    variants: [
      { match: s => fired(s, 'minjae-hs-choice') && fired(s, 'minjae-dawn-on-hand'),
        sourceEvents: ['minjae-hs-choice', 'minjae-dawn-on-hand'],
        text: '민재는 결국 자기가 고른 칸을 채우러 갔다. 가끔 새벽에 온 메시지엔 3시 40분이 찍혀 있다.' },
      { match: s => fired(s, 'minjae-hs-choice'), sourceEvents: ['minjae-hs-choice'],
        text: '민재는 결국 자기가 고른 칸을 채우러 갔다. 무심한 척은 끝까지 서툴렀다.' },
    ],
    best: '민재와는 지금도 서로의 새벽을 아는 사이다. 무심한 척은 이제 서로 안 통한다.',
    good: '민재와는 종종 연락한다. 답장은 늘 늦지만, 안 무심하다는 건 안다.',
    faint: '민재는 가끔 생각난다. 스탠드 하나 켜진 빈 교실과 내려놓지 못하던 펜.',
  },
  subin: {
    variants: [
      { match: s => chose(s, 'subin-hs-momfight', 2) && (fired(s, 'subin-hs-after') || fired(s, 'subin-farewell')),
        sourceEvents: ['subin-hs-momfight', 'subin-hs-after'],
        text: '수빈이는 결국 그 꿈을 접지 않았다. 한 명은 응원한다던 말을, 아직 기억하고 있다.' },
      { match: s => fired(s, 'subin-farewell'), sourceEvents: ['subin-farewell'],
        text: '수빈이는 정말로 하늘 쪽으로 갔다. 가끔, 다른 도시에서 찍은 사진이 온다.' },
    ],
    best: '수빈이와는 지금도 자주 연락한다. 이제는 사진 프레임 안에 그 애도 같이 있다.',
    good: '수빈이와는 종종 연락한다. 어디서든 사람을 이어주던 그 재주는 여전하다.',
    faint: '수빈이는 가끔 생각난다. 잠금화면 속, 이륙하던 비행기 한 대.',
  },
  yuna: {
    variants: [
      { match: s => fired(s, 'yuna-smile'), sourceEvents: ['yuna-smile'],
        text: '유나는 결국 음대에 갔다. 콩쿠르 곡 말고, 좋아하는 곡을 치는 사람이 됐다.' },
    ],
    best: '유나와는 지금도 가장 가까운 사이다. 좋아하는 곡이 생기면 제일 먼저 나한테 들려준다.',
    good: '유나와는 종종 연락한다. 무대 밖 자기 자리에서, 그 애는 여전히 피아노를 친다.',
    faint: '유나는 가끔 생각난다. 완벽하게 웃던 얼굴 뒤에 떨리던 손.',
  },
  haeun: {
    variants: [
      { match: s => fired(s, 'haeun-hs-leaving'), sourceEvents: ['haeun-hs-leaving'],
        text: '하은 선배가 준 대본은 아직 갖고 있다. 선배는 듣는 사람의 길을 그대로 걷고 있다.' },
      { match: s => chose(s, 'haeun-distance', 0), sourceEvents: ['haeun-distance'],
        text: '하은 선배와는 그 답장 이후 한 번도 끊긴 적이 없다. 우편함에 넣던 마음이 아직 유효하다.' },
    ],
    best: '하은 선배와는 지금도 종종 만난다. 늘 챙기기만 하던 사람이, 이제 자기 얘기도 한다.',
    good: '하은 선배와는 종종 연락한다. 존댓말 하지 말라던 첫마디부터, 늘 먼저 곁을 줬던 사람.',
    faint: '하은 선배는 가끔 생각난다. 도서관 창가의 가디건과 자판기 음료 하나.',
  },
  junha: {
    variants: [
      { match: s => chose(s, 'junha-cook', 2) || chose(s, 'junha-hs-farewell', 0),
        sourceEvents: ['junha-cook', 'junha-hs-farewell'],
        text: '준하는 부산에서 요리를 배우고 있다. 1호 손님 자리는 맡아뒀다는 연락이, 사투리 그대로 온다.' },
      // 이름 기입은 c0 한정("노트 첫 장에 네 이름을 적는다") — 무게이트 프레임에 두면 거짓이 된다.
      { match: s => chose(s, 'junha-hs-recipe', 0), sourceEvents: ['junha-hs-recipe'],
        text: '준하와는 지금도 연락한다. 레시피 노트 첫 장의 이름은 여전히 안 지웠다고 한다.' },
    ],
    best: '준하와는 지금도 연락한다. 새 메뉴가 생기면 사진이 제일 먼저 온다.',
    good: '준하는 부산으로 돌아갔다. 참치마요 주먹밥을 보면 아직 그 옥상이 생각난다.',
    faint: '준하는 가끔 생각난다. 낡은 도시락통과 혼자 먹던 주먹밥.',
  },
  seoa: {
    variants: [
      { match: s => fired(s, 'seoa-ending-page'), sourceEvents: ['seoa-ending-page'],
        text: '서아의 끝나지 않던 문장은 끝났다. 마지막 단어가 무엇이었는지는, 우리 둘만 안다.' },
    ],
    best: '서아와는 지금도 가깝다. 새 글이 생기면, 첫 독자는 아직 나다.',
    good: '서아와는 종종 연락한다. 문이 두 번 울리면 열린다는 걸 나는 아직 기억한다.',
    faint: '서아는 가끔 생각난다. 가슴에 노트를 안고 양쪽 이어폰을 꽂던 아이.',
  },
  siwoo: {
    variants: [
      { match: s => fired(s, 'siwoo-where-you-stood'), sourceEvents: ['siwoo-where-you-stood'],
        text: '시우가 보던 자리들에, 내가 서 있었다고 했다. 이제는 그 애가 세울 것들을 기다린다.' },
      { match: s => chose(s, 'siwoo-hobby-seat', 2), sourceEvents: ['siwoo-hobby-seat'],
        text: '시우는 그 뒤로 옥상 대신 자습실에 있었다. 그래도 지금도 가끔, 안 선 것들 얘기를 한다.' },
    ],
    best: '시우와는 지금도 연락한다. 헐리는 자리만 보던 애가, 요즘은 세울 자리 얘기를 한다.',
    good: '시우와는 종종 연락한다. 요즘도 어디가 헐리고 서는지부터 얘기한다.',
    faint: '시우는 가끔 생각난다. 허공에 윤곽을 긋던 손가락.',
  },
  yerin: {
    // 결산선을 그은 관계(c2)는 "아직 이어진 사이" 근황에 없다 — c2는 intimacyChange 0이라
    // 친밀도로는 자연 누락되지 않아 명시 제외가 필요(3자 리뷰 HIGH). 단절 기억(imp8 failure)은
    // 후회 레이어가 회수한다.
    excludeWhen: s => chose(s, 'yerin-not-a-trade', 2),
    variants: [
      { match: s => chose(s, 'yerin-not-a-trade', 0) || chose(s, 'yerin-not-a-trade', 1),
        sourceEvents: ['yerin-not-a-trade'],
        text: '예린의 셈은 내 앞에서만 멈췄다. 요즘도 가끔, 계산 없는 연락이 온다.' },
    ],
    best: '예린과는 지금도 연락한다. 내 줄엔 끝내 단가가 적히지 않았다.',
    good: '예린과는 가끔 연락한다. 단가표에 없는 사이 — 그게 그 애 식 우정이라는 걸 안다.',
    faint: '예린은 가끔 생각난다. 남들 다 계산하던 애가 내 앞에서만 서툴던 순간들.',
  },
};

// ===== 클로저 해석 =====
export type ResolvedClosure = { text: string; excludeEventIds: Set<string> };

// 등록 NPC 의 프레임 결정: variant 첫 매치 > 균일 티어. 미등록 id 는 null(호출부 범용 폴백).
export function resolveNpcClosure(state: GameState, npcId: string, intimacy: number): ResolvedClosure | null {
  const closure = NPC_CLOSURES[npcId];
  if (!closure) return null;
  for (const v of closure.variants ?? []) {
    if (v.match(state)) return { text: v.text, excludeEventIds: new Set(v.sourceEvents) };
  }
  const text = intimacy >= BEST_TIER ? closure.best : intimacy >= GOOD_TIER ? closure.good : closure.faint;
  return { text, excludeEventIds: new Set() };
}

export function isClosureExcluded(state: GameState, npcId: string): boolean {
  return NPC_CLOSURES[npcId]?.excludeWhen?.(state) ?? false;
}

// ===== 도윤 — 전출 NPC 별도 레인 =====
// doyun-graduation-sign 은 만남만 조건인 무게이트 W47 이벤트라, 관계가 실제로 있었던 런만
// 통과시키는 품질 게이트가 필요: 진심 서명(c0) 또는 창가 예고 장면(reach 60) 도달.
export const DEPARTED_NPC_ID = 'doyun';

const DOYUN_DEFAULT = {
  text: '도윤이는 가끔 생각난다. 갑자기 마지막이 된 카톡 창까지도.',
  sourceEvents: ['doyun-school-split'],
};
const DOYUN_VARIANTS: NpcClosureVariant[] = [
  // 여주(관찰자·거리감 호감 아크): 앨범 동그라미는 첫 만남 c1("살짝 웃어준다")에서만 시작되는
  // 모티프(doyun-meet-elementary-f c1 recallText) — 그 선택 없이 동그라미를 단정하면 거짓(codex P2).
  { match: s => (choseF(s, 'doyun-graduation-sign', 0) || choseF(s, 'doyun-graduation-sign', 1))
      && chose(s, 'doyun-meet-elementary-f', 1),
    sourceEvents: ['doyun-graduation-sign', 'doyun-meet-elementary-f'],
    text: '도윤이 소식은 가끔 건너서 듣는다. 졸업앨범 그 얼굴에 그린 동그라미는, 아직 지우지 않았다.' },
  // 여주 폴백(동그라미 미성립): c0/c1 둘 다 도윤이 앨범에 한 줄을 적어주는 장면이라 안전한 모티프.
  { match: s => choseF(s, 'doyun-graduation-sign', 0) || choseF(s, 'doyun-graduation-sign', 1),
    sourceEvents: ['doyun-graduation-sign'],
    text: '도윤이 소식은 가끔 건너서 듣는다. 그 애 앨범에 적어준 한 줄을, 요즘도 가끔 생각한다.' },
  // 남주(재회 약속 + 연락 시도): 약속은 끝내 안 지켜지는 게 코드의 결말 — 재회를 단정하지 않는다.
  { match: s => chose(s, 'doyun-graduation-sign', 0) && !choseF(s, 'doyun-graduation-sign', 0)
      && chose(s, 'doyun-school-split', 0),
    sourceEvents: ['doyun-graduation-sign', 'doyun-school-split'],
    text: '도윤이와는 끝내 그 밥을 못 먹었다. 앨범 속 축구공 낙서만, 모른 척 못 할 이름으로 남았다.' },
];

export function resolveDepartedClosure(state: GameState): ResolvedClosure | null {
  if (!chose(state, 'doyun-graduation-sign', 0) && !fired(state, 'doyun-window-school')) return null;
  for (const v of DOYUN_VARIANTS) {
    if (v.match(state)) return { text: v.text, excludeEventIds: new Set(v.sourceEvents) };
  }
  return { text: DOYUN_DEFAULT.text, excludeEventIds: new Set(DOYUN_DEFAULT.sourceEvents) };
}
