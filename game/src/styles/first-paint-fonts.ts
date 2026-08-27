// 첫 화면(phase 'title') Pretendard 조각 preload — 조각 번호를 박지 않는다.
//
// 서브셋 생성기를 다시 돌리면 번호↔글리프 매핑이 바뀐다. 82·84·86… 를 상수로 두면
// 그 순간부터 조용히 틀린 조각을 받는다(FOUT도 안 나고 테스트도 안 터진다).
// 대신 화면에 그리는 텍스트의 코드포인트가 덮는 조각만, 빌드 시 unicode-range로 고른다.
//
// 대상은 세이브/기록실 변형을 포함한 9조각. 이어하기·기록실은 돌아온 플레이어의 첫 화면이고,
// 실측 +26KB(8조각 202.9KB → 9조각 229.2KB)는 JS 861KB·critical 이미지와 견주면 싸다.
// 85는 이 텍스트에 없어서 빠진다 — "82~91 통째로" 근사는 틀린 이유.

/** 표지 phase 'title'에 그려지는 문자열. 세이브 없음 + 이어하기/기록실 분기. */
export const FIRST_PAINT_TEXT = [
  'LIFE TRACK',
  '7년의 시간표',
  '어른이 되기 전, 매주 하나씩 남긴 선택',
  '초6', '중1', '중2', '중3', '고1', '고2', '고3',
  '초등학교 6학년부터 고등학교 3학년까지.',
  '작은 선택들이 친구, 성적, 마음의 방향을 바꾼다.',
  '새 게임',
  // 세이브 있음 — TitleScreen 이어하기 줄
  '이어하기',
  '년차',
  '주차',
  '저장됨',
  // 기록실 있음
  '기록실',
  '지금까지의 학창시절',
  // 세이브 시각 toLocaleString('ko-KR') + 주차 숫자. 조각은 이미 고른 9개 안에 있다.
  // 브라우저 ICU는 '오전/오후', Node/jsdom은 'AM/PM'을 넣는 경우가 있다. 둘 다 표지에 그려진다.
  '오전',
  '오후',
  'AM',
  'PM',
  ':',
  '0123456789',
].join('');

/**
 * 표지에 그려지지만 92조각 어디에도 없는 글리프(시스템 이모지 폰트).
 * 넓히면 실패가 전부 예외로 흡수되므로, 화면에 실제로 나오는 것만 닫힌 목록으로 둔다.
 */
export const FIRST_PAINT_EXCEPTION_GLYPHS: readonly string[] = ['🔊', '🎵'];

/** 실측 9조각 / 229.2KB. 여유는 카피 한두 글자 수준. 92조각(2.82MB)은 통과 못 한다. */
export const MAX_FIRST_PAINT_PRELOAD_SUBSETS = 12;
export const MAX_FIRST_PAINT_PRELOAD_BYTES = 280 * 1024;

export type UnicodeRange = { start: number; end: number };

export type FontFaceSubset = {
  index: number;
  /** CSS url() 안의 문자열 그대로(따옴표 제거). preload href와 글자 단위로 같아야 한다. */
  url: string;
  ranges: UnicodeRange[];
};

export function parseUnicodeRange(value: string): UnicodeRange[] {
  const ranges: UnicodeRange[] = [];
  const re = /U\+([0-9A-Fa-f?]+)(?:-([0-9A-Fa-f?]+))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) !== null) {
    const startHex = m[1].replace(/\?/g, '0');
    const endHex = (m[2] ?? m[1]).replace(/\?/g, 'F');
    ranges.push({ start: parseInt(startHex, 16), end: parseInt(endHex, 16) });
  }
  return ranges;
}

function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * @font-face 블록에서 서브셋 번호(파일명의 subset.N)와 unicode-range·url을 읽는다.
 * 소스 pretendard.css와 미니파이된 dist CSS 둘 다 같은 정규식을 탄다.
 */
export function parseFontFaceSubsets(css: string): FontFaceSubset[] {
  const faces: FontFaceSubset[] = [];
  const blocks = stripCssComments(css).match(/@font-face\s*\{[^}]*\}/gi) ?? [];
  for (const block of blocks) {
    const urlMatch = block.match(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/i);
    if (!urlMatch) continue;
    const url = urlMatch[2].trim();
    const indexMatch = url.match(/subset\.(\d+)/);
    if (!indexMatch) continue;
    const rangeMatch = block.match(/unicode-range\s*:\s*([^;}]*)/i);
    faces.push({
      index: Number(indexMatch[1]),
      url,
      ranges: rangeMatch ? parseUnicodeRange(rangeMatch[1]) : [],
    });
  }
  return faces;
}

export function subsetIndexCovering(ch: string, faces: FontFaceSubset[]): number | undefined {
  const cp = ch.codePointAt(0);
  if (cp === undefined) return undefined;
  const face = faces.find(f => f.ranges.some(r => cp >= r.start && cp <= r.end));
  return face?.index;
}

export function selectSubsetIndices(text: string, faces: FontFaceSubset[]): number[] {
  const needed = new Set<number>();
  for (const ch of text) {
    const idx = subsetIndexCovering(ch, faces);
    if (idx !== undefined) needed.add(idx);
  }
  return [...needed].sort((a, b) => a - b);
}

/** FIRST_PAINT_TEXT가 덮는 조각의 url. dist CSS에 쓰면 preload href 기댓값. */
export function expectedPreloadUrls(css: string, text: string = FIRST_PAINT_TEXT): string[] {
  const faces = parseFontFaceSubsets(css);
  const wanted = new Set(selectSubsetIndices(text, faces));
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const face of faces) {
    if (!wanted.has(face.index) || seen.has(face.url)) continue;
    seen.add(face.url);
    urls.push(face.url);
  }
  return urls;
}
