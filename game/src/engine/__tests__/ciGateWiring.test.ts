// **CI가 게이트를 실제로 부르고, 그 게이트가 무력화되지 않았는가.**
//
// 이 파일이 따로 있는 이유는 하나다. 같은 판정을 `verify:ci`에서도 돌리는데(content-verify job),
// **그 `verify:ci` 스텝 자체를 deploy.yml에서 지우면 그쪽 검사는 아예 실행되지 않는다.**
// 이 테스트는 build job의 `npm test`에서 도므로 그 편집을 여기서 잡는다.
// 반대로 `npm test` 스텝을 지우면 content-verify 쪽이 잡는다 — 두 자리가 서로를 덮는다.
// 한 자리에만 두면 그 자리를 지우는 단일 편집이 통과한다(#397·#431과 같은 "호출부 미잠금" 계열).
// 이 파일이 사라지는 것은 verify-ci-gates의 auditRegistration이 잡는다.
//
// **아래 양성 대조군이 판정 로직의 실질 잠금이다.** 게이트 스크립트의 자기검사 블록은 통째로
// 지우거나 카운터를 상수로 바꾸면 스스로를 못 지킨다(검수 실측) — 그래서 무력화 수단마다
// 합성 워크플로를 여기에 두고 **실제 동작**으로 잠근다. 위 두 단언("문제 없음")만 두면
// 판정부를 비워도 초록이다.
import { describe, expect, it } from 'vitest';
import {
  auditRepo, auditGates, auditTriggers, auditOtherWorkflows, auditScripts,
  parseWorkflow, parseTriggers,
} from '../../../scripts/verify/verify-ci-gates';

const WF = [
  'on:',
  '  push:',
  '    branches: [main]',
  '  pull_request:',
  '    branches: [main]',
  'jobs:',
  '  build:',
  '    runs-on: ubuntu-latest',
  '    steps:',
  '      - run: npm run lint',
  '      - run: npm test',
  '      - run: npm run verify:test-floor',
  '      - run: npm run build:release',
  '      - run: npm run verify:dist-fonts',
  '  content-verify:',
  '    runs-on: ubuntu-latest',
  '    steps:',
  '      - run: npm run verify:ci',
  '  deploy:',
  "    if: github.event_name == 'push'",
  '    needs: [build, content-verify]',
  '    steps:',
  '      - uses: actions/deploy-pages@v4',
].join('\n');

const GATES = ['verify:dist-fonts'];
const kindsOf = (yaml: string) => auditGates(parseWorkflow(yaml), GATES).map(p => p.kind);

describe('CI 게이트 배선', () => {
  it('deploy.yml이 package.json의 dist 게이트를 전부 부른다', () => {
    const { problems, distGates } = auditRepo();
    // 전제 붕괴 방지 — 요구가 0이면 "전부 충족"으로 공허하게 통과한다.
    expect(distGates.length, '전제 붕괴: verify:dist-* 스크립트를 하나도 못 찾았다').toBeGreaterThanOrEqual(5);
    expect(problems.map(p => `[${p.kind}] ${p.detail}`)).toEqual([]);
  });

  it('전제: 실제 워크플로가 파싱된다 (job 3개 · build 스텝 다수 · 트리거 2종)', () => {
    const { jobs } = auditRepo();
    // **부분집합으로 본다** — 정확 배열로 두면 무해한 job을 하나 추가하는 정당한 편집이 깨진다
    // (게이트 스크립트는 부분집합인데 테스트만 정확 일치라 서로 모순이었다, 3차 검수 실측).
    for (const need of ['build', 'content-verify', 'deploy']) expect(jobs.map(j => j.name)).toContain(need);
    expect(jobs.find(j => j.name === 'build')!.runs.length).toBeGreaterThan(5);
    expect(auditRepo().problems).toEqual([]);
  });

  it('전제: 합성 워크플로가 정합이다 (아래 대조군의 기준선)', () => {
    expect(kindsOf(WF)).toEqual([]);
  });

  // ── 양성 대조군 ── 스텝을 그대로 둔 채 게이트를 죽이는 편집들. 전부 3자 검수에서 실측된 것이다.
  it.each([
    ['게이트 스텝 삭제', '      - run: npm run verify:dist-fonts\n', '', ['게이트 미배선']],
    ['게이트 스텝 continue-on-error', '      - run: npm run verify:dist-fonts', '      - run: npm run verify:dist-fonts\n        continue-on-error: true', ['스텝 무력화']],
    ['게이트 스텝 continue-on-error 표현식', '      - run: npm run verify:dist-fonts', '      - run: npm run verify:dist-fonts\n        continue-on-error: ${{ true }}', ['스텝 무력화']],
    ['게이트 스텝 if', '      - run: npm run verify:dist-fonts', '      - if: false\n        run: npm run verify:dist-fonts', ['스텝 무력화']],
    ['게이트 스텝 || true', '      - run: npm run verify:dist-fonts', '      - run: npm run verify:dist-fonts || true', ['게이트 미배선', '종료 코드 무력화']],
    ['npm test ; true', '      - run: npm test', '      - run: npm test; true', ['필수 스텝 누락', '종료 코드 무력화']],
    ['build job 레벨 if', '  build:', '  build:\n    if: false', ['job 무력화']],
    ['build job 레벨 continue-on-error', '  build:', '  build:\n    continue-on-error: true', ['job 무력화']],
    ['build job 레벨 strategy', '  build:', '  build:\n    strategy:\n      matrix:\n        node: []', ['job 무력화']],
    ['content-verify job 레벨 if', '  content-verify:', '  content-verify:\n    if: false', ['job 무력화']],
    ['deploy job if: always()', "    if: github.event_name == 'push'", '    if: always()', ['배포 의존 무효화']],
    ['deploy job if: Always() (대소문자)', "    if: github.event_name == 'push'", '    if: Always()', ['배포 의존 무효화']],
    ['deploy job if: failure()', "    if: github.event_name == 'push'", '    if: failure()', ['배포 의존 무효화']],
    ['deploy job if: cancelled()', "    if: github.event_name == 'push'", '    if: cancelled()', ['배포 의존 무효화']],
    ['deploy.needs에서 build 제거', 'needs: [build, content-verify]', 'needs: [content-verify]', ['배포 의존 누락']],
    ['deploy.needs에서 content-verify 제거', 'needs: [build, content-verify]', 'needs: [build]', ['배포 의존 누락']],
  ])('%s는 잡힌다', (_label, from, to, kinds) => {
    expect(WF).toContain(from);
    expect(kindsOf(WF.replace(from, to))).toEqual(kinds);
  });

  it('워크플로가 아예 안 도는 축도 잡는다', () => {
    expect(auditTriggers(parseTriggers(WF))).toEqual([]);
    expect(auditTriggers(parseTriggers(WF.replace('  pull_request:\n    branches: [main]\n', ''))).map(p => p.kind))
      .toEqual(['트리거 소실']);
    expect(auditTriggers(parseTriggers(WF.replace('  push:\n', "  push:\n    paths-ignore: ['**']\n"))).map(p => p.kind))
      .toEqual(['트리거 무력화']);
    // 이름만 남기고 브랜치를 바꾸면 유효한 YAML인 채로 main 검증이 사라진다.
    expect(auditTriggers(parseTriggers(WF.replace('  push:\n    branches: [main]', '  push:\n    branches: [never]'))).map(p => p.kind))
      .toEqual(['트리거 무력화']);
  });

  it('게이트 없는 두 번째 배포 워크플로를 잡는다', () => {
    const main = { name: 'deploy.yml', src: WF };
    expect(auditOtherWorkflows([main])).toEqual([]);
    const other = (uses: string) => ({ name: 'zz.yml', src: `jobs:\n  s:\n    steps:\n      - uses: ${uses}\n` });
    expect(auditOtherWorkflows([main, other('actions/deploy-pages@v4')]).map(p => p.kind)).toEqual(['우회 배포 경로']);
    // YAML 이스케이프로 은폐해도, job 레벨 uses로 숨겨도 잡는다. 원문 문자열 검색이면 둘 다 샌다.
    expect(auditOtherWorkflows([main, other('"actions/deploy\\u002dpages@v4"')]).map(p => p.kind)).toEqual(['우회 배포 경로']);
    expect(auditOtherWorkflows([main, { name: 'zz.yml', src: 'jobs:\n  s:\n    uses: actions/deploy-pages@v4\n' }]).map(p => p.kind))
      .toEqual(['우회 배포 경로']);
    // 반대로 주석의 문자열과 업로드 전용 액션은 오탐이면 안 된다.
    expect(auditOtherWorkflows([main, { name: 'zz.yml', src: '# actions/deploy-pages@v4\njobs:\n  s:\n    steps:\n      - run: echo hi\n' }])).toEqual([]);
    expect(auditOtherWorkflows([main, other('actions/upload-pages-artifact@v3')])).toEqual([]);
  });

  it('스크립트 본문이 하는 일이 바뀌면 잡는다', () => {
    const ok = {
      lint: 'eslint . --max-warnings 0',
      test: 'rm -f node_modules/.tmp/vitest-report.json && vitest run --reporter=json --outputFile.json=node_modules/.tmp/vitest-report.json',
      'build:release': 'GEN_WEBP=1 tsc -b && vite build',
      'verify:ci': 'tsx scripts/verify/run-chain.ts',
    };
    expect(auditScripts(ok)).toEqual([]);
    expect(auditScripts({ ...ok, lint: 'eslint .' }).map(p => p.kind)).toEqual(['스크립트 내용 결손']);
    expect(auditScripts({ ...ok, 'build:release': 'GEN_WEBP=1 vite build' }).map(p => p.kind)).toEqual(['스크립트 내용 결손']);
    // 토큰이 "들어 있나"가 아니라 **그 명령이 실행되나**를 봐야 한다 — echo가 통과했었다.
    expect(auditScripts({ ...ok, lint: 'echo eslint . --max-warnings 0' }).map(p => p.kind)).toEqual(['스크립트 내용 결손']);
    expect(auditScripts({ ...ok, lint: 'eslint . --max-warnings 0 || true' }).map(p => p.kind)).toEqual(['스크립트 무력화']);
    // 게이트 스크립트는 정확한 형태만. 체인은 문자열이 아니라 실행기여야 한다.
    expect(auditScripts({ ...ok, 'verify:dist-x': 'echo tsx scripts/verify/verify-dist-x.ts' }).map(p => p.kind))
      .toEqual(['게이트 형태 위반']);
    expect(auditScripts({ ...ok, 'verify:ci': 'tsx scripts/verify/verify-a.ts && tsx scripts/verify/verify-b.ts' }).map(p => p.kind))
      .toEqual(['게이트 형태 위반']);
    // 등호형 플래그와 별칭 한 겹은 정당하다.
    expect(auditScripts({ ...ok, lint: 'eslint . --max-warnings=0' })).toEqual([]);
    expect(auditScripts({ ...ok, 'verify:content': 'npm run verify:ci' })).toEqual([]);
  });
});
