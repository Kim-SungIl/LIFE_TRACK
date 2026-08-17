// 이미지 자산 실존 — 코드가 가리키는 경로가 public/images 아래에 실제로 있는지.
// jsdom에서 import.meta.url은 file: 스킴이 아니라 throw하므로 cwd 기준으로 잡는다.
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { getBackground } from '../backgrounds';
import { characterStagePrefixByLevel } from '../characterAssets';
import { CG_MANIFEST } from '../../cg-manifest.generated';

const PUBLIC = resolve(process.cwd(), 'public');
const LEVELS = ['elementary', 'middle', 'high'] as const;
const GENDERS = ['m', 'f'] as const;

function publicPath(rel: string): string {
  return resolve(PUBLIC, rel.replace(/^\//, ''));
}

function missing(rels: Iterable<string>): string[] {
  return [...rels].filter(rel => !existsSync(publicPath(rel)));
}

function listPngs(dir: string, skipDir?: (rel: string) => boolean): string[] {
  const out: string[] = [];
  const walk = (current: string) => {
    for (const name of readdirSync(current)) {
      if (name.startsWith('.')) continue;
      const full = join(current, name);
      const rel = relative(dir, full).replaceAll('\\', '/');
      if (statSync(full).isDirectory()) {
        if (skipDir?.(rel)) continue;
        walk(full);
      } else if (name.endsWith('.png')) {
        out.push(rel);
      }
    }
  };
  walk(dir);
  return out;
}

describe('backgrounds.ts 가 만드는 배경 경로', () => {
  it('getBackground()의 모든 학교급·주차·멘탈 조합 이미지가 실존한다', () => {
    const years = [1, 3, 6]; // elementary / middle / high
    const weeks = [1, 8, 9, 19, 20, 24, 25, 34, 35, 42, 43];
    const mentals = ['normal', 'tired', 'burnout'];
    const images = new Set<string>();

    for (const year of years) {
      for (const week of weeks) {
        for (const isVacation of [false, true]) {
          for (const mental of mentals) {
            const bg = getBackground(week, isVacation, mental, year);
            if (bg.image) images.add(bg.image.replace(/^\//, ''));
          }
        }
      }
    }

    expect(images.size).toBeGreaterThan(5);
    expect(missing(images)).toEqual([]);
  });
});

describe('GameScreen prefetch 목록', () => {
  it('prefetchAssets 블록의 모든 전개 경로가 실존한다', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/GameScreen.tsx'), 'utf8');
    const block = src.match(/prefetchAssets\(\[([\s\S]*?)\]\.map\(webpSrc\)/);
    expect(block, 'GameScreen prefetchAssets 블록').toBeTruthy();
    const templates = [...block![1].matchAll(/`([^`]+)`/g)].map(m => m[1]);
    expect(templates.length).toBeGreaterThan(5);

    const paths = new Set<string>();
    for (const schoolLevel of LEVELS) {
      for (const g of GENDERS) {
        const playerPrefix = characterStagePrefixByLevel(`player_${g}`, schoolLevel);
        for (const t of templates) {
          paths.add(
            t.replaceAll('${schoolLevel}', schoolLevel).replaceAll('${playerPrefix}', playerPrefix),
          );
        }
      }
    }

    expect(missing(paths)).toEqual([]);
  });
});

describe('player 자산 12종', () => {
  it('성별 2 × 학교급 3 × {fullbody, neutral} 이 전부 실존한다', () => {
    const paths: string[] = [];
    for (const g of GENDERS) {
      for (const level of LEVELS) {
        for (const kind of ['fullbody', 'neutral'] as const) {
          paths.push(`images/characters/player_${g}_${level}_${kind}.png`);
        }
      }
    }
    expect(paths).toHaveLength(12);
    expect(missing(paths)).toEqual([]);
  });
});

describe('CG_MANIFEST 양방향', () => {
  const eventsDir = resolve(PUBLIC, 'images/events');

  it('매니페스트의 모든 엔트리에 대응하는 파일이 존재한다', () => {
    expect(CG_MANIFEST.size).toBeGreaterThan(100);
    const rels = [...CG_MANIFEST].map(rel => `images/events/${rel}`);
    expect(missing(rels)).toEqual([]);
  });

  it('public/images/events 의 모든 png(_archive 제외)가 매니페스트에 있다', () => {
    const onDisk = listPngs(eventsDir, rel => rel === '_archive' || rel.startsWith('_archive/'));
    expect(onDisk.length).toBeGreaterThan(100);
    const orphans = onDisk.filter(rel => !CG_MANIFEST.has(rel));
    expect(orphans).toEqual([]);
  });
});
