/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  FIRST_PAINT_TEXT,
  expectedPreloadUrls,
} from './src/styles/first-paint-fonts'

// 릴리즈 빌드(GEN_WEBP=1)에서만 dist/images의 png를 webp로 트랜스코딩하고 원본 png를 지운다.
// 소스(public/images)는 건드리지 않으므로 병렬 CG 작업과 무충돌. 일반 build/check는 no-op.
// webpSrc는 런타임 png 폴백이 없으므로, 생성 실패는 조용히 넘기지 않고 릴리즈 빌드를 중단시킨다.
//
// png 삭제가 필수인 이유: 런타임 참조는 전부 webpSrc를 경유해 .webp만 요청하므로
// dist에 남은 png는 단 한 번도 안 읽히는 순수 dead weight다(1.0GB). 남겨두면 배포 산출물이
// ~1.1GB가 되어 GitHub Pages 사이트 한도(1GB)에 걸린다. 지우면 실측 1039.9MB → 61.4MB(5.9%).
// 전제: 모든 이미지 소비 지점이 webpSrc를 경유한다 (<img src>·prefetch·onError 폴백 체인 전부).
//   새 이미지 참조를 추가할 때 webpSrc를 빠뜨리면 릴리즈에서 404가 되므로 반드시 경유시킬 것.
// 앨범 격자(NpcAlbumScreen, 44px 정사각 셀)는 1440x810 원본을 그대로 받고 있었다.
// 셀 하나가 장당 115KB짜리 이미지를 받는 구조라 지훈 여주판 54칸이 **6.19MB**다(dist 실측).
// 필요한 너비는 objectFit:cover의 바인딩 축에서 나오는데, 축은 **원본 비율마다 다르다**:
//   가로형 1440x810(411장): 높이가 바인딩 — 44 * 16/9 * DPR3 = 235px
//   세로형 1080x1440(26장): **너비가 바인딩** — 44 * DPR3 = 132px
// 즉 지배값은 가로형의 235px이고, 256이면 전 비율에서 DPR3까지 여유가 있다.
// 실측 축소본 평균 7.6KB — 54칸 462KB(13.4배 절감).
// 라이트박스(maxHeight:76vh)는 원본이 필요하므로 축소본이 원본을 **대체하지 않고 추가**된다.
const CG_THUMB_WIDTH = 256

function webpGenPlugin(): Plugin {
  const enabled = process.env.GEN_WEBP === '1'
  return {
    name: 'webp-gen',
    apply: 'build',
    // 릴리즈: index.html의 이미지 png 참조(부트 critical preload 등)도 webp로 스왑 —
    // 렌더는 webp인데 preload가 png면 첫 페인트 경로에서 이중 다운로드가 난다.
    transformIndexHtml(html) {
      if (!enabled) return html
      return html.replace(/(href="[^"]*images\/[^"]*)\.png"/gi, '$1.webp"')
    },
    async writeBundle(options) {
      if (!enabled) return
      const { default: sharp } = await import('sharp')
      // 변환 캐시(선택) — WEBP_CACHE_DIR이 있으면 png 내용 해시로 결과를 재사용한다. CI는 이미지가 안 바뀐
      // PR이 대부분인데 매번 594장을 다시 인코딩했다. 키 = png 바이트 sha256 + 인코더 버전(sharp·libvips·libwebp)
      // + 설정이라, 이미지·설정·인코더 중 하나라도 바뀌면 그 장만 다시 만든다(내용 주소 — 낡은 캐시가 틀린 그림을
      // 낼 경로가 없다). 이번 빌드에서 안 쓴 항목은 끝에서 지워 캐시가 한없이 자라지 않게 한다.
      // 나이틀리는 이 변수 없이 돈다 — 캐시 없는 경로가 매일 한 번은 처음부터 검증된다.
      const cacheDir = process.env.WEBP_CACHE_DIR ? path.resolve(process.env.WEBP_CACHE_DIR) : null
      const v = sharp.versions as Record<string, string>
      const encoderTag = `sharp${v.sharp}-vips${v.vips}-webp${v.webp}-q82e5-t${CG_THUMB_WIDTH}`
      const cacheUsed = new Set<string>()
      let cacheHits = 0
      if (cacheDir) await fs.mkdir(cacheDir, { recursive: true })
      // 캐시 항목을 쓰고 나서 이름을 바꾼다 — 중간에 죽어도 반쪽 파일이 적중으로 읽히지 않게.
      const cachePut = async (src: string, key: string): Promise<void> => {
        if (!cacheDir) return
        const tmp = path.join(cacheDir, `${key}.tmp-${process.pid}`)
        await fs.copyFile(src, tmp)
        await fs.rename(tmp, path.join(cacheDir, key))
      }
      const cacheGet = async (key: string, dest: string): Promise<boolean> => {
        if (!cacheDir) return false
        try {
          await fs.copyFile(path.join(cacheDir, key), dest)
          return true
        } catch {
          return false
        }
      }
      const imagesDir = path.join(options.dir ?? 'dist', 'images')
      const eventsDir = path.join(imagesDir, 'events')
      let count = 0
      let pngBytes = 0
      let webpBytes = 0
      let thumbCount = 0
      let thumbBytes = 0
      const failures: string[] = []
      // 순회와 변환을 나눈다 — 예전엔 한 장씩 await해서 코어 하나만 썼다(로컬 94초 중 user 93초, CI 139초).
      // 파일 목록을 먼저 모은 뒤 코어 수만큼 동시에 변환한다. sharp(libvips)는 장마다 자체 스레드 풀을
      // 또 띄우므로 장 단위 병렬과 겹치면 과구독이 된다 — 장 안의 스레드는 1로 묶는다.
      // 산출물은 순서와 무관하게 같다(파일별 독립 변환). 집계도 합만 쓰므로 순서에 기대지 않는다.
      const pngs: string[] = []
      const walk = async (dir: string): Promise<void> => {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        for (const e of entries) {
          const full = path.join(dir, e.name)
          if (e.isDirectory()) await walk(full)
          else if (e.name.toLowerCase().endsWith('.png')) pngs.push(full)
        }
      }
      const convert = async (full: string): Promise<void> => {
        const dest = full.replace(/\.png$/i, '.webp')
        try {
          const key = cacheDir
            ? createHash('sha256').update(encoderTag).update(await fs.readFile(full)).digest('hex')
            : ''
          if (cacheDir) cacheUsed.add(`${key}.webp`)
          if (await cacheGet(`${key}.webp`, dest)) cacheHits++
          else {
            await sharp(full).webp({ quality: 82, effort: 5 }).toFile(dest)
            await cachePut(dest, `${key}.webp`)
          }
          // CG(images/events)만 축소본을 하나 더 낸다 — 앨범 격자 전용이다.
          // **png를 지우기 전에** 만들어야 한다. 배경·캐릭터는 격자에 안 뜨므로 제외.
          if (full.startsWith(eventsDir + path.sep)) {
            const thumb = full.replace(/\.png$/i, '.thumb.webp')
            if (cacheDir) cacheUsed.add(`${key}.thumb.webp`)
            if (!(await cacheGet(`${key}.thumb.webp`, thumb))) {
              await sharp(full).resize({ width: CG_THUMB_WIDTH }).webp({ quality: 82, effort: 5 }).toFile(thumb)
              await cachePut(thumb, `${key}.thumb.webp`)
            }
            const thumbSize = (await fs.stat(thumb)).size
            thumbBytes += thumbSize
            thumbCount++
          }
          // 변환 성공한 png만 삭제 — 실패분은 남겨두고 아래에서 빌드를 중단시킨다.
          // `x += await …`는 병렬에서 갱신을 잃는다(좌변을 await 전에 읽는다) — 값을 먼저 받고 더한다.
          const pngSize = (await fs.stat(full)).size
          const webpSize = (await fs.stat(dest)).size
          pngBytes += pngSize
          webpBytes += webpSize
          await fs.unlink(full)
          count++
        } catch (err) {
          failures.push(`${full}: ${(err as Error).message}`)
        }
      }
      try {
        await walk(imagesDir)
      } catch (err) {
        this.error(`[webp-gen] ${imagesDir} 순회 실패 — 릴리즈 빌드 중단: ${(err as Error).message}`)
      }
      sharp.concurrency(1)
      const workers = Math.max(1, Math.min(os.availableParallelism(), pngs.length))
      let next = 0
      await Promise.all(Array.from({ length: workers }, async () => {
        while (next < pngs.length) await convert(pngs[next++])
      }))
      if (failures.length > 0) {
        this.error(`[webp-gen] ${failures.length}개 png 변환 실패 — 릴리즈 빌드 중단:\n${failures.slice(0, 10).join('\n')}`)
      }
      if (count === 0) {
        this.error(`[webp-gen] 생성된 webp 0개 — ${imagesDir} 확인 필요. 릴리즈 빌드 중단.`)
      }
      if (thumbCount === 0) {
        this.error(`[webp-gen] CG 축소본 0개 — ${eventsDir} 확인 필요. 앨범 격자가 깨지므로 릴리즈 빌드 중단.`)
      }
      if (cacheDir) {
        let pruned = 0
        for (const name of await fs.readdir(cacheDir)) {
          if (cacheUsed.has(name)) continue
          await fs.rm(path.join(cacheDir, name), { force: true })
          pruned++
        }
        console.log(`[webp-gen] 변환 캐시 ${cacheDir} — 적중 ${cacheHits}/${count}장, 정리 ${pruned}개 (${encoderTag})`)
      }
      const mb = (b: number) => (b / 1048576).toFixed(1)
      console.log(`[webp-gen] ${count}개 webp 생성 + 원본 png 삭제 완료 — `
        + `${mb(pngBytes)}MB → ${mb(webpBytes)}MB (${(webpBytes / pngBytes * 100).toFixed(1)}%)`)
      console.log(`[webp-gen] CG 축소본(${CG_THUMB_WIDTH}w) ${thumbCount}개 — ${mb(thumbBytes)}MB `
        + `(평균 ${(thumbBytes / thumbCount / 1024).toFixed(1)}KB)`)
    },
  }
}

// CG 검수 HTML은 public/ 밖에 둔다(빌드가 dist로 복사하지 않게).
// `vite dev`에서만 /cg-review.html 로 서브해, 선행 슬래시 없는 상대경로 images/... 가
// public/images 로 그대로 맞는다. 빌드 산출물에 안 실리는 이유는 public/ 밖에 있기 때문이고,
// preview에서 안 열리는 이유는 apply:'serve'가 아니라(preview도 serve 모드로 설정을 풀어
// 이 플러그인을 로드한다) preview가 configurePreviewServer만 설치하기 때문이다 — 즉
// 아래 미들웨어가 붙지 않는다. 실측: preview에서 /cg-review.html 은 404.
function serveCgReviewPlugin(): Plugin {
  const file = path.resolve(import.meta.dirname, 'tools/cg-review.html')
  return {
    name: 'serve-cg-review',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0]
        if (url !== '/cg-review.html') {
          next()
          return
        }
        try {
          const html = await fs.readFile(file, 'utf8')
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(html)
        } catch {
          next()
        }
      })
    },
  }
}

// 첫 화면 Pretendard 조각을 index.html <head>에 preload. 해시된 파일명은 번들에서만
// 알 수 있고, CSS url과 한 글자라도 다르면 브라우저가 별개 리소스로 받아 두 번 받는다.
// crossorigin 누락도 같다(preload 익명 + CSS CORS). href는 dist CSS가 방출한 url 그대로.
function firstPaintFontPreloadPlugin(): Plugin {
  return {
    name: 'first-paint-font-preload',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) {
          throw new Error('[first-paint-font-preload] ctx.bundle이 없다 — order:"post"에서만 동작한다')
        }

        const cssParts: string[] = []
        for (const item of Object.values(ctx.bundle)) {
          if (item.type !== 'asset' || !item.fileName.endsWith('.css')) continue
          const src = item.source
          cssParts.push(typeof src === 'string' ? src : new TextDecoder().decode(src))
        }
        const css = cssParts.join('\n')
        if (!css) {
          throw new Error('[first-paint-font-preload] 번들에 CSS가 없다')
        }

        const urls = expectedPreloadUrls(css, FIRST_PAINT_TEXT)
        if (urls.length === 0) {
          throw new Error('[first-paint-font-preload] 선택된 폰트 조각이 0개다 — FIRST_PAINT_TEXT/unicode-range 확인')
        }
        // 상한은 여기서 throw하지 않는다. 빌드 크래시는 단언이 아니라서, 92조각 전부
        // preload 뮤테이션을 verify-dist-fonts 섹션 6이 잡아야 한다.

        const tags = urls
          .map(href => `    <link rel="preload" as="font" type="font/woff2" href="${href}" crossorigin>`)
          .join('\n')
        if (!html.includes('</head>')) {
          throw new Error('[first-paint-font-preload] </head>가 없다')
        }
        return html.replace(/\n\s*<\/head>/, `\n${tags}\n  </head>`)
      },
    },
  }
}

export default defineConfig({
  plugins: [react(), webpGenPlugin(), firstPaintFontPreloadPlugin(), serveCgReviewPlugin()],
  base: process.env.NODE_ENV === 'production' ? '/LIFE_TRACK/' : '/',
  define: {
    // 릴리즈 빌드(GEN_WEBP=1)에서만 true → webpSrc가 .png→.webp 스왑
    __WEBP_ENABLED__: JSON.stringify(process.env.GEN_WEBP === '1'),
  },
  test: {
    // 엔진 순수함수(node) + 컴포넌트(jsdom — 각 파일 상단 @vitest-environment 지시자로 전환)
    //
    // src/** 전체를 훑는다. 이전에는 engine/components 두 경로만 나열했는데, 그러면 새 모듈의
    // 테스트 파일이 **아무 경고 없이 실행되지 않는다**(audio 모듈 추가 때 실제로 겪었다 —
    // 파일을 쓰고 초록을 봤는데 사실은 0개가 돌고 있었다). 경로를 늘릴 때마다 여기를 고쳐야
    // 하는 구조 자체가 함정이라 패턴으로 바꾼다.
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
})
