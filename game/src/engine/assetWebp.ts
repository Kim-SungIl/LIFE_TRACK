// 릴리즈 빌드(GEN_WEBP=1)에서만 이미지 경로의 .png를 .webp로 스왑한다.
// 빌드 플러그인(vite.config의 webp-gen)이 dist/images의 모든 png에 대응하는 webp를
// 생성하므로, 스왑 대상 webp는 항상 존재한다. dev·일반 빌드(__WEBP_ENABLED__=false)는
// png를 그대로 쓴다. 대상 브라우저(Steam Chromium·모던 웹)는 WebP를 보편 지원하므로
// 런타임 지원 감지는 생략한다.
declare const __WEBP_ENABLED__: boolean;

/** png 경로를 릴리즈 빌드에서 webp로 스왑. 쿼리/해시는 보존, png가 아니면 그대로.
 *  vite define가 없는 순수 node 실행(tsx 스크립트가 컴포넌트 체인을 import하는 경우)에서
 *  ReferenceError가 나지 않도록 typeof 가드. */
export function webpSrc(path: string): string {
  if (typeof __WEBP_ENABLED__ === 'undefined' || !__WEBP_ENABLED__) return path;
  return path.replace(/\.png($|[?#])/i, '.webp$1');
}

/**
 * CG 축소본(vite webp-gen이 images/events/**에만 내는 `.thumb.webp`, 너비 256) 경로.
 *
 * **격자 전용이다.** 라이트박스·결과 화면·회상 갤러리는 원본을 써야 한다 —
 * 앨범 격자(44px 셀)만 1440x810을 받아 지훈 여주판 54칸이 6.19MB였다(dist 실측).
 *
 * webpSrc와 같은 이유로 릴리즈에서만 스왑한다. dev·일반 build는 축소본이 아예 없으므로
 * png를 그대로 돌려준다 — 여기서 무조건 스왑하면 개발 중 앨범이 통째로 깨진다.
 */
export function cgThumbSrc(path: string): string {
  if (typeof __WEBP_ENABLED__ === 'undefined' || !__WEBP_ENABLED__) return path;
  return path.replace(/\.png($|[?#])/i, '.thumb.webp$1');
}

