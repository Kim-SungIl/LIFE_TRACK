// 릴리즈 빌드(GEN_WEBP=1)에서만 이미지 경로의 .png를 .webp로 스왑한다.
// 빌드 플러그인(vite.config의 webp-gen)이 dist/images의 모든 png에 대응하는 webp를
// 생성하므로, 스왑 대상 webp는 항상 존재한다. dev·일반 빌드(__WEBP_ENABLED__=false)는
// png를 그대로 쓴다. 대상 브라우저(Steam Chromium·모던 웹)는 WebP를 보편 지원하므로
// 런타임 지원 감지는 생략한다.
declare const __WEBP_ENABLED__: boolean;

/** png 경로를 릴리즈 빌드에서 webp로 스왑. 쿼리/해시는 보존, png가 아니면 그대로. */
export function webpSrc(path: string): string {
  if (!__WEBP_ENABLED__) return path;
  return path.replace(/\.png($|[?#])/i, '.webp$1');
}
