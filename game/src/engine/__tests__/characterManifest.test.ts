// 캐릭터 자산 해석 계약 — **없는 파일을 요청하지 않는다.**
//
// 예전엔 첫 후보를 그냥 요청하고 onError로 넘어갔다. 실측:
//   · dev는 SPA 폴백이 200 `text/html` 1,278B를 주고 디코드가 깨진다(404가 아니다).
//   · 배포(GitHub Pages)는 진짜 404다.
// 어느 쪽이든 요청 1회 + 디코드 실패 + 리렌더가 붙는다.
import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { portraitCandidates, spriteCandidates, pickExisting } from '../characterAssets';
// @ts-expect-error — 스크립트 쪽 .mjs라 타입 선언이 없다. 규칙을 생성기와 공유하는 게 목적이다.
import { isAssetFile } from '../../../scripts/lib/asset-filter.mjs';
import { CHARACTER_MANIFEST } from '../../character-manifest.generated';

const CHAR_DIR = resolve(process.cwd(), 'public/images/characters');
const onDisk = new Set(readdirSync(CHAR_DIR).filter(isAssetFile));

describe('manifest는 디스크와 일치한다', () => {
  // 생성기가 predev/prebuild 훅에 붙어 있지만, 커밋된 산출물이 낡으면
  // 실재하는 표정이 조용히 안 켜진다(표정 발주가 들어오는 축이라 특히 중요).
  it('생성된 manifest = 디스크의 png 집합', () => {
    expect(onDisk.size, '전제: 캐릭터 자산이 있다').toBeGreaterThan(0);
    expect([...CHARACTER_MANIFEST].sort()).toEqual([...onDisk].sort());
  });

  // **합성 입력으로 규칙 자체를 본다.** 실데이터엔 `_` 접두 png가 0건이라
  // 실데이터만 보면 필터를 지워도 초록이다(#437과 같은 구멍).
  it.each([
    ['doyun_high_neutral.png', true],
    ['_archive', false],
    ['_wip_doyun.png', false],
    ['notes.txt', false],
    ['doyun_high_neutral.webp', false],
  ] as const)('자산 필터: %s → %s', (name, expected) => {
    expect(isAssetFile(name)).toBe(expected);
  });
});

describe('초상 후보 해석', () => {
  it('실재하는 표정이 있으면 그것을 고른다', () => {
    // 부모 happy 2장이 지금 유일한 양성 표본이다.
    expect(pickExisting(portraitCandidates('mother', 'happy', 3), CHARACTER_MANIFEST))
      .toBe('mother_middle_happy.png');
  });

  it('없는 표정은 같은 학년의 neutral로 내려간다 (요청하지 않는다)', () => {
    const got = pickExisting(portraitCandidates('jihun', 'happy', 6), CHARACTER_MANIFEST);
    expect(got).toBe('jihun_high_neutral.png');
  });

  // mentalToExpression이 돌려주는 값 전부가 헛 요청을 만들지 않아야 한다.
  it.each(['happy', 'sad', 'tired', 'burnout', 'neutral'] as const)(
    'mental 표정 %s — 고른 파일은 반드시 실재한다', (expr) => {
      for (const year of [1, 3, 6]) {
        for (const id of ['player_m', 'player_f']) {
          const got = pickExisting(portraitCandidates(id, expr, year), CHARACTER_MANIFEST);
          expect(got, `${id} Y${year} ${expr}`).toBeTruthy();
          expect(onDisk.has(got!), `${got}가 디스크에 없다`).toBe(true);
        }
      }
    });

  // 부모는 `_middle`만 있다. 가정 모달이 매주 열리므로 초·고 학년에서 이 폴백이 실사용 경로다.
  // (초6·고3에도 중학 얼굴이라는 건 알려진 자산 공백이지 버그가 아니다 — 표정 발주와 별건.)
  it.each([
    ['mother', 1, 'mother_middle_neutral.png'],
    ['mother', 6, 'mother_middle_neutral.png'],
    ['father', 1, 'father_middle_neutral.png'],
  ] as const)('%s Y%d — staged 자산이 없으면 _middle로 내려간다', (id, year, want) => {
    expect(pickExisting(portraitCandidates(id, 'neutral', year), CHARACTER_MANIFEST)).toBe(want);
  });

  // 부모 happy도 _middle뿐이라 같은 폴백을 탄다 — 표정과 학년 폴백이 함께 걸리는 유일한 조합.
  it('mother Y6 happy — 표정과 _middle 폴백이 함께 걸린다', () => {
    expect(pickExisting(portraitCandidates('mother', 'happy', 6), CHARACTER_MANIFEST))
      .toBe('mother_middle_happy.png');
  });

  it('자산이 아예 없는 id는 null (→ CSS 아바타)', () => {
    expect(pickExisting(portraitCandidates('nobody', 'neutral', 3), CHARACTER_MANIFEST)).toBeNull();
  });
});

describe('스프라이트 후보 해석', () => {
  // 여주는 `_f` 변주를 먼저 보는데 실물은 28장 중 jihun_elementary 하나뿐이었다.
  it('여주 변주가 있으면 그것을 고른다', () => {
    expect(pickExisting(spriteCandidates('jihun', 'female', 1), CHARACTER_MANIFEST))
      .toBe('jihun_elementary_fullbody_f.png');
  });

  it('여주 변주가 없으면 공용 전신으로 (헛 요청 없이)', () => {
    const got = pickExisting(spriteCandidates('doyun', 'female', 6), CHARACTER_MANIFEST);
    expect(got).toBe('doyun_high_fullbody.png');
  });

  it('남주는 _f를 아예 후보에 넣지 않는다', () => {
    expect(spriteCandidates('doyun', 'male', 6).some(f => f.includes('_f.png'))).toBe(false);
  });

  // 전수 — 어떤 (NPC, 성별, 학년) 조합도 실재하지 않는 파일을 고르지 않는다.
  it('모든 조합에서 고른 파일은 실재하거나 null이다', () => {
    const ids = [...new Set([...onDisk].map(f => f.replace(/_(elementary|middle|high)_.*$/, '')))];
    expect(ids.length, '전제: 캐릭터 id를 뽑았다').toBeGreaterThanOrEqual(10);
    let resolved = 0;
    for (const id of ids) {
      for (const gender of ['male', 'female'] as const) {
        for (const year of [1, 2, 3, 4, 5, 6, 7]) {
          const got = pickExisting(spriteCandidates(id, gender, year), CHARACTER_MANIFEST);
          if (got) { expect(onDisk.has(got), `${got}`).toBe(true); resolved++; }
        }
      }
    }
    // 커버리지 하한 — corpus가 0이면 이 테스트는 자기가 지워져도 초록이다.
    expect(resolved, '해석된 조합이 너무 적다').toBeGreaterThan(100);
  });
});
