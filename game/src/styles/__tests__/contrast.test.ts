// 색 대비 계약 — WCAG AA(일반 텍스트 4.5:1).
//
// 이 게임은 어두운 팔레트에 작은 글씨(0.65~0.75rem)를 많이 쓴다. 그래서 대비는 취향이 아니라
// **읽히느냐**의 문제고, 색 하나를 조용히 되돌리면 86곳이 함께 흐려진다.
//
// 값을 이 파일에 박아두지 않고 **game.css에서 읽는다.** 숫자를 복사해두면 CSS가 바뀔 때
// 테스트만 옛 값을 붙들고 통과한다(폰트 검증에서 겪은 형태 — 검사하는 층과 실제 층이 갈리는 것).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join, relative } from 'path';

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
    // 스코프가 루트(.title-screen)에서 버튼 열 컨테이너(.title-screen__actions)로 옮겨졌다 —
    // 같은 타이틀 흐름인데 단계마다 루트가 달라(.title-screen / .screen) 여백·최소높이가
    // 통째로 빠지던 것을 고치면서다. 대비 계산 대상은 그대로 같은 버튼이다.
    ['타이틀 주 버튼 (밝은 끝)', decl('.title-screen__actions .btn-primary', 'color'), '#ee9961'],
    ['타이틀 주 버튼 (어두운 끝)', decl('.title-screen__actions .btn-primary', 'color'), '#d57443'],
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

/**
 * **밝은 배경 위의 글자.** 위쪽 탐지기가 원리상 못 보던 축이다.
 *
 * 기존 `lowContrastLiterals`는 (1) `color: '#hex'` 리터럴만 매칭하고 (2) 배경을
 * `--bg-card-hover` **하나로 고정**한다. 그래서 `background: var(--accent)` 위의
 * `color: 'white'`는 두 조건 모두에 안 걸린다. 실제로 그 상태로 4곳이 **2.64:1**로 살아
 * 있었고(튜토리얼 '다음' · 첫 선택 CTA · 상점 구매/카테고리 — 전부 신규 플레이어 필수 동선)
 * 게이트는 19/19 초록이었다. 검사하는 층과 배포되는 층이 갈리는, 이 리포의 반복 형태다.
 *
 * `game.css:23`에는 이미 "흰 글자를 테라코타에 얹으면 2.64:1"이라 적혀 있었다 —
 * 수정(`--btn-ink`)이 CSS 파일에는 들어갔는데 **인라인 스타일 호출부가 못 받았다.**
 */
describe('밝은 배경 위의 글자 — 같은 스타일 객체의 background/color 쌍', () => {
  /** 색 표현 하나를 #hex로. 풀 수 없으면 null(투명·그라디언트·계산값·테이블 조회). */
  function resolveColor(raw: string): string | null {
    const v = raw.trim().replace(/^['"]|['"]$/g, '');
    if (/^#[0-9a-fA-F]{3,6}$/.test(v)) return v;
    if (v === 'white') return '#ffffff';
    if (v === 'black') return '#000000';
    const t = /^var\(--([\w-]+)\)$/.exec(v);
    if (t) { try { return token(t[1]); } catch { return null; } }
    return null;   // rgba/그라디언트/transparent/식별자 — 판정 불가
  }

  /**
   * 주석을 지운다. 주석 안의 중괄호·콜론이 블록 경계와 선언으로 잘못 읽힌다 —
   * 이 리포는 주석이 길고 많아서 그냥 두면 잡음이 실제 쌍보다 많다.
   * 문자열 안의 `//`(URL 등)는 건드리지 않는다.
   */
  function stripComments(text: string): string {
    let out = '', q: string | null = null;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        out += c;
        if (c === '\\') { out += text[++i] ?? ''; continue; }
        if (c === q) q = null;
        continue;
      }
      if (c === "'" || c === '"' || c === '`') { q = c; out += c; continue; }
      if (c === '/' && text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') i++; out += '\n'; continue; }
      if (c === '/' && text[i + 1] === '*') { i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++; i++; continue; }
      out += c;
    }
    return out;
  }

  /**
   * 균형 잡힌 `{...}` **전부**의 본문을 낸다 — 중첩된 것도 포함해서.
   *
   * 예전에는 `/\{[^{}]*\}/g`로 **가장 안쪽 중괄호만** 잡았다. 그래서 스타일 객체에
   * 템플릿 리터럴(`` `0 1px ${n}px` ``) 한 줄만 섞여 있어도 그 객체는 통째로 검사 대상에서
   * 빠졌다 — 실측: 그 사각지대에 최상위 background+color를 함께 선언한 객체가 6개 있었고,
   * `color`를 흰색으로 되돌리는 회귀를 넣어도 25/25가 통과했다.
   */
  function blocks(text: string): string[] {
    const out: string[] = [];
    const stack: number[] = [];
    let q: string | null = null;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '\\') { i++; continue; }
        if (c === q) q = null;
        continue;
      }
      if (c === "'" || c === '"' || c === '`') { q = c; continue; }
      if (c === '{') { stack.push(i); continue; }
      if (c === '}' && stack.length) out.push(text.slice(stack.pop()! + 1, i));
    }
    return out;
  }

  /**
   * 블록 본문의 **최상위 선언**만 `이름 → 값`으로 읽는다.
   *
   * 최상위로 한정하는 것이 요점이다. 문자열 전체에서 `background:`를 정규식으로 찾으면
   * `{ a: { background: X }, b: { color: Y } }`처럼 **서로 다른 객체**의 값이 한 쌍으로
   * 묶여 있지도 않은 조합을 신고한다.
   *
   * 구분자는 `,`와 **`;` 둘 다**다. `;`를 모르면 CSS 규칙의 값이
   * `var(--accent); color: #ffffff`로 통째로 읽혀 색으로 안 풀리고 조용히 건너뛰어진다 —
   * `sourceFiles()`가 `.css`를 수집하는데도 **검사하는 척만 하고 있었다**(실측: game.css에
   * 2.64:1 규칙을 넣어도 25/25 통과).
   */
  function topLevelDecls(body: string): Map<string, string> {
    const decls = new Map<string, string>();
    let depth = 0, q: string | null = null, buf = '';
    const flush = () => {
      const s = buf.trim(); buf = '';
      if (!s) return;
      const i = s.indexOf(':');
      if (i <= 0) return;
      const key = s.slice(0, i).trim().replace(/^['"]|['"]$/g, '');
      if (!/^[\w-]+$/.test(key)) return;
      const val = s.slice(i + 1).trim();
      if (val && !decls.has(key)) decls.set(key, val);
    };
    for (let i = 0; i < body.length; i++) {
      const c = body[i];
      if (q) { buf += c; if (c === '\\') { buf += body[++i] ?? ''; continue; } if (c === q) q = null; continue; }
      if (c === "'" || c === '"' || c === '`') { q = c; buf += c; continue; }
      if ('([{'.includes(c)) { depth++; buf += c; continue; }
      if (')]}'.includes(c)) { depth--; buf += c; continue; }
      if (depth === 0 && (c === ',' || c === ';')) { flush(); continue; }
      buf += c;
    }
    flush();
    return decls;
  }

  /** 삼항 트리. 잎은 값 하나, 가지는 조건 + 양쪽. */
  type Node = { leaf: string } | { cond: string; then: Node; else: Node };

  /** 조건 문자열 정규화 — 공백을 접고 선행 `!`는 부호로 뗀다(`!open`과 `open`은 같은 축이다). */
  function normCond(c: string): { key: string; neg: boolean } {
    let s = c.trim().replace(/\s+/g, ' ');
    let neg = false;
    while (s.startsWith('!')) { neg = !neg; s = s.slice(1).trim(); }
    if (s.startsWith('(') && s.endsWith(')')) s = s.slice(1, -1).trim();
    return { key: s, neg };
  }

  /** 최상위 삼항 하나를 찾아 트리로 편다. `?.`·`??`는 삼항이 아니다. */
  function parseTernary(value: string): Node {
    let depth = 0, q: string | null = null;
    for (let i = 0; i < value.length; i++) {
      const c = value[i];
      if (q) { if (c === q && value[i - 1] !== '\\') q = null; continue; }
      if (c === "'" || c === '"' || c === '`') { q = c; continue; }
      if ('([{'.includes(c)) { depth++; continue; }
      if (')]}'.includes(c)) { depth--; continue; }
      if (c !== '?' || depth !== 0) continue;
      if (value[i + 1] === '.' || value[i + 1] === '?') continue;
      let d2 = 0, q2: string | null = null, nest = 0;
      for (let j = i + 1; j < value.length; j++) {
        const d = value[j];
        if (q2) { if (d === q2 && value[j - 1] !== '\\') q2 = null; continue; }
        if (d === "'" || d === '"' || d === '`') { q2 = d; continue; }
        if ('([{'.includes(d)) { d2++; continue; }
        if (')]}'.includes(d)) { d2--; continue; }
        if (d2 !== 0) continue;
        if (d === '?' && d !== value[j + 1] && value[j + 1] !== '.') { nest++; continue; }
        if (d === ':') {
          if (value[j + 1] === ':' || value[j - 1] === ':') continue;
          if (nest > 0) { nest--; continue; }
          return {
            cond: value.slice(0, i),
            then: parseTernary(value.slice(i + 1, j)),
            else: parseTernary(value.slice(j + 1)),
          };
        }
      }
      break;
    }
    return { leaf: value.trim() };
  }

  function condKeys(n: Node, acc = new Set<string>()): Set<string> {
    if ('leaf' in n) return acc;
    acc.add(normCond(n.cond).key);
    condKeys(n.then, acc); condKeys(n.else, acc);
    return acc;
  }

  function evalNode(n: Node, env: Map<string, boolean>): string {
    if ('leaf' in n) return n.leaf;
    const { key, neg } = normCond(n.cond);
    const v = (env.get(key) ?? true) !== neg;
    return evalNode(v ? n.then : n.else, env);
  }

  function leaves(n: Node, acc: string[] = []): string[] {
    if ('leaf' in n) { acc.push(n.leaf); return acc; }
    leaves(n.then, acc); leaves(n.else, acc); return acc;
  }

  /**
   * 배경과 글자가 **실제로 함께 나타날 수 있는** 조합만 낸다.
   *
   * 예전에는 "가지 수가 같으면 같은 인덱스끼리, 다르면 교차곱"이었다. 둘 다 틀렸다:
   * - 조건이 **서로 다른** 삼항 둘은 가지 수가 같다는 이유로 zip되어, 실제로 함께 나는
   *   조합(예: `isActive ? accent : card` 배경 × `isGift ? ink : #fff` 글자의 accent+#fff)을
   *   통째로 건너뛰었다.
   * - 가지 수가 다르면 교차곱이라, 같은 조건의 중첩 삼항에서 **존재하지 않는 조합**을
   *   신고했다(실측: 전부 AA를 넘는 코드에 오탐 3건). 과검출은 게이트를 죽이는 가장 빠른 길이다.
   *
   * 그래서 조건을 **변수로 보고 참/거짓을 전부 대입한다** — 도달 가능한 조합이 정확히 나온다.
   * 조건이 너무 많으면(2^5 이상) 조합 폭발을 피해 보수적으로 잎의 교차곱으로 떨어진다.
   */
  function reachablePairs(bgRaw: string, fgRaw: string): [string, string][] {
    const bg = parseTernary(bgRaw), fg = parseTernary(fgRaw);
    const keys = [...new Set([...condKeys(bg), ...condKeys(fg)])];
    if (keys.length > 4) {
      return leaves(bg).flatMap(b => leaves(fg).map(f => [b, f] as [string, string]));
    }
    const seen = new Set<string>();
    const out: [string, string][] = [];
    for (let mask = 0; mask < (1 << keys.length); mask++) {
      const env = new Map(keys.map((k, i) => [k, Boolean(mask & (1 << i))]));
      const pair: [string, string] = [evalNode(bg, env), evalNode(fg, env)];
      // 구분자 문자를 쓰지 않는다 — 색 문자열엔 `rgba(0, 0, 0, .5)`처럼 공백이 들어간다.
      // 공백으로 이으면 ["a b","c"]와 ["a","b c"]가 같은 서명이 되어 한 쌍이 조용히 사라진다.
      const sig = JSON.stringify(pair);
      if (!seen.has(sig)) { seen.add(sig); out.push(pair); }
    }
    return out;
  }

  /** 스타일 객체·CSS 규칙을 훑어 AA 미달 쌍을 낸다. */
  function lowContrastOnLightBg(text: string): string[] {
    const out = new Set<string>();
    for (const body of blocks(stripComments(text))) {
      const decls = topLevelDecls(body);
      const bgRaw = decls.get('background') ?? decls.get('backgroundColor') ?? decls.get('background-color');
      const fgRaw = decls.get('color');
      if (!bgRaw || !fgRaw) continue;
      for (const [b, f] of reachablePairs(bgRaw, fgRaw)) {
        const bg = resolveColor(b), fg = resolveColor(f);
        if (!bg || !fg) continue;                     // 판정 불가는 건너뛴다
        const r = ratio(fg, bg);
        if (r < AA) out.add(`${fg} on ${bg} = ${r.toFixed(2)}:1`);
      }
    }
    return [...out];
  }

  // 탐지기가 살아 있다는 증거부터. 정규식을 죽이면 아래 전수 검사가 조용히 공회전한다.
  it('탐지기가 실제로 잡아낸다 (양성 대조)', () => {
    // 고쳐지기 전 실제 모양 4종
    expect(lowContrastOnLightBg(`{ background: 'var(--accent)', color: 'white' }`)).toHaveLength(1);
    expect(lowContrastOnLightBg(`{ background: 'var(--accent)', border: 'none', color: '#fff' }`)).toHaveLength(1);
    expect(lowContrastOnLightBg(`{ background: isActive ? 'var(--accent)' : 'rgba(255,255,255,0.06)', color: isActive ? 'white' : 'var(--text-secondary)' }`)).toHaveLength(1);
    // 고친 뒤에는 안 걸린다
    expect(lowContrastOnLightBg(`{ background: 'var(--accent)', color: 'var(--btn-ink)' }`)).toEqual([]);
    // 어두운 배경 위의 흰 글자는 정상이다 — 여기서 걸리면 대화 오버레이 전부가 오탐이 된다
    expect(lowContrastOnLightBg(`{ background: 'var(--bg-card)', color: '#fff' }`)).toEqual([]);
    // 같은 조건의 삼항은 같은 인덱스끼리 — 교차로 곱하면 없는 조합을 신고한다
    expect(lowContrastOnLightBg(`{ background: ok ? 'var(--accent)' : 'var(--bg-card)', color: ok ? 'var(--btn-ink)' : '#fff' }`)).toEqual([]);
    // 판정 불가(그라디언트·rgba)는 조용히 건너뛴다
    expect(lowContrastOnLightBg(`{ background: 'linear-gradient(135deg, #fff, #000)', color: '#fff' }`)).toEqual([]);
  });

  /**
   * **탐지기가 못 보던 세 가지.** 전부 3자 검수에서 합성 결함으로 확인됐다 —
   * 아래 형태로 회귀를 심으면 25/25가 그대로 통과했다. 사각지대를 남긴 게이트는
   * "검사 안 함"과 구별되지 않는다.
   */
  it('사각지대 3종을 이제 잡는다 (예전엔 전부 통과했다)', () => {
    // ① 중첩 중괄호가 하나라도 있으면 객체 전체가 검사에서 빠졌다(가장 안쪽만 매칭).
    expect(lowContrastOnLightBg(
      "{ boxShadow: `0 1px ${n}px rgba(0,0,0,0.2)`, background: 'var(--accent)', color: 'white' }",
    ), '템플릿 리터럴 한 줄로 검사를 통째로 피할 수 있으면 안 된다').toHaveLength(1);

    // ② CSS 규칙은 `;`를 몰라 값이 통째로 읽혀 조용히 건너뛰어졌다.
    //    sourceFiles()가 .css를 수집하는데도 검사하는 척만 하고 있었다.
    expect(lowContrastOnLightBg(
      '.probe { background: var(--accent); color: #ffffff; }',
    ), 'CSS를 수집만 하고 못 읽으면 game.css는 영원히 무검사다').toHaveLength(1);

    // ③ **조건이 서로 다른** 삼항 둘은 가지 수가 같다는 이유로 zip돼 실제 조합을 건너뛰었다.
    //    조건이 독립이면 네 조합이 전부 가능하고, 그중 accent+#ffffff가 2.64:1이다.
    //    (같은 픽스처에서 bg-card+btn-ink도 걸린다 — 어두운 표면에 어두운 잉크. 둘 다 진짜다.)
    const zipBlind = lowContrastOnLightBg(
      "{ background: isActive ? 'var(--accent)' : 'var(--bg-card)', color: cat === 'gift' ? 'var(--btn-ink)' : '#ffffff' }",
    );
    expect(zipBlind.some(h => h.includes(token('accent'))),
      `조건이 다르면 zip이 아니라 전 조합을 봐야 한다: ${JSON.stringify(zipBlind)}`).toBe(true);

    // ④ 변수로 빼낸 스타일 객체도 같은 블록이므로 이제 보인다(cursor 지적).
    expect(lowContrastOnLightBg(
      "const s = { background: 'var(--accent)', color: 'white' }; return <div style={s} />;",
    ), 'style={{}} 인라인만 보면 변수로 한 줄 빼는 것으로 게이트를 피할 수 있다').toHaveLength(1);
  });

  /**
   * **과검출 음성 짝.** 위 ③을 고치느라 교차곱으로 되돌리면 존재하지 않는 조합을 신고한다 —
   * 실측으로 오탐 3건이 나서 CI가 깨졌던 모양이다. 게이트를 죽이는 가장 빠른 길이라
   * 반대 방향도 같이 잠근다.
   */
  it('실제로 날 수 없는 조합은 신고하지 않는다 (과검출 방지)', () => {
    // 같은 조건의 중첩 삼항: 배경 2가지 × 글자 3가지지만 도달 가능한 조합은 전부 AA 통과.
    expect(lowContrastOnLightBg(
      "{ background: on ? 'var(--accent)' : 'var(--bg-card)', color: on ? 'var(--btn-ink)' : (dim ? 'var(--text-secondary)' : '#ffffff') }",
    ), '가지 수가 다르다고 교차곱하면 accent+#ffffff를 지어낸다').toEqual([]);

    // 부정 조건도 같은 축이다 — `!open`과 `open`을 따로 세면 없는 조합이 생긴다.
    expect(lowContrastOnLightBg(
      "{ background: !open ? 'var(--bg-card)' : 'var(--accent)', color: open ? 'var(--btn-ink)' : '#ffffff' }",
    ), '!x와 x를 다른 조건으로 보면 오탐이 난다').toEqual([]);

    // 서로 다른 객체의 값이 한 쌍으로 묶이면 안 된다(최상위 선언만 읽는 이유).
    expect(lowContrastOnLightBg(
      "{ head: { background: 'var(--accent)' }, body: { color: '#ffffff' } }",
    ), '다른 객체끼리 묶으면 있지도 않은 쌍을 신고한다').toEqual([]);
  });

  // corpus가 0이면 탐지기를 지워도 초록이다. 실제로 볼 쌍이 있다는 것부터 세운다.
  // **파일 종류별로** 센다 — 합계만 보면 CSS를 통째로 못 읽어도 tsx 쪽 수치로 가려진다.
  it('검사 대상 쌍이 실제로 존재한다 (공회전 방지)', () => {
    let tsxPairs = 0, cssPairs = 0;
    for (const f of sourceFiles()) {
      const text = stripComments(readFileSync(f, 'utf8'));
      for (const body of blocks(text)) {
        const d = topLevelDecls(body);
        const hasBg = d.has('background') || d.has('backgroundColor') || d.has('background-color');
        if (!hasBg || !d.has('color')) continue;
        if (f.endsWith('.css')) cssPairs++; else tsxPairs++;
      }
    }
    expect(tsxPairs, '배경·글자를 함께 선언한 스타일 객체가 하나도 없다면 탐지기가 헛도는 것이다')
      .toBeGreaterThan(10);
    expect(cssPairs, 'CSS 쌍이 0이면 .css를 수집만 하고 못 읽던 그 상태로 돌아간 것이다')
      .toBeGreaterThan(0);
  });

  it('밝은 배경 위에 AA 미달 글자가 없다', () => {
    const bad = sourceFiles().flatMap(f =>
      lowContrastOnLightBg(readFileSync(f, 'utf8')).map(hit => `${f.replace(SRC, 'src')} — ${hit}`));
    expect(bad).toEqual([]);
  });

  describe('파서 동기화 — 안 보이는 파일이 늘지 않는다', () => {
    /** 따옴표가 짝이 안 맞는 파일. 파서가 그 지점부터 길을 잃는다. */
    function desyncedFiles(): string[] {
      const bad: string[] = [];
      for (const f of sourceFiles()) {
        const src = stripComments(readFileSync(f, 'utf8'));
        let q: string | null = null;
        for (let i = 0; i < src.length; i++) {
          const c = src[i];
          if (c === '\\') { i++; continue; }
          if (q) { if (c === q) q = null; }
          else if (c === '"' || c === "'" || c === '`') q = c;
        }
        if (q) bad.push(relative(SRC, f));
      }
      return bad;
    }

    // 알려진 2건. **늘면 실패한다** — 새로 들어온 파일이 스타일 쌍을 가지고 있으면
    // 그 파일의 대비 검사가 통째로 사라지는데, 탐지기는 아무 말도 안 한다.
    const KNOWN_DESYNCED = [
      'components/screens/shared.ts',
      'styles/first-paint-fonts.ts',
    ];

    it('파서가 길을 잃는 파일이 알려진 것보다 늘지 않았다', () => {
      const now = desyncedFiles().sort();
      const added = now.filter(f => !KNOWN_DESYNCED.includes(f));
      expect(added,
        `이 파일들은 탐지기에 일부만 보인다 — 스타일 쌍이 있으면 그 아래가 무검사가 된다.\n` +
        `파서를 고치거나(별건: JS 렉서), 그 줄을 옮기거나, 정말 괜찮으면 KNOWN_DESYNCED에 추가할 것.`)
        .toEqual([]);
    });

    it('알려진 2건이 아직 실재한다 (목록이 늙으면 이 검사가 헐거워진다)', () => {
      const now = desyncedFiles();
      const stale = KNOWN_DESYNCED.filter(f => !now.includes(f));
      expect(stale, '고쳐진 파일이 목록에 남아 있으면 그만큼 새 유입을 봐주게 된다').toEqual([]);
    });

    // 탐지기 자체가 죽은 것과 "위반 0건"을 구분한다.
    it('합성 결함을 실제로 잡는다 (자기검사)', () => {
      const clean = `const a = { background: 'var(--accent)', color: '#ffffff' };`;
      expect(lowContrastOnLightBg(clean).length, '양성 대조군을 못 잡으면 탐지기가 죽은 것이다')
        .toBeGreaterThan(0);
      const desynced = `const re = /["']/g;\n` + clean;
      expect(lowContrastOnLightBg(desynced).length,
        '이 0이 바로 위에서 막으려는 현상이다 — 정규식 한 줄이 아래 전부를 지운다').toBe(0);
    });
  });
});

/**
 * NPC 이름 칩의 배경은 **테이블 조회**(`NPC_COLORS[npcId]`)라 위 탐지기가 값을 못 푼다.
 * 그래서 표 자체를 직접 잠근다 — 5색 전부 흰 글자로 2.23~3.38:1이었다(가장 나은 yuna가 3.38).
 */
describe('NPC 이름 칩 — 표의 모든 색이 글자와 대비를 지킨다', () => {
  function npcColors(): [string, string][] {
    const src = readFileSync(join(SRC, 'components/EventScene.tsx'), 'utf8');
    const block = /const NPC_COLORS: Record<string, string> = \{([^}]*)\}/.exec(src);
    if (!block) throw new Error('EventScene.tsx에서 NPC_COLORS를 못 찾았다');
    return [...block[1].matchAll(/(\w+):\s*'(#[0-9a-fA-F]{3,6})'/g)].map(m => [m[1], m[2]]);
  }

  it('표를 실제로 읽는다 (빈 매칭으로 통과 방지)', () => {
    expect(npcColors().length).toBeGreaterThanOrEqual(5);
  });

  it('만난 NPC의 칩 글자(--btn-ink)가 모든 색에서 AA를 넘는다', () => {
    const ink = token('btn-ink');
    const bad = npcColors()
      .map(([id, c]) => [id, c, ratio(ink, c)] as const)
      .filter(([, , r]) => r < AA)
      .map(([id, c, r]) => `${id} ${c} = ${r.toFixed(2)}:1`);
    expect(bad, 'NPC 색을 밝게 바꾸면 여기서 걸린다').toEqual([]);
  });

  // 미만난 NPC는 어두운 회색(#666)이라 **반대로** 흰 글자여야 한다.
  // 두 분기가 같은 조건으로 짝지어져 있는지를 값으로 확인한다.
  it('미만난 NPC의 칩은 흰 글자가 AA를 넘는다', () => {
    const src = readFileSync(join(SRC, 'components/EventScene.tsx'), 'utf8');
    const m = /background: npc\?\.met === false \? '(#[0-9a-fA-F]{3,6})'/.exec(src);
    expect(m, '미만난 NPC 배경 분기가 사라졌다').toBeTruthy();
    expect(ratio('#ffffff', m![1])).toBeGreaterThanOrEqual(AA);
    expect(src).toContain("color: npc?.met === false ? '#fff' : 'var(--btn-ink)'");
  });
});

// 이 파서는 **정규식 리터럴과 JSX 어포스트로피를 모른다.** `/["']/g` 같은 한 줄을 만나면
// 따옴표 상태가 어긋나고, 그 지점부터 EOF까지 파일이 탐지기에 통째로 안 보인다.
// 3자 검수 실측: 120개 소스 중 이미 2개가 어긋나 있었다(둘 다 스타일 쌍이 없어 현재 유실은 0건).
//
//   src/components/screens/shared.ts:58   text.replace(/(?<![.!?])([.!?]"?)\s+(?=\S)/g, ...)
//   src/styles/first-paint-fonts.ts:92    block.match(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/i)
//
// 제대로 고치려면 파서에 JS 렉서를 넣어야 하고 그건 별건이다. 여기서는 **늘어나는 것**을 막는다 —
// 스타일 쌍을 가진 파일에 저런 줄이 하나 들어오면 그 아래 전부가 조용히 무검사가 되기 때문이다.
