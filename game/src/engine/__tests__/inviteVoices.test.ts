// 친구 초대·약속 말투(talkData/inviteVoices.ts) — 표가 빠짐없고, 아무 달에나 뜰 수 있는 말이고, 화면에 실제로 나간다.
import { describe, expect, it } from 'vitest';
import { DEFAULT_INVITE_VOICE, INVITE_VOICES, inviteLine, inviteVoice } from '../talkData/inviteVoices';
import { INITIAL_NPCS } from '../npcRoster';

const ALL = Object.entries(INVITE_VOICES);

describe('초대 말투 표', () => {
  it('지금 있는 친구 전원이 자기 말투를 갖는다(공용 줄로 새지 않는다)', () => {
    expect(INITIAL_NPCS.length, '전제: 친구 명단').toBeGreaterThan(5);
    for (const n of INITIAL_NPCS) expect(INVITE_VOICES[n.id], `${n.id}의 초대 말투가 없다`).toBeTruthy();
    expect(inviteVoice('nobody')).toBe(DEFAULT_INVITE_VOICE);
  });

  it('초대 줄은 때({when})를 정확히 한 번 담고, 결과 줄은 담지 않는다', () => {
    for (const [id, v] of [...ALL, ['default', DEFAULT_INVITE_VOICE] as const]) {
      expect(v.hangOut.length, id).toBeGreaterThan(0);
      expect(v.study.length, id).toBeGreaterThan(0);
      for (const line of [...v.hangOut, ...v.study]) expect(line.split('{when}').length - 1, `${id}: ${line}`).toBe(1);
      for (const line of [v.decline, v.kept, v.broken]) {
        expect(line.length, id).toBeGreaterThan(0);
        expect(line, id).not.toContain('{');
      }
    }
  });

  it('친구끼리 같은 결과 줄을 쓰지 않는다 — 누가 불러도 같은 말이면 표를 둔 이유가 없다', () => {
    for (const key of ['kept', 'broken', 'decline'] as const) {
      const lines = ALL.map(([, v]) => v[key]);
      expect(new Set(lines).size, key).toBe(lines.length);
    }
  });

  // 초대는 아무 달·학교급·계절에나 뜬다(지훈은 초등부터) — 그 자리에 묶인 단어는 쓰지 않는다(calendarWordsFit과 같은 결).
  it('달력·학교급·계절에 묶인 단어가 없다', () => {
    const banned = /\d+\s*월|크리스마스|새해|설날|추석|방학|학기|개학|초등|중학|고등|입학|졸업|수능|야자|벚꽃|눈사람/;
    for (const [id, v] of ALL) {
      for (const line of [...v.hangOut, ...v.study, v.decline, v.kept, v.broken]) expect(line, `${id}: ${line}`).not.toMatch(banned);
    }
  });

  it('inviteLine — 활동에 맞는 풀에서, 주차로 고른다(같은 초대는 같은 말)', () => {
    const when = '2주차 토요일';
    const play = inviteLine('jihun', 'hang-out', 6, when);
    expect(INVITE_VOICES.jihun.hangOut.map(l => l.replace('{when}', when))).toContain(play);
    expect(inviteLine('jihun', 'hang-out', 6, when)).toBe(play);
    expect(inviteLine('jihun', 'hang-out', 7, when), '주차가 바뀌면 다른 변이').not.toBe(play);
    expect(inviteLine('minjae', 'study-group', 5, when)).toContain(when);
    expect(INVITE_VOICES.minjae.study.map(l => l.replace('{when}', when))).toContain(inviteLine('minjae', 'study-group', 5, when));
  });
});
