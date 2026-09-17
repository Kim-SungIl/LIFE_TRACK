// **탐침이 정말로 구분하는가 — 게이트 밖에서 확인한다.**
//
// `verify-typecheck-coverage.ts`의 양성 대조군(`liveProbeControls`)은 자기 자신을 못 지킨다.
// 함수 본문 첫 줄에 `return NODE_PROBES.length + TYPE_ERROR_PROBES.length`를 넣으면 대조군이
// 통째로 사라진 채 게이트가 초록이다(뮤테이션 실측). 그래서 같은 판정을 **여기서 다시** 한다 —
// `ciGateWiring.test.ts`가 verify-ci-gates에 대해 하는 것과 같은 자리다.
//
// 이 파일은 게이트 모듈을 import하기만 해도 두 가지를 잠근다:
//   · 모듈 최상위의 `selfCheck()`가 같이 돈다 (실패하면 import가 throw)
//   · 실행부에 main guard가 없으면 import 시점에 `process.exit(1)`이 돌아 **vitest가 통째로 죽는다**
//     (초판에 가드가 없었고, 게이트를 붉게 만든 채 import하면 `Tests: no tests`가 났다)
import { describe, expect, it } from 'vitest';
import {
  audit, probe, parseProject, referencePaths, readConfig,
  NODE_PROBES, TYPE_ERROR_PROBES, SELF_CHECK_COUNT, EXPECTED_SELF_CHECKS,
} from '../../../scripts/verify/verify-typecheck-coverage';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '../../..');
const app = parseProject(resolve(ROOT, 'tsconfig.app.json'));
const test = parseProject(resolve(ROOT, 'tsconfig.test.json'));

describe('타입검사 커버리지 게이트', () => {
  it('자기검사가 전 케이스를 돈다', () => {
    expect(SELF_CHECK_COUNT).toBe(EXPECTED_SELF_CHECKS);
    expect(EXPECTED_SELF_CHECKS).toBeGreaterThanOrEqual(10 + NODE_PROBES.length + TYPE_ERROR_PROBES.length);
  });

  it('루트 references가 app·test를 실제 경로로 가리킨다', () => {
    const refs = referencePaths(readConfig(resolve(ROOT, 'tsconfig.json'))).map(p => resolve(ROOT, p));
    expect(refs).toContain(resolve(ROOT, 'tsconfig.app.json'));
    expect(refs).toContain(resolve(ROOT, 'tsconfig.test.json'));
  });

  // ── 탐침의 양성/음성 대조 ──────────────────────────────────────────────
  it('app 프로젝트는 node 전역을 전부 거부한다 (음성)', () => {
    const got = probe(app.options, app.fileNames, NODE_PROBES);
    for (const c of NODE_PROBES) {
      expect(got.get(c.name), `app이 ${c.name}를 통과시킨다`).not.toHaveLength(0);
    }
  });

  it('app에 node를 열면 탐침이 조용해진다 (양성 — 탐침이 node를 보고 있다는 증거)', () => {
    const got = probe({ ...app.options, types: ['node', 'vite/client'] }, app.fileNames, NODE_PROBES);
    for (const c of NODE_PROBES) {
      expect(got.get(c.name), `${c.name} 탐침이 node 여부를 안 본다`).toHaveLength(0);
    }
  });

  it('test 프로젝트는 타입 오류를 잡는다 (음성)', () => {
    const got = probe(test.options, test.fileNames, TYPE_ERROR_PROBES);
    for (const c of TYPE_ERROR_PROBES) {
      expect(got.get(c.name), `test가 ${c.name}를 안 잡는다`).not.toHaveLength(0);
    }
  });

  it('test에 noCheck를 켜면 탐침이 조용해진다 (양성)', () => {
    const got = probe({ ...test.options, noCheck: true }, test.fileNames, TYPE_ERROR_PROBES);
    for (const c of TYPE_ERROR_PROBES) {
      expect(got.get(c.name), `${c.name} 탐침이 검사 여부를 안 본다`).toHaveLength(0);
    }
  });

  // ── 판정부 양성 대조군 ────────────────────────────────────────────────
  const R = '/x';
  const ROOT_OK = { references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.test.json' }] };
  const tests = Array.from({ length: 60 }, (_, i) => `/x/src/a/__tests__/t${i}.test.ts`);
  const prod = Array.from({ length: 12 }, (_, i) => `/x/src/p${i}.ts`);
  const nodeOK = new Map(NODE_PROBES.map(c => [c.name, ['TS2591']]));
  const errOK = new Map(TYPE_ERROR_PROBES.map(c => [c.name, ['TS2322']]));
  interface Patch {
    root?: Record<string, unknown>; disk?: string[]; checked?: string[];
    dProd?: string[]; cProd?: string[];
    node?: Map<string, string[]>; err?: Map<string, string[]>;
  }
  const kinds = (o: Patch = {}) => audit(
    o.root ?? ROOT_OK, o.disk ?? tests, o.checked ?? tests,
    o.dProd ?? prod, o.cProd ?? prod, o.node ?? nodeOK, o.err ?? errOK, R,
  ).map(p => p.kind);

  it('정합 입력은 문제 0건', () => {
    expect(kinds()).toEqual([]);
  });

  it.each([
    ['references에서 test 제거', { root: { references: [{ path: './tsconfig.app.json' }] } }, 'references 누락'],
    ['references에서 app 제거', { root: { references: [{ path: './tsconfig.test.json' }] } }, 'references 누락'],
    ['references 경로 위장', { root: { references: [{ path: './tsconfig.app.json' }, { path: './empty/tsconfig.test.json' }] } }, 'references 누락'],
    ['테스트 검사 집합 좁힘', { checked: tests.slice(0, 5) }, '무검사 테스트'],
    ['제품 검사 집합 좁힘', { cProd: prod.slice(0, 2) }, '무검사 제품 소스'],
    ['양쪽 다 0', { disk: [], checked: [] }, 'corpus 퇴화'],
    ['app이 node를 통과시킴', { node: new Map([...nodeOK, [NODE_PROBES[0].name, [] as string[]]]) }, 'app에 node 전역'],
    ['test가 오류를 안 잡음', { err: new Map([...errOK, [TYPE_ERROR_PROBES[0].name, [] as string[]]]) }, '무력한 test 프로젝트'],
    ['탐침 결과 유실', { node: new Map<string, string[]>() }, '탐침 유실'],
  ])('%s → %s', (_label, patch, want) => {
    expect(kinds(patch)).toContain(want);
  });
});
