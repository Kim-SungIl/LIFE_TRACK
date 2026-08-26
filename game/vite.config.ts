/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { promises as fs } from 'node:fs'
import path from 'node:path'

// 릴리즈 빌드(GEN_WEBP=1)에서만 dist/images의 png를 webp로 트랜스코딩하고 원본 png를 지운다.
// 소스(public/images)는 건드리지 않으므로 병렬 CG 작업과 무충돌. 일반 build/check는 no-op.
// webpSrc는 런타임 png 폴백이 없으므로, 생성 실패는 조용히 넘기지 않고 릴리즈 빌드를 중단시킨다.
//
// png 삭제가 필수인 이유: 런타임 참조는 전부 webpSrc를 경유해 .webp만 요청하므로
// dist에 남은 png는 단 한 번도 안 읽히는 순수 dead weight다(1.0GB). 남겨두면 배포 산출물이
// ~1.1GB가 되어 GitHub Pages 사이트 한도(1GB)에 걸린다. 지우면 실측 1039.9MB → 61.4MB(5.9%).
// 전제: 모든 이미지 소비 지점이 webpSrc를 경유한다 (<img src>·prefetch·onError 폴백 체인 전부).
//   새 이미지 참조를 추가할 때 webpSrc를 빠뜨리면 릴리즈에서 404가 되므로 반드시 경유시킬 것.
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
      const imagesDir = path.join(options.dir ?? 'dist', 'images')
      let count = 0
      let pngBytes = 0
      let webpBytes = 0
      const failures: string[] = []
      const walk = async (dir: string): Promise<void> => {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        for (const e of entries) {
          const full = path.join(dir, e.name)
          if (e.isDirectory()) {
            await walk(full)
            continue
          }
          if (!e.name.toLowerCase().endsWith('.png')) continue
          const dest = full.replace(/\.png$/i, '.webp')
          try {
            await sharp(full).webp({ quality: 82, effort: 5 }).toFile(dest)
            // 변환 성공한 png만 삭제 — 실패분은 남겨두고 아래에서 빌드를 중단시킨다.
            pngBytes += (await fs.stat(full)).size
            webpBytes += (await fs.stat(dest)).size
            await fs.unlink(full)
            count++
          } catch (err) {
            failures.push(`${full}: ${(err as Error).message}`)
          }
        }
      }
      try {
        await walk(imagesDir)
      } catch (err) {
        this.error(`[webp-gen] ${imagesDir} 순회 실패 — 릴리즈 빌드 중단: ${(err as Error).message}`)
      }
      if (failures.length > 0) {
        this.error(`[webp-gen] ${failures.length}개 png 변환 실패 — 릴리즈 빌드 중단:\n${failures.slice(0, 10).join('\n')}`)
      }
      if (count === 0) {
        this.error(`[webp-gen] 생성된 webp 0개 — ${imagesDir} 확인 필요. 릴리즈 빌드 중단.`)
      }
      const mb = (b: number) => (b / 1048576).toFixed(1)
      console.log(`[webp-gen] ${count}개 webp 생성 + 원본 png 삭제 완료 — `
        + `${mb(pngBytes)}MB → ${mb(webpBytes)}MB (${(webpBytes / pngBytes * 100).toFixed(1)}%)`)
    },
  }
}

// CG 검수 HTML은 public/ 밖에 둔다(빌드가 dist로 복사하지 않게).
// `vite dev`에서만 /cg-review.html 로 서브해, 선행 슬래시 없는 상대경로 images/... 가
// public/images 로 그대로 맞는다. apply:'serve' 라 빌드·preview 산출물에는 안 실인다.
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

export default defineConfig({
  plugins: [react(), webpGenPlugin(), serveCgReviewPlugin()],
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
