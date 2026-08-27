// 색 대비 계약 — WCAG AA(일반 텍스트 4.5:1).
//
// 이 게임은 어두운 팔레트에 작은 글씨(0.65~0.75rem)를 많이 쓴다. 그래서 대비는 취향이 아니라
// **읽히느냐**의 문제고, 색 하나를 조용히 되돌리면 86곳이 함께 흐려진다.
//
// 값을 이 파일에 박아두지 않고 **game.css에서 읽는다.** 숫자를 복사해두면 CSS가 바뀔 때
// 테스트만 옛 값을 붙들고 통과한다(폰트 검증에서 겪은 형태 — 검사하는 층과 실제 층이 갈리는 것).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

const CSS_PATH = resolve(process.cwd(), 'src/styles/game.css');
const CSS = readFileSync(CSS_PATH, 'utf8');
const SRC = resolve(process.cwd(), 'src');

/** WCAG 상대 휘도. #rgb 축약도 받는다(#444). */
function luminance(hex: string): number {
  const h = hex.length === 4 ? '#' + [...hex.slice(1)].map(c => c + c).join('') : hex;
  const ch = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function ratio(fg: string, bg: string): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

/** :root의 토큰 값. 없으면 던진다 — 토큰이 사라진 것도 계약 위반이다. */
function token(name: string): string {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`).exec(CSS);
  if (!m) throw new Error(`game.css에 --${name} 토큰이 없다`);
  return m[1];
}

/** 특정 셀렉터 블록에서 선언된 속성 값. 색을 바꿔치면 여기서 잡힌다. */
function decl(selector: string, prop: string): string {
  const esc = selector.replace(/[.:*+?^${}()|[\]\\]/g, '\\$&');
  const block = new RegExp(`${esc}\\s*\\{([^}]*)\\}`).exec(CSS);
  if (!block) throw new Error(`game.css에 ${selector} 규칙이 없다`);
  const m = new RegExp(`(?:^|;)\\s*${prop}:\\s*([^;]+)`).exec(block[1]);
  if (!m) throw new Error(`${selector}에 ${prop} 선언이 없다`);
  const raw = m[1].trim();
  const v = /var\(--([\w-]+)\)/.exec(raw);
  if (v) return token(v[1]);
  if (raw === 'white') return '#ffffff';
  return raw;
}

const AA = 4.5;

/** 텍스트가 놓이는 표면들. 가장 밝은 --bg-card-hover가 최악의 경우다. */
const SURFACES = ['bg-primary', 'bg-secondary', 'bg-card', 'bg-card-hover'] as const;

/**
 * 밝은 버튼 위에만 쓰는 잉크. 어두운 표면 규칙에서 제외한다 — 여기 넣으면
 * "어두운 배경에서도 4.5"를 요구하게 되어 애초 목적(밝은 배경 위 가독)과 모순된다.
 * 대신 아래 '버튼' describe가 실제로 얹히는 배경에 대해 따로 잠근다.
 */
const LIGHT_SURFACE_ONLY = new Set(['btn-ink']);

/** src 아래 모든 소스 파일 (테스트 제외). */
function sourceFiles(dir = SRC, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== '__tests__' && name !== 'test') sourceFiles(p, acc);
    } else if (/\.(tsx?|css)$/.test(name)) {
      acc.push(p);
    }
  }
  return acc;
}

/** 코드에서 실제로 **글자색으로** 쓰이는 토큰들 — 목록을 손으로 관리하지 않는다. */
function tokensUsedAsText(): string[] {
  const found = new Set<string>();
  for (const f of sourceFiles()) {
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(/\bcolor:\s*'?var\(--([\w-]+)\)'?/g)) found.add(m[1]);
    // 삼항으로 고르는 자리(`color: x ? 'var(--red)' : 'var(--text-muted)'`)도 글자색이다.
    for (const m of text.matchAll(/\bcolor:\s*[^;\n]*?\?\s*'var\(--([\w-]+)\)'\s*:\s*'var\(--([\w-]+)\)'/g)) {
      found.add(m[1]); found.add(m[2]);
    }
  }
  return [...found].filter(t => !t.startsWith('bg-') && !LIGHT_SURFACE_ONLY.has(t)).sort();
}

describe('어두운 표면 위의 글자', () => {
  const used = tokensUsedAsText();

  // 목록이 비면 위 정규식이 깨진 것이다 — 그 상태로는 아래 단언이 전부 공회전한다.
  it('글자색으로 쓰이는 토큰을 실제로 찾아낸다', () => {
    expect(used.length).toBeGreaterThanOrEqual(8);
    expect(used).toContain('text-muted');
    expect(used).toContain('red');
  });

  // SURFACES에서 가장 밝은 표면을 빼면 검사가 통째로 헐거워진다(미달 색이 통과한다).
  // 목록이 :root의 배경 토큰 전부를 덮는지 여기서 못 박는다.
  it('검사 표면이 :root의 배경 토큰을 빠짐없이 덮는다', () => {
    const declared = [...CSS.matchAll(/--(bg-[\w-]+):\s*#/g)].map(m => m[1]).sort();
    expect([...SURFACES].sort()).toEqual(declared);
  });

  it.each(SURFACES)('%s 위에서 모든 글자 토큰이 AA(4.5:1)를 넘는다', (surface) => {
    const bg = token(surface);
    const failing = used
      .map(t => ({ t, r: ratio(token(t), bg) }))
      .filter(x => x.r < AA)
      .map(x => `--${x.t} ${token(x.t)} = ${x.r.toFixed(2)}:1`);
    expect(failing).toEqual([]);
  });
});

describe('버튼 — 글자가 밝은 배경 위에 얹힌다', () => {
  // .btn은 1rem/600이라 "큰 글씨 3:1 예외"에 해당하지 않는다. 4.5:1이 필요하다.
  it('.btn은 큰 글씨 예외 크기가 아니다 (예외를 쓰려면 24px 이상이어야 한다)', () => {
    expect(decl('.btn', 'font-size')).toBe('1rem');
  });

  const CASES: [string, string, string][] = [
    ['주 버튼', decl('.btn-primary', 'color'), token('accent')],
    ['주 버튼 hover', decl('.btn-primary', 'color'), token('accent-soft')],
    // ConfirmDialog가 danger일 때 background: var(--red)를 인라인으로 얹는다.
    ['위험 버튼', decl('.btn-primary', 'color'), token('red')],
    // 타이틀 주 버튼은 자체 그라디언트 — 양 끝을 다 본다.
    ['타이틀 주 버튼 (밝은 끝)', decl('.title-screen .btn-primary', 'color'), '#ee9961'],
    ['타이틀 주 버튼 (어두운 끝)', decl('.title-screen .btn-primary', 'color'), '#d57443'],
    // 비활성은 배경이 어두워진다 — 밝은 배경용 잉크를 물려받으면 1.72:1이 된다.
    ['비활성 버튼', decl('.btn-primary:disabled', 'color'), decl('.btn-primary:disabled', 'background')],
  ];

  it.each(CASES)('%s', (_name, fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(AA);
  });

  // 이 게임의 최악 지점이었던 자리 — 흰 글자로 되돌아가면 2.64:1이다.
  it('주 버튼 글자가 흰색으로 되돌아가지 않았다', () => {
    expect(ratio('#ffffff', token('accent'))).toBeLessThan(AA);   // 되돌리면 왜 안 되는지의 근거
    expect(decl('.btn-primary', 'color')).not.toBe('#ffffff');
  });
});

/**
 * 토큰을 안 거치고 hex를 직접 박은 글자색. 위 describe는 `var(--x)` 참조만 보므로
 * 여기를 안 막으면 **팔레트를 고쳐도 색이 조용히 새 나간다** — 실제로 `#8a8078`(3.43:1)이
 * 그렇게 한 곳에 남아 있었다(지금은 제거된 --gray 값을 손으로 복사해 둔 것).
 */
describe('토큰을 거치지 않은 글자색', () => {
  /**
   * 제외 대상 — `color:`라는 이름이지만 글자색이 아닌 자리들.
   *
   * - DebugPanel: `import.meta.env.DEV &&`로만 렌더돼 배포 번들에 안 들어간다.
   * - memoryTokens: 카테고리 색이 **글자에 안 쓰인다.** 실제 사용처는 memoryVisuals.tsx
   *   115행 `boxShadow ...${cat.color}88`(링)과 124행 `background: ${cat.color}22`(틴트)뿐이고,
   *   카테고리는 이모지·라벨로도 전달돼 색이 유일한 식별 채널이 아니다.
   *   **여기 색을 글자에 쓰게 되면 이 제외를 먼저 걷어낼 것.**
   */
  const NOT_TEXT_COLOR = /(?:DebugPanel\.tsx|memoryTokens\.ts)$/;

  /** 한 파일 내용에서 AA 미달 하드코딩 글자색을 뽑는다. 파일과 분리해야 탐지기를 시험할 수 있다. */
  function lowContrastLiterals(text: string, bg: string): string[] {
    const out: string[] = [];
    for (const m of text.matchAll(/\bcolor:\s*'?(#[0-9a-fA-F]{3,6})'?/g)) {
      const r = ratio(m[1], bg);
      if (r < AA) out.push(`${m[1]} = ${r.toFixed(2)}:1`);
    }
    return out;
  }

  // 아래 단언은 "아무것도 못 찾았다"로도 통과한다. 탐지기가 살아 있다는 증거를 먼저 세운다
  // — 정규식만 죽이면 전수 검사가 조용히 공회전한다.
  it('탐지기가 미달 색을 실제로 잡아낸다 (양성 대조)', () => {
    const bg = token('bg-card-hover');
    expect(lowContrastLiterals(`color: '#8a8078'`, bg)).toHaveLength(1);
    expect(lowContrastLiterals(`color: #888`, bg)).toHaveLength(1);
    expect(lowContrastLiterals(`color: '#f1e9dc'`, bg)).toEqual([]);
  });

  it('배포되는 코드에 AA 미달 하드코딩 색이 없다', () => {
    const bg = token('bg-card-hover');
    const bad = sourceFiles()
      .filter(p => !NOT_TEXT_COLOR.test(p))
      .flatMap(f => lowContrastLiterals(readFileSync(f, 'utf8'), bg)
        .map(hit => `${f.replace(SRC, 'src')} — ${hit}`));
    expect(bad).toEqual([]);
  });
});

/**
 * 투명도는 대비를 조용히 깎는다. 이미 흐린 색에 opacity를 겹치면 계산상 통과한 색도
 * 실제 화면에선 미달이 된다 — `--text-muted`(4.63:1)에 0.85를 걸면 3.78:1이다.
 *
 * 그래서 **글자색을 지정한 요소에는 opacity를 걸지 않는다**로 규칙을 세운다. 강조를 낮추고
 * 싶으면 그 목적의 토큰(`--text-muted`)이 이미 있고, 그쪽은 대비가 잠겨 있다.
 */
describe('글자 위의 투명도', () => {
  function colorWithOpacity(text: string): string[] {
    const both = /\{[^{}]*(?:color:[^{}]*opacity:\s*0?\.\d+|opacity:\s*0?\.\d+[^{}]*color:)[^{}]*\}/g;
    return [...text.matchAll(both)].map(m => m[0].slice(0, 72));
  }

  it('탐지기가 실제로 잡아낸다 (양성 대조)', () => {
    expect(colorWithOpacity(`{ color: 'var(--text-muted)', opacity: 0.85 }`)).toHaveLength(1);
    expect(colorWithOpacity(`{ opacity: 0.8, color: grade.color }`)).toHaveLength(1);
    // 글자색이 없는 요소의 투명도는 이 규칙 대상이 아니다(이미지 페이드 등).
    expect(colorWithOpacity(`{ opacity: 0.6, width: '100%' }`)).toEqual([]);
  });

  it('색을 지정한 요소에 opacity를 걸지 않는다', () => {
    const bad = sourceFiles()
      .filter(p => p.endsWith('.tsx'))
      .flatMap(f => colorWithOpacity(readFileSync(f, 'utf8'))
        .map(hit => `${f.replace(SRC, 'src')} — ${hit}`));
    expect(bad).toEqual([]);
  });
});

describe('죽은 토큰', () => {
  // --gray는 정의만 있고 사용처가 0이었다(그리고 4.5:1에 미달이었다).
  // 남겨두면 언젠가 누가 집어 쓴다.
  it('정의된 색 토큰은 모두 어딘가에서 쓰인다', () => {
    const defined = [...CSS.matchAll(/--([\w-]+):\s*#[0-9a-fA-F]{3,8}\s*;/g)].map(m => m[1]);
    const all = sourceFiles().map(f => readFileSync(f, 'utf8')).join('\n');
    const unused = defined.filter(t => {
      const uses = all.split(`var(--${t})`).length - 1;
      return uses === 0;
    });
    expect(unused).toEqual([]);
  });
});
