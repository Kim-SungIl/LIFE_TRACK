// 연인 말투(talkData/inviteVoices.ts ROMANCE_INVITE_VOICES) — 사귀는 상대의 초대·약속 줄만 바뀌고 수치는 하나도 안 바뀐다.
import { describe, expect, it } from 'vitest';
import { createInitialState, processWeek } from '../gameEngine';
import { NPC_DIALOGUES } from '../dialogues';
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
    // 연인 잡담(dialogues.ts)과 문두 다섯 글자까지 겹치지 않는다 — 같은 날 두 화면이 같은 말로 시작하면 복사본으로 읽힌다.
    const talk = (['subin', 'jihun'] as const).flatMap(id => NPC_DIALOGUES[id].filter(p => p.additive).flatMap(p => p.lines));
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
  const WEEK = 29;
  /** Y6 2학기 — 지훈(여주 루트)과 hang-out 약속을 주간 화면에서 수락한 주. */
  function promiseState(relationship?: RomanceRelationship): GameState {
    const s = createInitialState('female', ['emotional', 'info'], { rngSeed: 7 });
    Object.assign(s, { year: 6, week: WEEK, phase: 'weekday', currentEvent: null, isVacation: false, money: 100,
      routineSlot2: 'self-study', routineSlot3: 'self-study', relationship,
      weekInviteAnswers: { year: 6, month: getMonthBlock(WEEK).index,
        answers: [{ npcId: 'jihun', week: WEEK, slotIdx: 0, activityId: 'hang-out', accepted: true }] } });
    s.npcs.forEach(n => { n.met = n.id === 'jihun'; n.intimacy = n.id === 'jihun' ? 95 : 0; });
    return s;
  }
  const dating: RomanceRelationship = { npcId: 'jihun', status: 'dating', year: 6, week: 20 };
  const numbers = (s: GameState) => JSON.stringify({ stats: s.stats, npcs: s.npcs, money: s.money, fatigue: s.fatigue });
  const line = (s: GameState, mark: string) => s.weekLog!.messages.find(m => m.startsWith(mark));

  it('전제: 방학이 아닌 주', () => expect(getWeekInfo(WEEK).isVacation).toBe(false));

  it('지킨 약속 — 연인이면 연인 줄, 친구면 원래 줄, 나머지는 바이트 동일', () => {
    const map = { 'hang-out:0': 'jihun' };
    const lover = processWeek({ ...promiseState(dating), weekendChoices: ['hang-out', 'rest'] }, map);
    const friend = processWeek({ ...promiseState(), weekendChoices: ['hang-out', 'rest'] }, map);
    expect(line(lover, '📌')).toContain(keptLine('jihun', WEEK, true));
    expect(line(friend, '📌')).toContain(inviteVoice('jihun').kept);
    expect(numbers(lover)).toBe(numbers(friend));
    expect(lover.weekLog!.messages.filter(m => !m.startsWith('📌'))).toEqual(friend.weekLog!.messages.filter(m => !m.startsWith('📌')));
  });

  it('못 지킨 약속(그 칸을 혼자 했다) — 연인 줄, 친밀도 −2는 그대로', () => {
    const lover = processWeek({ ...promiseState(dating), weekendChoices: ['hang-out', 'rest'] }, {});
    const friend = processWeek({ ...promiseState(), weekendChoices: ['hang-out', 'rest'] }, {});
    expect(line(lover, '💔')).toContain(brokenLine('jihun', WEEK, true));
    expect(line(friend, '💔')).toContain(inviteVoice('jihun').broken);
    expect(numbers(lover)).toBe(numbers(friend));
  });

  it('헤어진 뒤(ended)엔 원래 줄로 돌아간다', () => {
    const ended = { ...promiseState(), year: 7 } as GameState;
    ended.relationship = { npcId: 'jihun', status: 'ended', year: 6, week: 20, graduation: 'apart' };
    ended.weekInviteAnswers = { ...ended.weekInviteAnswers!, year: 7 };
    const out = processWeek({ ...ended, weekendChoices: ['hang-out', 'rest'] }, { 'hang-out:0': 'jihun' });
    expect(line(out, '📌')).toContain(inviteVoice('jihun').kept);
  });
});
