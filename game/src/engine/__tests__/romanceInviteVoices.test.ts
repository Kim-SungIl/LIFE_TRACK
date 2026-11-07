// 연인 말투(talkData/inviteVoices.ts ROMANCE_INVITE_VOICES) — 사귀는 상대의 초대·약속 줄만 바뀌고 수치는 하나도 안 바뀐다.
import { describe, expect, it } from 'vitest';
import { createInitialState, processWeek } from '../gameEngine';
import { NPC_DIALOGUES } from '../dialogues';
import { NPC_SMALLTALK } from '../talkData/npcSmalltalk';
import {
  INVITE_VOICES, ROMANCE_INVITE_VOICES, brokenLine, declineLine, inviteLine, inviteVoice, keptLine,
} from '../talkData/inviteVoices';
import { getMonthBlock, getWeekInfo } from '../weekMath';
import type { RomanceRelationship } from '../romance';
import type { GameState } from '../types';

const ROMANCE = Object.entries(ROMANCE_INVITE_VOICES);
const linesOf = (v: (typeof ROMANCE)[number][1]) => [...v.hangOut, ...v.study, ...v.decline, ...v.kept, ...v.broken];

describe('연인 말투 표', () => {
  it('분량 — 놀기 4·공부 2·지킨 약속 4·거절 2·못 지킨 약속 2 (연애 중 초대 ≈5.4회 실측)', () => {
    for (const [id, v] of ROMANCE) {
      expect([v.hangOut.length, v.study.length, v.kept.length, v.decline.length, v.broken.length], id).toEqual([4, 2, 4, 2, 2]);
    }
  });

  it('초대 줄은 {when}을 정확히 한 번, 반응 줄은 담지 않는다', () => {
    for (const [id, v] of ROMANCE) {
      for (const line of [...v.hangOut, ...v.study]) expect(line.split('{when}').length - 1, `${id}: ${line}`).toBe(1);
      for (const line of [...v.decline, ...v.kept, ...v.broken]) expect(line, `${id}: ${line}`).not.toContain('{');
    }
  });

  // 일반 표와 같은 규칙 — 초대는 아무 달에나 뜬다(inviteVoices.test.ts의 금지어와 같은 결).
  it('달력·학교급·계절 단어가 없다', () => {
    const banned = /\d+\s*월|크리스마스|새해|설날|추석|방학|학기|개학|초등|중학|고등|입학|졸업|수능|야자|벚꽃|눈사람/;
    for (const [id, v] of ROMANCE) for (const line of linesOf(v)) expect(line, `${id}: ${line}`).not.toMatch(banned);
  });

  it('거절·못 지킨 약속은 서운함까지만 — 플레이어 탓·죄책감을 지우는 말이 없다', () => {
    const guilt = /너 때문|네 탓|실망|어떻게 그럴|기다렸는데|미안해야|서운하게 했/;
    for (const [id, v] of ROMANCE) for (const line of [...v.decline, ...v.broken]) expect(line, `${id}: ${line}`).not.toMatch(guilt);
  });

  it('일반 표·서로·연인 잡담과 문장을 나누지 않는다', () => {
    const all = ROMANCE.flatMap(([, v]) => linesOf(v));
    expect(new Set(all).size, '연인 표 안에서 중복').toBe(all.length);
    const general = Object.values(INVITE_VOICES).flatMap(v => [...v.hangOut, ...v.study, v.decline, v.kept, v.broken]);
    for (const line of all) expect(general, line).not.toContain(line);
    // 연인 잡담(dialogues.ts 인사말·npcSmalltalk.ts romance)과 문두 다섯 글자까지 겹치지 않는다 — 같은 날 두 화면이 같은 말로
    // 시작하면 복사본으로 읽힌다. 문두만 보니 핵심 구절 겹침("천천히 가자"·"하늘 사진 보내 줄게")은 못 잡는다 — 그건 사람이 읽는다.
    const talk = (['subin', 'jihun'] as const).flatMap(id => [
      ...NPC_DIALOGUES[id].filter(p => p.additive).flatMap(p => p.lines), ...(NPC_SMALLTALK[id].romance?.common ?? []),
    ]);
    const head = (s: string) => s.replace(/^["“]/, '').slice(0, 5);
    expect(talk.length, '전제: 연인 잡담이 있다').toBeGreaterThan(0);
    for (const line of all) expect(talk.map(head), line).not.toContain(head(line));
  });
});

describe('고르기 — 연애 중이면 연인 줄, 아니면 원래 줄', () => {
  const when = '2주차 토요일';
  it.each(['subin', 'jihun'] as const)('%s: dating이면 연인 풀, 아니면 일반 풀', id => {
    const r = ROMANCE_INVITE_VOICES[id], g = inviteVoice(id);
    for (let w = 1; w <= 48; w++) {
      expect(r.hangOut.map(l => l.replace('{when}', when))).toContain(inviteLine(id, 'hang-out', w, when, true));
      expect(r.study.map(l => l.replace('{when}', when))).toContain(inviteLine(id, 'study-group', w, when, true));
      expect(r.decline).toContain(declineLine(id, w, true));
      expect(r.kept).toContain(keptLine(id, w, true));
      expect(r.broken).toContain(brokenLine(id, w, true));
      expect(g.hangOut.map(l => l.replace('{when}', when))).toContain(inviteLine(id, 'hang-out', w, when));
      expect(declineLine(id, w)).toBe(g.decline);
      expect(keptLine(id, w)).toBe(g.kept);
      expect(brokenLine(id, w)).toBe(g.broken);
    }
  });

  // 주차 모듈로로 고른다 — 주 1~48에서 모든 줄이 한 번은 나와야 죽은 줄이 없다.
  it('주 1~48에서 연인 줄이 전부 닿는다', () => {
    for (const [id, v] of ROMANCE) {
      const seen = new Set<string>();
      for (let w = 1; w <= 48; w++) {
        seen.add(inviteLine(id, 'hang-out', w, '{when}', true)).add(inviteLine(id, 'study-group', w, '{when}', true))
          .add(declineLine(id, w, true)).add(keptLine(id, w, true)).add(brokenLine(id, w, true));
      }
      expect(seen.size, id).toBe(linesOf(v).length);
    }
  });

  it('연애 상대가 아닌 친구는 dating을 받아도 원래 줄', () => {
    expect(keptLine('minjae', 5, true)).toBe(inviteVoice('minjae').kept);
    expect(inviteLine('minjae', 'study-group', 5, when, true)).toBe(inviteLine('minjae', 'study-group', 5, when));
  });
});

describe('약속 결과(processWeek) — 연인이면 연인 줄, 수치는 같다', () => {
  const ROUTES = [
    { npcId: 'jihun', gender: 'female' },
    { npcId: 'subin', gender: 'male' },
  ] as const;
  type Route = (typeof ROUTES)[number];
  /** 그 루트의 상대와 hang-out 약속을 주간 화면에서 수락한 주. */
  function promiseState({ npcId, gender }: Route, year: number, week: number, relationship?: RomanceRelationship): GameState {
    const s = createInitialState(gender, ['emotional', 'info'], { rngSeed: 7 });
    Object.assign(s, { year, week, phase: 'weekday', currentEvent: null, isVacation: false, money: 100,
      routineSlot2: 'self-study', routineSlot3: 'self-study', relationship,
      weekInviteAnswers: { year, month: getMonthBlock(week).index,
        answers: [{ npcId, week, slotIdx: 0, activityId: 'hang-out', accepted: true }] } });
    s.npcs.forEach(n => { n.met = n.id === npcId; n.intimacy = n.id === npcId ? 95 : 0; });
    return s;
  }
  const WEEK = 29;
  const dating = (r: Route): RomanceRelationship => ({ npcId: r.npcId, status: 'dating', year: 6, week: 20 });
  const line = (s: GameState, mark: string) => s.weekLog!.messages.find(m => m.startsWith(mark));
  const intimacy = (s: GameState, id: string) => s.npcs.find(n => n.id === id)!.intimacy;
  /** 관계(입력이 다르다)와 약속 결과 줄(바뀌는 게 목적)만 뺀 상태 전체 — 문장 고르기가 난수·수치를 건드리면 여기서 갈린다. */
  const rest = (s: GameState) => JSON.stringify({ ...s, relationship: undefined,
    weekLog: { ...s.weekLog!, messages: s.weekLog!.messages.filter(m => !/^(📌|💔)/.test(m)) } });

  it('전제: 고르는 주는 방학이 아니다', () => {
    expect(getWeekInfo(WEEK).isVacation).toBe(false);
    expect(getWeekInfo(42).isVacation).toBe(false);
  });

  it.each(ROUTES)('$npcId: 지킨 약속 — 연인이면 연인 줄, 친구면 원래 줄, 나머지 상태는 같다', r => {
    const map = { 'hang-out:0': r.npcId };
    const lover = processWeek({ ...promiseState(r, 6, WEEK, dating(r)), weekendChoices: ['hang-out', 'rest'] }, map);
    const friend = processWeek({ ...promiseState(r, 6, WEEK), weekendChoices: ['hang-out', 'rest'] }, map);
    expect(line(lover, '📌')).toContain(keptLine(r.npcId, WEEK, true));
    expect(line(friend, '📌')).toContain(inviteVoice(r.npcId).kept);
    expect(line(lover, '📌')).not.toBe(line(friend, '📌'));
    expect(rest(lover)).toBe(rest(friend));
  });

  it.each(ROUTES)('$npcId: 못 지킨 약속(그 칸을 혼자 했다) — 연인 줄, 약속 없던 판보다 정확히 −2', r => {
    const lover = processWeek({ ...promiseState(r, 6, WEEK, dating(r)), weekendChoices: ['hang-out', 'rest'] }, {});
    const friend = processWeek({ ...promiseState(r, 6, WEEK), weekendChoices: ['hang-out', 'rest'] }, {});
    const noPromise = processWeek({ ...promiseState(r, 6, WEEK, dating(r)), weekInviteAnswers: undefined, weekendChoices: ['hang-out', 'rest'] }, {});
    expect(line(lover, '💔')).toContain(brokenLine(r.npcId, WEEK, true));
    expect(line(friend, '💔')).toContain(inviteVoice(r.npcId).broken);
    expect(line(noPromise, '💔'), '전제: 대조군엔 약속이 없다').toBeUndefined();
    expect(intimacy(lover, r.npcId)).toBe(Math.max(0, intimacy(noPromise, r.npcId) - 2));
    expect(rest(lover)).toBe(rest(friend));
  });

  // 실제 이별은 Y7 졸업 장면(40~42주)의 '여기까지'에서만 생긴다 — 그 뒤 남은 주의 약속.
  it.each(ROUTES)("$npcId: 졸업 장면에서 헤어진 뒤(ended)엔 원래 줄, 계속 만나기로 했으면(together) 연인 줄", r => {
    const map = { 'hang-out:0': r.npcId };
    const ended = processWeek({ ...promiseState(r, 7, 42,
      { npcId: r.npcId, status: 'ended', year: 6, week: 20, graduation: 'apart' }), weekendChoices: ['hang-out', 'rest'] }, map);
    const together = processWeek({ ...promiseState(r, 7, 42,
      { npcId: r.npcId, status: 'dating', year: 6, week: 20, graduation: 'together' }), weekendChoices: ['hang-out', 'rest'] }, map);
    expect(line(ended, '📌')).toContain(inviteVoice(r.npcId).kept);
    expect(line(together, '📌')).toContain(keptLine(r.npcId, 42, true));
  });

  it('성별이 맞지 않는 관계 값(손상 세이브)은 연애로 보지 않는다', () => {
    const wrong = promiseState(ROUTES[1], 6, WEEK, dating(ROUTES[0]));
    wrong.weekInviteAnswers!.answers[0].npcId = 'jihun';
    wrong.npcs.find(n => n.id === 'jihun')!.met = true;
    const out = processWeek({ ...wrong, weekendChoices: ['hang-out', 'rest'] }, { 'hang-out:0': 'jihun' });
    expect(line(out, '📌')).toContain(inviteVoice('jihun').kept);
  });
});
