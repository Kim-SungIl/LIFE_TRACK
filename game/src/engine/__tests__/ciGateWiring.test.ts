// **CI가 게이트를 실제로 부르는가.**
//
// 이 파일이 따로 있는 이유는 하나다. 같은 판정을 `verify:ci`에서도 돌리는데(content-verify job),
// **그 `verify:ci` 스텝 자체를 deploy.yml에서 지우면 그쪽 검사는 아예 실행되지 않는다.**
// 이 테스트는 build job의 `npm test`에서 도므로 그 편집을 여기서 잡는다.
// 반대로 `npm test` 스텝을 지우면 content-verify 쪽이 잡는다 — 두 자리가 서로를 덮는다.
// 한 자리에만 두면 그 자리를 지우는 단일 편집이 통과한다(#397·#431과 같은 "호출부 미잠금" 계열).
//
// 잠금은 양방향이다: **이 파일이 사라지는 것**은 verify-ci-gates의 auditRegistration이 잡고,
// **verify-ci-gates의 자기검사 블록이 사라지는 것**은 아래 SELF_CHECK_COUNT 단언이 잡는다.
// (게이트 스크립트 쪽은 실워크플로가 상시 정합이라 자기검사를 지워도 여전히 초록이다.)
//
// import 자체에도 의미가 있다: verify-ci-gates.ts는 **모듈 최상위에서 자기검사를 돌리므로**,
// 파서나 판정부가 깨지면 이 파일이 import 단계에서 터진다.
import { describe, expect, it } from 'vitest';
import { auditRepo, auditGates, parseWorkflow, SELF_CHECK_COUNT } from '../../../scripts/verify/verify-ci-gates';

describe('CI 게이트 배선', () => {
  it('deploy.yml이 package.json의 dist 게이트를 전부 부른다', () => {
    const { problems, distGates } = auditRepo();
    // 전제 붕괴 방지 — 요구가 0이면 "전부 충족"으로 공허하게 통과한다.
    expect(distGates.length, '전제 붕괴: verify:dist-* 스크립트를 하나도 못 찾았다').toBeGreaterThanOrEqual(5);
    expect(problems.map(p => `[${p.kind}] ${p.detail}`)).toEqual([]);
  });

  it('전제: 실제 워크플로가 파싱된다 (job 3개 · build 스텝 다수)', () => {
    const { jobs } = auditRepo();
    expect(jobs.map(j => j.name)).toEqual(['build', 'content-verify', 'deploy']);
    expect(jobs[0].runs.length).toBeGreaterThan(5);
  });

  // 양성 대조군 — 판정부가 살아 있는지 매 실행마다 확인한다. 위 두 단언은 "문제 없음"만 보므로
  // 판정부를 통째로 비워도 통과한다(부정형 단언만 두면 분기를 지워도 초록인 계열).
  it('게이트 스텝을 지운 합성 워크플로는 잡힌다', () => {
    const yaml = [
      'jobs:',
      '  build:',
      '    steps:',
      '      - run: npm run lint',
      '      - run: npm test',
      '      - run: npm run verify:test-floor',
      '      - run: npm run build:release',
      '  content-verify:',
      '    steps:',
      '      - run: npm run verify:ci',
      '  deploy:',
      '    needs: [build, content-verify]',
      '    steps:',
      '      - uses: actions/deploy-pages@v4',
    ].join('\n');
    const kinds = auditGates(parseWorkflow(yaml), ['verify:dist-fonts']).map(p => p.kind);
    expect(kinds).toEqual(['게이트 미배선']);
  });

  // 게이트를 무력화하는 한 줄들. 스텝은 그대로 있는데 안 돌거나, 붉어도 job이 성공한다.
  it.each([
    ['게이트 스텝의 continue-on-error', '      - run: npm run verify:dist-fonts', '      - run: npm run verify:dist-fonts\n        continue-on-error: true', '스텝 무력화'],
    ['게이트 스텝의 if', '      - run: npm run verify:dist-fonts', '      - if: false\n        run: npm run verify:dist-fonts', '스텝 무력화'],
    ['build job 레벨 if', '  build:', '  build:\n    if: false', 'job 무력화'],
    ['build job 레벨 continue-on-error', '  build:', '  build:\n    continue-on-error: true', 'job 무력화'],
    ['content-verify job 레벨 if', '  content-verify:', '  content-verify:\n    if: false', 'job 무력화'],
  ])('%s는 잡힌다', (_label, from, to, kind) => {
    const base = [
      'jobs:',
      '  build:',
      '    steps:',
      '      - run: npm run lint',
      '      - run: npm test',
      '      - run: npm run verify:test-floor',
      '      - run: npm run build:release',
      '      - run: npm run verify:dist-fonts',
      '  content-verify:',
      '    steps:',
      '      - run: npm run verify:ci',
      '  deploy:',
      '    needs: [build, content-verify]',
      '    steps:',
      '      - uses: actions/deploy-pages@v4',
    ].join('\n');
    expect(base).toContain(from);
    const kinds = auditGates(parseWorkflow(base.replace(from, to)), ['verify:dist-fonts']).map(p => p.kind);
    expect(kinds).toEqual([kind]);
  });

  // 게이트 스크립트의 자기검사 블록을 통째로 지우면 스크립트는 여전히 초록이다(실파일이 정합이라).
  // 여기서 잡는다 — 자기검사는 테스트가, 테스트는 게이트가 잠근다.
  it('verify-ci-gates의 자기검사가 실제로 돈다', () => {
    expect(SELF_CHECK_COUNT).toBeGreaterThanOrEqual(40);
  });
});
