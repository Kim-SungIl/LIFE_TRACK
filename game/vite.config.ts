import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { promises as fs } from 'node:fs'
import path from 'node:path'

// 릴리즈 빌드(GEN_WEBP=1)에서만 dist/images의 png를 webp로 트랜스코딩한다.
// 소스(public/images)는 건드리지 않으므로 병렬 CG 작업과 무충돌. 일반 build/check는 no-op.
function webpGenPlugin(): Plugin {
  return {
    name: 'webp-gen',
    apply: 'build',
    async writeBundle(options) {
      if (!process.env.GEN_WEBP) return
      const { default: sharp } = await import('sharp')
      const outDir = options.dir ?? 'dist'
      let count = 0
      const walk = async (dir: string): Promise<void> => {
        const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
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
            console.warn(`[webp-gen] 실패: ${full} — ${(err as Error).message}`)
          }
        }
      }
      await walk(path.join(outDir, 'images'))
      console.log(`[webp-gen] ${count}개 webp 생성 완료`)
    },
  }
}

export default defineConfig({
  plugins: [react(), webpGenPlugin()],
  base: process.env.NODE_ENV === 'production' ? '/LIFE_TRACK/' : '/',
  define: {
    // 릴리즈 빌드에서만 true → webpSrc가 .png→.webp 스왑
    __WEBP_ENABLED__: JSON.stringify(!!process.env.GEN_WEBP),
  },
})
