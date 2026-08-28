// @vitest-environment jsdom
// 첫 화면 폰트 preload 층 1 — 상수 ↔ 화면.
// FIRST_PAINT_TEXT에서 조각을 고르므로, 상수가 화면과 어긋나면 틀린 조각을 조용히 받는다.
// 소스 파일의 선언이 아니라 <TitleScreen />이 실제로 그리는 textContent를 걷는다.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, cleanup } from '@testing-library/react';
import { TitleScreen } from '../TitleScreen';
import { createInitialState } from '../../engine/gameEngine';
import { CURRENT_SAVE_VERSION } from '../../engine/stateMigration';
import { emptyArchive } from '../../engine/archive';
import { useGameStore } from '../../engine/store';
import { setMuted } from '../../audio/audioEngine';
import {
  FIRST_PAINT_TEXT,
  FIRST_PAINT_EXCEPTION_GLYPHS,
  MAX_FIRST_PAINT_PRELOAD_SUBSETS,
  parseFontFaceSubsets,
  selectSubsetIndices,
  subsetIndexCovering,
} from '../../styles/first-paint-fonts';

const CSS_PATH = resolve(process.cwd(), 'src/styles/pretendard.css');
const SAVE_KEY = 'lifetrack_save';
const ARCHIVE_KEY = 'lifetrack_archive';

const faces = parseFontFaceSubsets(readFileSync(CSS_PATH, 'utf8'));
const selected = new Set(selectSubsetIndices(FIRST_PAINT_TEXT, faces));

function seedSave(): void {
  const state = JSON.parse(JSON.stringify(
    createInitialState('male', ['emotional', 'info'], { rngSeed: 7 }),
  ));
  state.year = 3;
  state.week = 12;
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    version: CURRENT_SAVE_VERSION,
    state,
    savedAt: '2026-08-27T12:30:00.000Z',
  }));
}

function seedArchive(): void {
  const a = emptyArchive();
  a.events = ['seed-event'];
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(a));
}

/** 92조각에 없는 그려지는 글리프(공백·제어문자 제외). */
function uncoveredGraphicGlyphs(text: string): string[] {
  const out: string[] = [];
  for (const ch of new Set(text)) {
    if (subsetIndexCovering(ch, faces) !== undefined) continue;
    if (/\s/u.test(ch)) continue;
    out.push(ch);
  }
  return out;
}

function assertScreenCoveredByFirstPaint(text: string, label: string): void {
  const missingFromConstant: string[] = [];
  const missingFromSelected: string[] = [];
  for (const ch of new Set(text)) {
    const idx = subsetIndexCovering(ch, faces);
    if (idx === undefined) continue;
    if (!FIRST_PAINT_TEXT.includes(ch)) missingFromConstant.push(ch);
    if (!selected.has(idx)) missingFromSelected.push(ch);
  }
  expect(missingFromConstant, `${label}: 화면 글자가 FIRST_PAINT_TEXT에 없다`).toEqual([]);
  expect(missingFromSelected, `${label}: 화면 글자가 preload 조각 밖`).toEqual([]);
}

beforeEach(() => {
  localStorage.clear();
  useGameStore.setState({ state: null });
  setMuted(false);   // 음소거는 모듈 캐시라 테스트 간에 새어 나간다
});

describe('타이틀 첫 페인트 폰트 preload 대상', () => {
  it('pretendard.css에서 unicode-range를 파싱한다 (빈 매칭으로 통과하는 것 방지)', () => {
    expect(faces.length).toBeGreaterThanOrEqual(50);
    expect(readFileSync(CSS_PATH, 'utf8')).toContain('unicode-range:');
  });

  it('FIRST_PAINT_TEXT가 고른 조각 수는 상한 안이고 0이 아니다', () => {
    expect(selected.size).toBeGreaterThan(0);
    expect(selected.size).toBeLessThanOrEqual(MAX_FIRST_PAINT_PRELOAD_SUBSETS);
  });

  it('세이브 없는 표지의 서브셋 글자는 FIRST_PAINT_TEXT 조각이 덮는다', () => {
    render(<TitleScreen />);
    const text = document.body.textContent ?? '';
    expect(text).toContain('새 게임');
    expect(text).not.toContain('이어하기');
    assertScreenCoveredByFirstPaint(text, '세이브 없음');
  });

  it('세이브·기록실 있는 표지의 서브셋 글자도 FIRST_PAINT_TEXT 조각이 덮는다', () => {
    seedSave();
    seedArchive();
    render(<TitleScreen />);
    const text = document.body.textContent ?? '';
    expect(text).toContain('이어하기');
    expect(text).toContain('기록실');
    expect(text).toContain('지금까지의 학창시절');
    expect(text).toContain('저장됨');
    expect(text).toContain('주차');
    assertScreenCoveredByFirstPaint(text, '세이브·기록실');
  });

  it('예외 글리프는 닫힌 목록이고 92조각 밖에 있으며 화면에 실제로 나온다', () => {
    render(<TitleScreen />);
    const noSave = uncoveredGraphicGlyphs(document.body.textContent ?? '');
    cleanup();

    seedSave();
    seedArchive();
    render(<TitleScreen />);
    const withSave = uncoveredGraphicGlyphs(document.body.textContent ?? '');
    cleanup();

    // 음소거를 저장해 둔 사용자는 🔊 대신 🔇을 본다. 기본 상태만 렌더하고 "닫힌 목록"이라고
    // 하면 그 사용자의 화면에 대해 거짓이 된다. localStorage 시드가 아니라 setMuted를 쓰는
    // 이유: audioEngine이 설정을 모듈 수준에 캐시해서, 이미 읽힌 뒤의 시드는 안 먹는다.
    setMuted(true);
    render(<TitleScreen />);
    const muted = uncoveredGraphicGlyphs(document.body.textContent ?? '');
    expect(document.body.textContent, '음소거 표지에 🔇이 나온다').toContain('🔇');

    const actual = new Set([...noSave, ...withSave, ...muted]);
    const declared = new Set(FIRST_PAINT_EXCEPTION_GLYPHS);

    expect([...declared].sort(), '예외 목록이 화면의 비-서브셋 글리프와 같다')
      .toEqual([...actual].sort());

    for (const ch of FIRST_PAINT_EXCEPTION_GLYPHS) {
      expect(subsetIndexCovering(ch, faces), `예외 '${ch}'가 92조각 안에 있다`).toBeUndefined();
    }
  });
});
