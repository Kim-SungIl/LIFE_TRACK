/**
 * Scans events.ts + backgrounds.ts + GameScreen/index preload for referenced
 * background PNGs, compares to public/images/backgrounds/*.png
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const EVENTS_TS = path.join(ROOT, 'src/engine/events.ts');
const BACKGROUNDS_TS = path.join(ROOT, 'src/engine/backgrounds.ts');
const GAME_SCREEN = path.join(ROOT, 'src/components/GameScreen.tsx');
const INDEX_HTML = path.join(ROOT, 'index.html');
const BG_DIR = path.join(ROOT, 'public/images/backgrounds');

const LEVELS = ['elementary', 'middle', 'high'] as const;

function expandKey(bgKey: string): string[] {
  if (bgKey.includes('{school}')) {
    return LEVELS.map((l) => `${bgKey.replace(/\{school\}/g, l)}.png`);
  }
  return [`${bgKey}.png`];
}

function extractFromEvents(text: string): Set<string> {
  const keys = new Set<string>();
  const re = /background:\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    keys.add(m[1]);
  }
  return keys;
}

/** /images/backgrounds/foo.png or `images/backgrounds/foo.png` */
function extractPathStrings(text: string): string[] {
  const out: string[] = [];
  const re = /[`'"]\/?images\/backgrounds\/([^`'"]+\.png)[`'"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(m[1]);
  }
  return out;
}

function main() {
  const eventsText = fs.readFileSync(EVENTS_TS, 'utf8');
  const bgEngineText = fs.readFileSync(BACKGROUNDS_TS, 'utf8');
  const gameScreenText = fs.readFileSync(GAME_SCREEN, 'utf8');
  const indexText = fs.existsSync(path.join(ROOT, 'index.html'))
    ? fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
    : '';

  const needed = new Set<string>();

  for (const key of extractFromEvents(eventsText)) {
    for (const f of expandKey(key)) needed.add(f);
  }

  for (const p of extractPathStrings(bgEngineText)) {
    if (!/\$\{/.test(p)) needed.add(p);
  }
  for (const p of extractPathStrings(gameScreenText)) {
    if (!/\$\{/.test(p)) needed.add(p);
  }
  for (const p of extractPathStrings(indexText)) needed.add(p);

  // backgrounds.ts getBackground() — `classroom_${level}_*` (template literals not caught above)
  for (const L of LEVELS) {
    needed.add(`classroom_${L}_afternoon.png`);
    needed.add(`classroom_${L}_spring.png`);
    needed.add(`classroom_${L}_sunset.png`);
  }
  needed.add('park_spring.png');
  needed.add('home_evening.png');

  // GameScreen.tsx useEffect prefetch — classroom_${level}.*
  for (const L of LEVELS) {
    needed.add(`classroom_${L}.png`);
    needed.add(`hallway_${L}.png`);
    needed.add(`library_${L}.png`);
  }
  needed.add('gymnasium.png');
  needed.add('school_road_morning.png');
  needed.add('bedroom_night.png');

  const onDisk = new Set(
    fs
      .readdirSync(BG_DIR)
      .filter((f) => f.endsWith('.png') && !f.startsWith('.')),
  );

  const missing = [...needed].filter((f) => !onDisk.has(f)).sort();
  const orphans = [...onDisk].filter((f) => !needed.has(f)).sort();

  console.log('=== Unique background keys in events.ts (raw) ===');
  const rawKeys = [...extractFromEvents(eventsText)].sort();
  console.log(rawKeys.join('\n'));
  console.log(`\n(total ${rawKeys.length} unique keys)\n`);

  console.log('=== Expanded PNG filenames required (events + engine + GameScreen + index) ===');
  console.log([...needed].sort().join('\n'));
  console.log(`\n(total ${needed.size} files)\n`);

  console.log('=== MISSING on disk ===');
  if (missing.length === 0) console.log('(none)');
  else missing.forEach((f) => console.log(f));

  console.log('\n=== On disk but not referenced by scan (possible orphans / legacy) ===');
  if (orphans.length === 0) console.log('(none)');
  else orphans.forEach((f) => console.log(f));
}

main();
