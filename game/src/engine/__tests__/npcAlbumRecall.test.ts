// 앨범 확대 화면의 추억 한 줄(npcAlbum.ts slotRecall) — 그 판본에서 선택지 하나만 대표하는 칸만,
// 그 판본의 문장으로. 판본을 섞어 세거나 여주 선택지를 무시하는 회귀를 값으로 잠근다.
import { describe, expect, it } from 'vitest';
import { npcAlbum, romanceSlotsFor, slotRecall, type AlbumSlot } from '../npcAlbum';
import { INITIAL_NPCS } from '../npcRoster';
import { SOLO_ROOT } from '../npcStoryPool';

const find = (npc: string, eventId: string, ci: number, bucket?: string): AlbumSlot => {
  const hit = npcAlbum(npc).filter(b => !bucket || b.key === bucket).flatMap(b => b.slots)
    .find(s => s.eventId === eventId && s.choiceIndex === ci);
  if (!hit) throw new Error(`칸 없음: ${npc} ${eventId}#${ci}`);
  return hit;
};

describe('추억 한 줄', () => {
  it('착지값 — 전 인물·두 판본에서 한 줄이 붙는 칸 수', () => {
    let n = 0;
    for (const id of [...INITIAL_NPCS.map(x => x.id), SOLO_ROOT]) for (const b of npcAlbum(id)) for (const s of b.slots) {
      if (s.male && slotRecall(s, 'male')) n++;
      if (s.female && slotRecall(s, 'female')) n++;
    }
    expect(n).toBe(246);
  });

  it('판본마다 그 판본의 문장 — 여주판은 femaleChoices를 읽는다', () => {
    const sign = find('doyun', 'doyun-graduation-sign', 0);
    expect(slotRecall(sign, 'male')).toBe("졸업앨범 뒤에 도윤이가 그린 작은 축구공과 '모른 척하지 마라'.");
    expect(slotRecall(sign, 'female')).toBe("졸업앨범 끝, 도윤이가 작게 '너답다' 했던 한순간.");
    const study = find('yuna', 'yuna-study', 0, 'middle');
    expect(slotRecall(study, 'male')).toBe('도서관 책상 위 유나의 "천재 아냐?" — 웃는 목소리가 이상하게 오래 남았다.');
    expect(slotRecall(study, 'female')).toBe('도서관에서 유나에게 수학을 가르쳐준 날, 같이 푸니 더 잘 풀렸다.');
  });

  it('연인 칸 — 졸업 약속만 한 줄, 재고백과 그림을 나눠 쓰는 고백·두 선택이 한 그림인 만남은 제목만', () => {
    const subin = romanceSlotsFor('subin', 'male');
    const jihun = romanceSlotsFor('jihun', 'female');
    expect(subin.map(s => slotRecall(s, 'male'))).toEqual([null, null, '수빈이와 각자의 꿈을 응원하며 계속 만나기로 했다.']);
    expect(jihun.map(s => slotRecall(s, 'female'))).toEqual([null, null, '지훈이와 사진을 찍으며 졸업 뒤의 만남을 약속했다.']);
    expect(jihun.map(s => s.eventId)).toEqual(['jihun-hs-unsaid', 'jihun-romance-outing', 'jihun-hs-graduation']);
  });
});
