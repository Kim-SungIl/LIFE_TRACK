// @vitest-environment jsdom
// 타이틀 부모 선택 요약의 인용부호 계약.
//
// MEMORIES[].scene 6개 중 5개가 **문장 안에 이미 자기 인용부호를 갖고 있다**(대사이므로).
// 요약 줄이 이걸 또 `"{scene}"`으로 감싸서 게임을 켠 사람이 처음 보는 화면에
// `""엄마가 알아봤는데, 이 학원이 좋대""`가 떴다. 카드(위쪽 {m.scene})는 그대로 쓰는데
// 요약만 감싸서 같은 값이 두 자리에서 다르게 보였다.
//
// scene 데이터는 성격이 섞여 있다 — 대사 5개 + 상황 묘사 1개(wealth: "넓은 아파트, …").
// 그래서 규약은 "감싸지 않고 데이터를 그대로 믿는다"쪽이다. 데이터에서 인용부호를 떼면
// 묘사 항목이 어색해지고 대사 항목이 대사로 안 읽힌다.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../engine/assetWebp', () => ({
  webpSrc: (p: string) => `WEBP::${p}`,
}));

import { TitleScreen } from '../TitleScreen';

/** 타이틀 → 성별 → 회상 → 부모 카드. 초기 화면엔 오디오 토글 2개(aria-pressed)만 있어
 *  곧바로 `button[aria-pressed]`를 집으면 그 토글을 부모 카드로 오인한다. */
function gotoParentPicker(): void {
  fireEvent.click(screen.getByText('새 게임'));
  fireEvent.click(screen.getByLabelText('남자 주인공으로 시작'));
  fireEvent.click(screen.getByText('기억을 더듬어본다'));
}

/** 부모 카드는 <button aria-pressed>다. 대사형(자기 인용부호를 가진) 카드 2장을 누른다. */
function pickCards(): { scenes: string[] } {
  const cards = Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-pressed]'));
  expect(cards.length).toBeGreaterThanOrEqual(2);
  const quoted = cards.filter(c => (c.textContent ?? '').includes('"'));
  expect(quoted.length).toBeGreaterThanOrEqual(2);
  const chosen = quoted.slice(0, 2);
  const scenes = chosen.map(c => {
    const m = (c.textContent ?? '').match(/"[^"]+"/);
    if (!m) throw new Error('대사형 카드에서 인용부호 구간을 못 찾았습니다');
    return m[0];
  });
  for (const c of chosen) fireEvent.click(c);
  return { scenes };
}

/** "그런 집이었다."를 품은 요약 블록 */
function summaryBlock(): HTMLElement {
  const tail = screen.getByText(/그런 집이었다/);
  const block = tail.closest('div')?.parentElement;
  if (!block) throw new Error('요약 블록을 찾지 못했습니다');
  return block as HTMLElement;
}

describe('타이틀 부모 요약 — scene 인용부호', () => {
  it('요약이 scene을 감싸지 않는다 (연속 인용부호 없음)', () => {
    render(<TitleScreen />);
    gotoParentPicker();
    pickCards();
    const text = summaryBlock().textContent ?? '';
    expect(text).toMatch(/그런 집이었다/);
    // 감싸면 `""…""`가 되어 연속 인용부호가 생긴다. 이게 유일하고 확실한 신호다.
    expect(text).not.toMatch(/""/);
  });

  it('요약에 뜬 대사가 카드와 같은 형태다 (한 값이 두 자리에서 다르게 보이지 않는다)', () => {
    render(<TitleScreen />);
    gotoParentPicker();
    const { scenes } = pickCards();
    const text = summaryBlock().textContent ?? '';
    for (const s of scenes) {
      // 카드에서 읽은 인용부호 구간이 요약에도 **그대로** 있어야 한다.
      expect(text).toContain(s);
    }
  });

  it('선택이 2개가 아니면 요약이 아예 없다 (요약 계약의 전제)', () => {
    render(<TitleScreen />);
    gotoParentPicker();
    expect(screen.queryByText(/그런 집이었다/)).not.toBeInTheDocument();

    // 1개만 골라도 여전히 없다 — 요약은 2개 확정에서만 뜬다.
    const cards = Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-pressed]'));
    fireEvent.click(cards[0]);
    expect(screen.queryByText(/그런 집이었다/)).not.toBeInTheDocument();
  });
});
