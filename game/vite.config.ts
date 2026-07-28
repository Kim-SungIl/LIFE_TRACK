/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { promises as fs } from 'node:fs'
import path from 'node:path'

// 릴리즈 빌드(GEN_WEBP=1)에서만 dist/images의 png를 webp로 트랜스코딩한다.
// 소스(public/images)는 건드리지 않으므로 병렬 CG 작업과 무충돌. 일반 build/check는 no-op.
// webpSrc는 런타임 png 폴백이 없으므로, 생성 실패는 조용히 넘기지 않고 릴리즈 빌드를 중단시킨다.
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
      console.log(`[webp-gen] ${count}개 webp 생성 완료`)
    },
  }
}

export default defineConfig({
  plugins: [react(), webpGenPlugin()],
  base: process.env.NODE_ENV === 'production' ? '/LIFE_TRACK/' : '/',
  define: {
    // 릴리즈 빌드(GEN_WEBP=1)에서만 true → webpSrc가 .png→.webp 스왑
    __WEBP_ENABLED__: JSON.stringify(process.env.GEN_WEBP === '1'),
  },
  test: {
    // 엔진 순수함수(node) + 컴포넌트(jsdom — 각 파일 상단 @vitest-environment 지시자로 전환)
    include: ['src/engine/__tests__/**/*.test.ts', 'src/components/**/__tests__/**/*.test.tsx'],
    setupFiles: ['src/test/setup.ts'],
  },
})
