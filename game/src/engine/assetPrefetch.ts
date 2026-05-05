// 자산 prefetch — 화면 전환 직전에 브라우저 캐시에 미리 적재해
// "검은 화면 → 빈 배경 → 캐릭터 노출" 워터폴 체감을 줄임.
// new Image()는 fetch만 트리거하고 DOM에 안 붙임 → 브라우저 이미지 캐시에 들어가
// 이후 같은 src를 가진 <img>가 마운트되면 즉시 표시됨.

const BASE = import.meta.env.BASE_URL;
const prefetched = new Set<string>();

function toAbs(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${BASE}${url.replace(/^\//, '')}`;
}

export function prefetchAsset(url: string | null | undefined): void {
  if (!url) return;
  const abs = toAbs(url);
  if (prefetched.has(abs)) return;
  prefetched.add(abs);
  const img = new Image();
  img.src = abs;
}

export function prefetchAssets(urls: (string | null | undefined)[]): void {
  for (const u of urls) prefetchAsset(u);
}
