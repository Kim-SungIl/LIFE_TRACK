// vitest 공통 셋업 — jest-dom 매처(toBeVisible/toBeDisabled 등) 등록 + RTL cleanup.
// RTL 자동 cleanup은 vitest globals 없이는 등록되지 않아 렌더가 테스트 간 누적된다 → 명시 등록.
// node 환경(엔진 테스트)에서도 로드되지만 matcher 확장 + no-op cleanup뿐이라 무해하다.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(cleanup);

// jsdom은 offsetParent를 항상 null로 둔다(레이아웃 미구현) — Dialog 포커스 트랩의
// "보이는 요소" 필터(n.offsetParent !== null)가 전부 걸러져 트랩이 무력화된다.
// 부모 요소를 돌려주는 근사로 대체(테스트에서 display:none 조상은 다루지 않는다).
if (typeof document !== 'undefined') {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get(this: HTMLElement) { return this.parentElement; },
  });
}
