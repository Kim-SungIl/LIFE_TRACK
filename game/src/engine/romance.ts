// 명시적인 선택만 관계로 저장한다. 기존 이야기와 선택 번호는 보존한다.
import { absWeek } from './weekMath';
import type { EventChoice, GameEvent, GameState, Gender } from './types';

export type RomanceNpc = 'subin' | 'jihun';
export type RomanceDecision = 'date' | 'together' | 'apart';
export interface RomanceRelationship {
  npcId: RomanceNpc;
  status: 'dating' | 'ended';
  year: number;
  week: number;
  graduation?: 'together' | 'apart';
}
export type RomanceContext = Pick<GameState, 'gender' | 'year' | 'week'> & Partial<Pick<GameState, 'relationship' | 'events'>>;
export const ROMANCE_OUTING_IDS = { subin: 'subin-romance-outing', jihun: 'jihun-romance-outing' } as const;
// 두 번째 만남 — 첫 만남을 마치고 4주 이상 지난 뒤, 연인과 실제로 놀았던 주에 한 번 열린다(romance-outings.ts).
export const ROMANCE_OUTING2_IDS = { subin: 'subin-romance-outing2', jihun: 'jihun-romance-outing2' } as const;
/** 연인 만남 전부(겪는 순서). 사건 선택·해결·완주율 분모·회고·앨범이 이 집합 하나를 쓴다. */
export const ALL_ROMANCE_OUTING_IDS: ReadonlySet<string> = new Set([
  ...Object.values(ROMANCE_OUTING_IDS), ...Object.values(ROMANCE_OUTING2_IDS)]);
/** 그 만남에서 고른 선택(0·1). 안 겪었으면 undefined. */
export function romanceOutingChoice(state: Partial<Pick<GameState, 'events'>>, id: string): 0 | 1 | undefined {
  const c = state.events?.find(e => e.id === id)?.resolvedChoice;
  return c === 0 || c === 1 ? c : undefined;
}
export function hasRomanceOuting(state: RomanceContext, npc: RomanceNpc): boolean {
  return isDating(state, npc) && romanceOutingChoice(state, ROMANCE_OUTING_IDS[npc]) !== undefined;
}
export function hasRomanceOuting2(state: RomanceContext, npc: RomanceNpc): boolean {
  return isDating(state, npc) && romanceOutingChoice(state, ROMANCE_OUTING2_IDS[npc]) !== undefined;
}
// 졸업 '계속 만나자' 대사 끝에 붙는 회상 — 겪은 만남 중 **가장 최근 것** 하나만 잇는다(같은 회상 반복 방지).
export function romanceOutingRecall(state: RomanceContext, npc: RomanceNpc): string {
  if (hasRomanceOuting2(state, npc)) {
    const quiet = romanceOutingChoice(state, ROMANCE_OUTING2_IDS[npc]) === 1;
    return npc === 'subin'
      ? quiet ? ' "말 안 해도 옆에 있던 그날처럼, 멀리 가도 그렇게 있자."' : ' "그날 언덕에서처럼, 힘든 날엔 나한테 먼저 말해 줘."'
      : quiet ? ' "졸업해도 네 쪽으로는 받기 좋은 공만 보낼게."' : ' "다음엔 더 빠른 공 보낸다. 받아 줄 거지?"';
  }
  if (!hasRomanceOuting(state, npc)) return '';
  const playful = romanceOutingChoice(state, ROMANCE_OUTING_IDS[npc]) === 1;
  return npc === 'subin'
    ? playful ? ' "카페 맞은편 자리, 아직 예약 유효한 거 알지?"' : ' "단어장 덮고 네 얘기 들었던 날처럼, 앞으로도 얘기해 줘."'
    : playful ? ' "천천히 걷기 공동 우승, 졸업해도 유효다."' : ' "그날 공원에서처럼, 바빠도 같이 천천히 걷자."';
}
// 두 번째 만남 도입부 — 가운데 한 줄이 첫 만남에서 고른 답을 받는다. 카탈로그의 description은 그 줄이
// 빠진 판(head+tail)이고, 화면에 낼 때 presentRomanceEvent가 기록을 읽어 끼운다(기록이 없으면 원문 그대로).
export const ROMANCE_OUTING2_TEXT: Record<RomanceNpc, { head: string; tail: string; callback: readonly [string, string] }> = {
  subin: {
    head: '비행기가 낮게 지나가는 강변 언덕. 수빈이가 캔음료 두 개를 잔디에 내려놓는다.\n"내 꿈 얘기는 네가 제일 많이 들어 줬잖아. 오늘은 그 반대 하자."',
    tail: '수빈이가 무릎을 끌어안는다. "무슨 얘기든 괜찮아. 없으면 없는 대로 괜찮고."',
    callback: ['"지난번엔 앞날 얘기였지? 오늘은 그런 거 말고, 그냥 요즘 네 얘기."',
      '"맞은편 자리 예약했다며. 오늘은 맞은편 말고 옆자리야."'],
  },
  jihun: {
    head: '공원 공터. 지훈이가 셔틀콕을 건네더니 라켓을 짧게 고쳐 잡는다.\n"오늘은 내가 받기 좋게만 보낼게. 너는 마음대로 쳐."',
    tail: '첫 공이 높고 느리게 떠올랐다. 늘 있는 힘껏 치던 지훈이다.',
    callback: ['"그날처럼 천천히 하자. 끝나면 또 걷고."', '"오늘은 대회 없음. 공동 우승은 지난번 걸로 충분하잖아."'],
  },
};
export const SUBIN_CONVERSATION_ENTRY = 'subin-hs-studyboard';
export const ROMANCE_ROUTES = {
  subin: { gender: 'male', opening: 'subin-hs-confess', closing: 'subin-farewell', tier: 70, openingYear: 6, closingYear: 7 },
  jihun: { gender: 'female', opening: 'jihun-hs-unsaid', closing: 'jihun-hs-graduation', tier: 93, openingYear: 6, closingYear: 7 },
} as const satisfies Record<RomanceNpc, { gender: Gender; opening: string; closing: string; tier: number; openingYear: number; closingYear: number }>;

// 구세이브의 친밀도나 선택지 번호에서 연애를 추정하지 않는다.
export function sanitizeRelationship(value: unknown, gender: Gender): RomanceRelationship | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const r = value as RomanceRelationship;
  if ((r.npcId !== 'subin' && r.npcId !== 'jihun') || ROMANCE_ROUTES[r.npcId].gender !== gender
      || !['dating', 'ended'].includes(r.status)
      || (!Number.isInteger(r.year) || r.year < ROMANCE_ROUTES[r.npcId].openingYear || r.year > ROMANCE_ROUTES[r.npcId].closingYear) || !Number.isInteger(r.week) || r.week < 1 || r.week > 48) return undefined;
  if (r.graduation !== undefined && r.graduation !== 'together' && r.graduation !== 'apart') return undefined;
  if ((r.status === 'ended') !== (r.graduation === 'apart')) return undefined;
  return { npcId: r.npcId, status: r.status, year: r.year, week: r.week,
    ...(r.graduation ? { graduation: r.graduation } : {}) };
}

export function isDating(state: RomanceContext, npcId: string): boolean {
  const r = sanitizeRelationship(state.relationship, state.gender);
  return !!r && r.npcId === npcId && r.status === 'dating' && state.year >= r.year;
}

// 연인의 졸업 장면만 친밀도를 우회한다. 주차·방학·만남·학년 조건은 원본이 판단한다.
// 수빈 졸업은 후속 풀(우선순위 0·배열 순서)에 있어 열리는 주가 Y7 40~42주 셋뿐이다. 앞 순번 후속
// (jihun-fight/support/promise)이 함께 남아 있으면 세 주를 다 빼앗겨 선택 없이 엔딩으로 간다 —
// 연인일 때만 순위를 한 칸 올린다. 연애가 아닌 판의 경합은 그대로 둔다.
export function romanceEventEligibility(event: GameEvent, state: GameState): GameEvent {
  if (event.id === ROMANCE_ROUTES.subin.closing && isDating(state, 'subin')) {
    return { ...event, selectionPriority: Math.max(event.selectionPriority ?? 0, 1) };
  }
  if (event.id !== ROMANCE_ROUTES.jihun.closing || !isDating(state, 'jihun')) return event;
  return { ...event, reach: { ...event.reach!, tier: 0 }, condition: s => !!event.condition?.({
    ...s, npcs: s.npcs.map(n => n.id === 'jihun' ? { ...n, intimacy: Math.max(n.intimacy, event.reach!.tier) } : n),
  }) };
}

function relationshipChoice(base: EventChoice, npcId: RomanceNpc, decision: RomanceDecision, text: string, message: string, recallText: string): EventChoice {
  return { ...base, text, message, relationshipSelect: { npcId, decision },
    memorySlotDraft: { category: 'growth', importance: 7, toneTag: decision === 'apart' ? 'melancholy' : 'warm', recallText, npcIds: [npcId] } };
}

export function presentRomanceEvent(event: GameEvent, state: RomanceContext): GameEvent {
  const npcId: RomanceNpc = state.gender === 'male' ? 'subin' : 'jihun';
  const route = ROMANCE_ROUTES[npcId];
  if (event.id === ROMANCE_OUTING2_IDS[npcId]) {
    // 매번 상수에서 다시 짓는다 — 저장 복원·재렌더에서 줄이 두 번 붙지 않는다.
    const first = romanceOutingChoice(state, ROMANCE_OUTING_IDS[npcId]);
    const t = ROMANCE_OUTING2_TEXT[npcId];
    return first === undefined ? event : { ...event, description: `${t.head}\n${t.callback[first]}\n${t.tail}` };
  }
  const choices = state.gender === 'female' && event.femaleChoices ? event.femaleChoices : event.choices;
  // 저장 복원과 재렌더에서 같은 선택지를 다시 붙이지 않는다.
  if (choices.some(c => c.relationshipSelect || c.romanceConversation)) return event;
  const extra: EventChoice[] = [];
  if (npcId === 'subin' && event.id === SUBIN_CONVERSATION_ENTRY && state.year === route.openingYear && !state.relationship) {
    extra.push({ ...choices[0], romanceConversation: 'subin',
      text: '"같이 외우자. 끝나면 우리 사이에 대해서도 얘기할래?"',
      message: '수빈이와 단어장을 나눠 보고 발음을 맞춰 읽었다. 연습을 마친 뒤 수빈이가 가방을 닫았다. "응, 나도 따로 하고 싶은 얘기가 있어."' });
  } else if (npcId === 'jihun' && event.id === route.opening && state.year === route.openingYear && !state.relationship) {
    extra.push(relationshipChoice(choices[0], npcId, 'date',
      '"나도 너 좋아해. 우리 사귈까?" 먼저 마음을 꺼낸다',
      '지훈이가 고개를 번쩍 들었다. "…나도 그 말 하려고 했어. 응, 사귀자." 한참을 웃다가 가방을 챙겼다. 늘 걷던 길을, 오늘은 서로 손을 내밀며 걸었다.',
      '지훈이의 망설임 앞에서 먼저 꺼낸 좋아한다는 말.'));
  } else if (event.id === route.closing && state.year === route.closingYear && isDating(state, npcId)) {
    extra.push(relationshipChoice(choices[0], npcId, 'together',
      '"졸업하고도 계속 만나자. 각자 꿈도 응원하면서."',
      (npcId === 'subin' ? '수빈이가 웃었다. "영어 연습도, 네 얘기 듣는 것도 계속할래." 서로의 길을 막지 않고 연인으로 만나기로 했다.'
        : '지훈이가 사진을 한 장 더 찍었다. "체대 준비하다 바빠도 연락할게. 너도 네 얘기 해줘." 졸업 뒤에도 연인으로 만나기로 했다.') + romanceOutingRecall(state, npcId),
      npcId === 'subin' ? '수빈이와 각자의 꿈을 응원하며 계속 만나기로 했다.' : '지훈이와 사진을 찍으며 졸업 뒤의 만남을 약속했다.'));
    extra.push(relationshipChoice(choices[0], npcId, 'apart',
      '"함께한 시간은 고마워. 연인으로서는 여기까지 하고 싶어."',
      npcId === 'subin' ? '수빈이가 잠시 고개를 숙였다. "아쉽지만, 솔직하게 말해줘서 고마워." 함께한 시간을 지우지 않고 서로의 앞날을 응원했다.'
        : '지훈이가 사진을 들여다보다 고개를 끄덕였다. "같이 있던 시간은 좋았어." 곧바로 괜찮아질 순 없어도 서로의 선택을 존중하기로 했다.',
      npcId === 'subin' ? '서로의 앞날을 응원하며 수빈이와 연애를 마무리했다.' : '사진을 남겨 두고 지훈이와 연인으로서 작별했다.'));
  }
  if (!extra.length) return event;
  return state.gender === 'female' && event.femaleChoices
    ? { ...event, femaleChoices: [...choices, ...extra] }
    : { ...event, choices: [...choices, ...extra] };
}

// 자동 선택 풀에는 등록하지 않는다. 기존 단어장 장면에서 명시적으로 고른 후속 대화만 연다.
// 진입 기록으로 저장 복원도 검증하므로 임의의 currentEvent ID만으로 고백을 만들지 않는다.
export function buildSubinConfession(state: GameState): GameEvent | null {
  const route = ROMANCE_ROUTES.subin;
  if (state.gender !== route.gender || state.year !== route.openingYear || state.relationship
      || !state.npcs.some(n => n.id === 'subin' && n.met && n.intimacy >= route.tier)
      || state.events.some(e => e.id === route.opening)) return null;
  const entry = state.events.find(e => e.id === SUBIN_CONVERSATION_ENTRY && e.year === route.openingYear
    && e.resolvedChoice !== undefined && e.choices[e.resolvedChoice]?.romanceConversation === 'subin');
  if (!entry) return null;
  return {
    id: route.opening, week: entry.week, title: '연습이 끝난 뒤',
    description: '접힌 단어장 사이로 수빈이가 써 둔 발음 메모가 보인다.\n"처음엔 영어 한 문장도 버벅거렸는데, 이제 좀 할 만해. 나 계속 준비할 거야."\n수빈이가 가방을 닫고 나를 바라본다. "그거랑 별개로 하고 싶은 말이 있어. 나 너 좋아해. 우리 사귈래?"',
    speakers: ['subin'], location: 'cafe', background: 'cafe_study',
    choices: [
      { text: '"나도 좋아해. 우리 사귀자."', effects: {}, npcEffects: [],
        relationshipSelect: { npcId: 'subin', decision: 'date' },
        message: '수빈이가 가방끈을 꼭 쥐었다가 웃었다. "그럼 다음 약속은 데이트라고 해도 되지?" 서로의 꿈을 응원하던 사이에, 좋아한다는 말이 하나 더 생겼다.',
        memorySlotDraft: { category: 'growth', importance: 7, toneTag: 'warm', recallText: '연습을 마친 수빈이와 서로 좋아한다고 말한 날.', npcIds: ['subin'] } },
      { text: '"말해줘서 고마워. 지금은 친구로 천천히 지내고 싶어."', effects: {}, npcEffects: [],
        message: '"응, 알겠어." 수빈이가 고개를 끄덕였다. "네 마음도 네 속도가 있는 거지." 잠시 쉬었다가, 둘은 각자 하고 싶은 일에 관한 이야기를 이어 갔다.' },
      { text: '"면접보다 어려운 질문인데?" 웃으며 넘긴다', effects: {}, npcEffects: [],
        message: '수빈이가 피식 웃었다. "그건 정답 없거든?" 더 대답을 재촉하지는 않았다. 나는 단어장을 돌려주며 다음 연습도 응원하겠다고 말했다.' },
    ],
  };
}

export function relationshipContinuation(state: GameState, event: GameEvent, choice: EventChoice): GameEvent | null {
  return event.id === SUBIN_CONVERSATION_ENTRY && choice.romanceConversation === 'subin'
    ? buildSubinConfession(state) : null;
}

// Eligibility and consumption live in the existing saved event history. Old saves need no
// inferred relationship state; original choice indices and outcomes remain untouched.
export const ROMANCE_RETRY_IDS = { subin: 'subin-romance-revisit', jihun: 'jihun-romance-revisit' } as const;
export const ROMANCE_RETRY_DELAY = 4;
export type RomanceReturnPhase = 'weekday' | 'weekend' | 'vacation';
const planningPhase = (phase: unknown): phase is RomanceReturnPhase =>
  phase === 'weekday' || phase === 'weekend' || phase === 'vacation';
export function romanceRetryNpc(id: string): RomanceNpc | undefined {
  return (Object.keys(ROMANCE_RETRY_IDS) as RomanceNpc[]).find(npc => ROMANCE_RETRY_IDS[npc] === id);
}
function retryEligible(state: GameState, npcId: RomanceNpc): boolean {
  const route = ROMANCE_ROUTES[npcId];
  if (state.gender !== route.gender || state.relationship || !Number.isInteger(state.week)
      || state.week < 1 || state.week > 48 || !Number.isInteger(state.year) || state.year < route.openingYear || state.year > route.closingYear
      || state.events.some(e => e.id === route.closing || e.id === ROMANCE_RETRY_IDS[npcId])
      || !state.npcs.some(n => n.id === npcId && n.met && n.intimacy >= route.tier)) return false;
  const opening = state.events.find(e => e.id === route.opening && e.year === route.openingYear);
  if (!opening || !Number.isInteger(opening.week) || opening.week! < 1 || opening.week! > 48
      || opening.resolvedChoice === undefined
      || !(npcId === 'subin' ? [1, 2] : [0, 1, 2]).includes(opening.resolvedChoice)) return false;
  return absWeek(state.year, state.week) - absWeek(opening.year!, opening.week!) >= ROMANCE_RETRY_DELAY;
}
export function canStartRomanceRetry(state: GameState, npcId: string): boolean {
  return (npcId === 'subin' || npcId === 'jihun') && planningPhase(state.phase)
    && !state.currentEvent && retryEligible(state, npcId);
}
export function buildRomanceRetry(state: GameState, npcId: RomanceNpc,
  returnPhase: RomanceReturnPhase): GameEvent | null {
  if (!planningPhase(returnPhase) || !retryEligible(state, npcId)) return null;
  return {
    id: ROMANCE_RETRY_IDS[npcId], week: state.week, romanceReturnPhase: returnPhase,
    title: '그때 하지 못한 말', speakers: [npcId], location: 'cafe', background: 'cafe_study',
    description: npcId === 'subin'
      ? '수빈이가 단어장에 책갈피를 끼운다. 나는 잠깐 숨을 고르고 말을 꺼낸다.\n"그때 네가 했던 말, 계속 생각했어."\n수빈이가 내 쪽으로 몸을 돌린다. "응. 듣고 있어."'
      : '지훈이가 운동 가방을 옆에 내려놓는다. 나는 그날 교실에서 미처 꺼내지 못한 이야기를 시작한다.\n"그때 말이야. 나도 너한테 하고 싶은 말이 있었어."\n지훈이가 고개를 든다. "…응. 천천히 말해."',
    choices: [
      relationshipChoice({ text: '', effects: {}, npcEffects: [], message: '' }, npcId, 'date',
        '"좋아해. 우리 사귈래?" 내 마음을 전한다',
        npcId === 'subin' ? '수빈이가 천천히 웃었다. "나도 아직 같은 마음이야." 서두르지 않고 돌아온 말이, 이번엔 서로에게 닿았다.'
          : '지훈이가 한참 웃다가 고개를 끄덕였다. "나도 좋아해." 미뤄 두었던 말 끝에서, 둘은 연인이 되었다.',
        npcId === 'subin' ? '다시 꺼낸 이야기 끝에 수빈이와 서로의 마음을 확인했다.' : '미처 하지 못한 말을 전하고 지훈이와 연인이 되었다.'),
      { text: '"소중한 친구로 지내고 싶어." 내 마음을 분명히 전한다', effects: {}, npcEffects: [],
        message: npcId === 'subin' ? '수빈이가 고개를 끄덕였다. "솔직하게 말해줘서 고마워." 서로의 마음을 확인한 뒤, 친구로 함께하기로 했다.'
          : '지훈이가 잠시 생각하다 고개를 끄덕였다. "알겠어. 말해줘서 고마워." 둘은 친구로 지내기로 했다.' },
    ],
  };
}
// 대화 도중 새로고침해도 미확정 주간 계획을 되살린다. 해결 기록에도 같은 스냅샷이 남는다.
export type RomancePlan = NonNullable<GameEvent['romancePlan']>;
export function readRomancePlan(raw: unknown): RomancePlan | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const p = raw as RomancePlan;
  if (!Array.isArray(p.activities) || p.activities.length > 10
      || !Array.from(p.activities).every(a => typeof a === 'string')
      || !p.npcChoices || typeof p.npcChoices !== 'object' || Array.isArray(p.npcChoices)
      || !Object.values(p.npcChoices).every(id => typeof id === 'string')) return undefined;
  return { activities: [...p.activities], npcChoices: { ...p.npcChoices } };
}
export function resumedRomancePlan(state: GameState): RomancePlan | undefined {
  const event = [...state.events].reverse().find(e => romanceRetryNpc(e.id)
    && e.year === state.year && e.week === state.week && e.resolvedChoice !== undefined
    && e.romanceReturnPhase === state.phase);
  return readRomancePlan(event?.romancePlan);
}
export function restoreRomanceRetry(state: GameState): GameEvent | null {
  const event = state.currentEvent;
  const npcId = event && romanceRetryNpc(event.id);
  if (!event || !npcId || state.phase !== 'event' || event.week !== state.week
      || !planningPhase(event.romanceReturnPhase)) return null;
  const fresh = buildRomanceRetry(state, npcId, event.romanceReturnPhase);
  const plan = readRomancePlan(event.romancePlan);
  return fresh && plan ? { ...fresh, romancePlan: plan } : fresh;
}

export function applyRelationshipChoice(state: GameState, event: GameEvent, choice: EventChoice, week: number): void {
  const selection = choice.relationshipSelect;
  if (!selection) return;
  const route = ROMANCE_ROUTES[selection.npcId];
  if (!route || route.gender !== state.gender) return;
  const { npcId, decision } = selection;
  if (event.id === ROMANCE_RETRY_IDS[npcId] && decision === 'date' && restoreRomanceRetry(state)) {
    state.relationship = { npcId, status: 'dating', year: state.year, week };
  } else if (event.id === route.opening && state.year === route.openingYear && !state.relationship && decision === 'date'
      && state.npcs.some(n => n.id === npcId && n.met && n.intimacy >= route.tier)
      && (npcId !== 'subin' || buildSubinConfession(state) !== null)) {
    state.relationship = { npcId, status: 'dating', year: state.year, week };
  } else if (event.id === route.closing && state.year === route.closingYear && isDating(state, npcId)
      && (decision === 'together' || decision === 'apart')) {
    state.relationship = { ...state.relationship!, status: decision === 'apart' ? 'ended' : 'dating', graduation: decision };
  }
}

// A later breakup does not undo a conversation that actually took place.
// Match the accepted event to the saved relationship start, never infer it from intimacy.
export function hasSuccessfulRomanceRetry(state: GameState, npcId: RomanceNpc): boolean {
  const relationship = sanitizeRelationship(state.relationship, state.gender);
  return relationship?.npcId === npcId && state.events.some(e => e.id === ROMANCE_RETRY_IDS[npcId]
    && e.resolvedChoice === 0 && e.year === relationship.year && e.week === relationship.week);
}

export function romanceClosure(state: GameState, npcId: string): { text: string; excludeEventIds: Set<string> } | null {
  const r = sanitizeRelationship(state.relationship, state.gender);
  if (!r || r.npcId !== npcId) return null;
  const text = npcId === 'subin'
    ? r.status === 'ended' ? '수빈이와의 연애는 마무리했지만, 영어 단어장을 사이에 두고 나누던 웃음은 남아 있다.'
      : r.graduation === 'together' ? '연인으로서도 서로의 꿈을 응원하며, 수빈이가 보내오는 하늘 사진에 내 하루를 답한다.'
      : '수빈이와는 꿈을 향한 시간을 함께 보내다 서로 마음을 확인하고 연인이 되었다.'
    : r.status === 'ended' ? '지훈이와 연인으로서는 작별했지만, 함께 찍은 사진 속 웃음까지 지우지는 않았다.'
      : r.graduation === 'together' ? '지훈이와는 연인으로도 계속 만나며, 운동과 각자의 일상 사이에 둘의 사진을 더하고 있다.'
      : '지훈이와는 머뭇거리던 말의 끝에서 서로의 마음을 확인하고 연인이 되었다.';
  const retrySources = hasSuccessfulRomanceRetry(state, r.npcId) ? [ROMANCE_RETRY_IDS[r.npcId]] : [];
  return { text, excludeEventIds: new Set([ROMANCE_ROUTES[r.npcId].opening, ROMANCE_ROUTES[r.npcId].closing, ...retrySources]) };
}
