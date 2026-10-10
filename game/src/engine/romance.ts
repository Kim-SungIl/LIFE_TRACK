// 명시적인 선택만 관계로 저장한다. 기존 이야기와 선택 번호는 보존한다.
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
export type RomanceContext = Pick<GameState, 'gender' | 'year' | 'week'> & Partial<Pick<GameState, 'relationship'>>;
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
      || r.year !== ROMANCE_ROUTES[r.npcId].openingYear || !Number.isInteger(r.week) || r.week < 1 || r.week > 48) return undefined;
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
export function romanceEventEligibility(event: GameEvent, state: GameState): GameEvent {
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
  const choices = state.gender === 'female' && event.femaleChoices ? event.femaleChoices : event.choices;
  // 저장 복원과 재렌더에서 같은 선택지를 다시 붙이지 않는다.
  if (choices.some(c => c.relationshipSelect || c.romanceConversation)) return event;
  const extra: EventChoice[] = [];
  if (npcId === 'subin' && event.id === SUBIN_CONVERSATION_ENTRY && state.year === route.openingYear && !state.relationship) {
    extra.push({ ...choices[0], romanceConversation: 'subin',
      text: '"같이 외우자. 연습 끝나면 우리 얘기도 조금 할래?"',
      message: '수빈이와 단어장을 나눠 보고 발음을 맞춰 읽었다. 연습을 마친 뒤 수빈이가 가방을 닫았다. "응, 나도 따로 하고 싶은 얘기가 있어."' });
  } else if (npcId === 'jihun' && event.id === route.opening && state.year === route.openingYear && !state.relationship) {
    extra.push(relationshipChoice(choices[0], npcId, 'date',
      '"나도 너 좋아해. 우리 사귈까?" 먼저 마음을 꺼낸다',
      '지훈이가 고개를 번쩍 들었다. "…나도 그 말 하려고 했어. 응, 사귀자." 한참을 웃다가 가방을 챙겼다. 늘 걷던 길을, 오늘은 서로 손을 내밀며 걸었다.',
      '지훈이의 망설임 앞에서 먼저 꺼낸 좋아한다는 말.'));
  } else if (event.id === route.closing && state.year === route.closingYear && isDating(state, npcId)) {
    extra.push(relationshipChoice(choices[0], npcId, 'together',
      '"졸업하고도 계속 만나자. 각자 꿈도 응원하면서."',
      npcId === 'subin' ? '수빈이가 웃었다. "영어 연습도, 네 얘기 듣는 것도 계속할래." 서로의 길을 막지 않고 연인으로 만나기로 했다.'
        : '지훈이가 사진을 한 장 더 찍었다. "체대 준비하다 바빠도 연락할게. 너도 네 얘기 해줘." 졸업 뒤에도 연인으로 만나기로 했다.',
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

export function applyRelationshipChoice(state: GameState, event: GameEvent, choice: EventChoice, week: number): void {
  const selection = choice.relationshipSelect;
  if (!selection) return;
  const route = ROMANCE_ROUTES[selection.npcId];
  if (!route || route.gender !== state.gender) return;
  const { npcId, decision } = selection;
  if (event.id === route.opening && state.year === route.openingYear && !state.relationship && decision === 'date'
      && state.npcs.some(n => n.id === npcId && n.met && n.intimacy >= route.tier)
      && (npcId !== 'subin' || buildSubinConfession(state) !== null)) {
    state.relationship = { npcId, status: 'dating', year: state.year, week };
  } else if (event.id === route.closing && state.year === route.closingYear && isDating(state, npcId)
      && (decision === 'together' || decision === 'apart')) {
    state.relationship = { ...state.relationship!, status: decision === 'apart' ? 'ended' : 'dating', graduation: decision };
  }
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
  return { text, excludeEventIds: new Set([ROMANCE_ROUTES[r.npcId].opening, ROMANCE_ROUTES[r.npcId].closing]) };
}
