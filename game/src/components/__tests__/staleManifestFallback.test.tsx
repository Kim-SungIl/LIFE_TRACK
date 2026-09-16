// @vitest-environment jsdom
// **manifest가 디스크보다 앞선 상태**에서 그림이 살아남는가.
//
// manifest 선선택으로 바꾸면서 예전 `onError` 체인이 사라졌던 적이 있다. 그때는 고른 파일
// 하나가 실패하면 갈 곳이 CSS 아바타뿐이라, 실재하는 neutral을 두고도 그림이 통째로 사라졌다.
// 여기서 잠그는 건 그 복구 경로다 — 정상 경로의 요청이 1회라는 것은
// characterManifest.test.ts(pickAllExisting)가 따로 본다.
//
// 이 파일이 없을 때 아래 두 뮤테이션이 전체 스위트를 초록으로 통과했다(실측):
//   · Portrait.tsx   onError → no-op
//   · EventScene.tsx onError → no-op
// jsdom은 이미지를 실제로 로드하지 않으므로 `fireEvent.error`로 직접 발화시킨다.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

// 유령 항목이 섞인 manifest — 첫 후보는 목록에 있지만 디스크에는 없는 상황.
vi.mock('../../character-manifest.generated', () => ({
  CHARACTER_MANIFEST: new Set([
    'jihun_high_happy.png',        // 유령 — 지워진 파일
    'jihun_high_neutral.png',      // 실재
    'jihun_high_fullbody_f.png',   // 유령
    'jihun_high_fullbody.png',     // 실재
  ]),
}));

vi.mock('../../engine/assetWebp', () => ({ webpSrc: (p: string) => p }));

import { Portrait } from '../Portrait';
import { EventScene } from '../EventScene';
import { makeEvent } from '../../test/fixtures';

const BASE = import.meta.env.BASE_URL;
const file = (el: Element | null) => (el?.getAttribute('src') ?? '').replace(`${BASE}images/characters/`, '');

beforeEach(() => vi.clearAllMocks());

describe('Portrait — 유령 항목을 만나면 다음 실재 후보로 넘어간다', () => {
  it('happy 실패 → neutral, 그마저 실패해야 CSS 아바타', () => {
    const { container } = render(<Portrait characterId="jihun" year={6} expression="happy" />);

    // 1) manifest가 가리키는 첫 후보를 요청한다.
    expect(file(container.querySelector('img'))).toBe('jihun_high_happy.png');

    // 2) 실패하면 CSS로 떨어지지 않고 **다음 실재 후보**로 간다.
    fireEvent.error(container.querySelector('img')!);
    expect(file(container.querySelector('img'))).toBe('jihun_high_neutral.png');

    // 3) 후보를 다 쓴 뒤에야 CSS 아바타(= img 없음)다.
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
  });

  it('후보가 아예 없는 id는 요청 없이 곧장 CSS 아바타', () => {
    const { container } = render(<Portrait characterId="nobody" year={6} expression="happy" />);
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('EventScene — 유령 _f 변주를 만나면 공용 전신으로 넘어간다', () => {
  function sprite(container: HTMLElement) {
    return container.querySelector('img[alt="jihun"]');
  }

  it('_f 실패 → 공용 전신 → neutral 순으로 내려간다', () => {
    const { container } = render(
      <EventScene event={makeEvent({ speakers: ['jihun'] })} gender="female" year={6} onChoice={() => {}} />,
    );

    expect(file(sprite(container))).toBe('jihun_high_fullbody_f.png');

    fireEvent.error(sprite(container)!);
    expect(file(sprite(container))).toBe('jihun_high_fullbody.png');

    fireEvent.error(sprite(container)!);
    expect(file(sprite(container))).toBe('jihun_high_neutral.png');

    fireEvent.error(sprite(container)!);
    expect(sprite(container)).toBeNull();
  });
});
