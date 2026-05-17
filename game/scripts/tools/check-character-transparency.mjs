#!/usr/bin/env node
/**
 * 캐릭터 PNG 이미지 투명도 검사
 * - hasAlpha (sips 결과)와 별개로, 실제 IDAT 안에서 alpha < 255 픽셀이 있는지 확인
 * - sips만으론 "alpha 채널 있음"만 알 수 있고, RGBA여도 전부 불투명이면 사실상 투명 X
 * - 본 스크립트는 PNG IHDR + IDAT를 직접 파싱해서 corner & sample 픽셀의 alpha 값을 본다
 *
 * 실행: node game/scripts/tools/check-character-transparency.mjs
 */
import { readFileSync, readdirSync } from 'fs';
import { inflateSync } from 'zlib';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = new URL('.', import.meta.url).pathname;
const ROOT = join(__dirname, '..', '..');
const DIR = join(ROOT, 'public', 'images', 'characters');

function readPng(filePath) {
  const buf = readFileSync(filePath);
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] !== 0x89 || buf[1] !== 0x50) return null;

  let offset = 8;
  let ihdr = null;
  const idatChunks = [];

  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],   // 0=GR, 2=RGB, 3=Palette, 4=GR+A, 6=RGBA
        interlace: data[12],
      };
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') break;

    offset += 12 + length; // length(4) + type(4) + data(N) + CRC(4)
  }

  return { ihdr, idatChunks };
}

function decompress(idatChunks) {
  const combined = Buffer.concat(idatChunks);
  return inflateSync(combined);
}

function pngUnfilter(rawData, width, height, bytesPerPixel) {
  // Each scanline: filter byte + (width * bytesPerPixel) bytes
  const stride = width * bytesPerPixel;
  const out = Buffer.alloc(height * stride);

  let inOffset = 0;
  let outOffset = 0;

  for (let y = 0; y < height; y++) {
    const filter = rawData[inOffset++];
    const prev = y > 0 ? out.subarray(outOffset - stride, outOffset) : null;

    for (let x = 0; x < stride; x++) {
      const a = x >= bytesPerPixel ? out[outOffset + x - bytesPerPixel] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bytesPerPixel ? prev[x - bytesPerPixel] : 0;
      let val = rawData[inOffset + x];

      if (filter === 1) val = (val + a) & 0xff;
      else if (filter === 2) val = (val + b) & 0xff;
      else if (filter === 3) val = (val + Math.floor((a + b) / 2)) & 0xff;
      else if (filter === 4) {
        // Paeth predictor
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        val = (val + pr) & 0xff;
      }
      out[outOffset + x] = val;
    }

    inOffset += stride;
    outOffset += stride;
  }

  return out;
}

function checkTransparency(filePath) {
  const png = readPng(filePath);
  if (!png || !png.ihdr) return { ok: false, reason: 'PNG 파싱 실패' };

  const { width, height, colorType, bitDepth, interlace } = png.ihdr;

  // Only handle RGBA / GR+A (colorType 6 or 4), bitDepth 8, no interlace
  // 그 외는 alpha 자체가 없으므로 transparent 불가
  if (colorType !== 6 && colorType !== 4) {
    return { hasAlphaChannel: false, transparent: false, colorType };
  }

  if (bitDepth !== 8 || interlace !== 0) {
    return { hasAlphaChannel: true, transparent: 'unknown', reason: `bitDepth=${bitDepth} interlace=${interlace} (지원 X)` };
  }

  const bytesPerPixel = colorType === 6 ? 4 : 2;
  let rawData;
  try {
    rawData = decompress(png.idatChunks);
  } catch (e) {
    return { hasAlphaChannel: true, transparent: 'unknown', reason: 'IDAT 압축 해제 실패: ' + e.message };
  }

  const pixels = pngUnfilter(rawData, width, height, bytesPerPixel);

  // 샘플링: 코너 4개 + 가장자리 중간점 4개 + 전체 중 1000 픽셀 랜덤
  const samples = [];
  const addSample = (x, y) => {
    const idx = (y * width + x) * bytesPerPixel;
    const alpha = pixels[idx + bytesPerPixel - 1];
    samples.push({ x, y, alpha });
  };

  addSample(0, 0);
  addSample(width - 1, 0);
  addSample(0, height - 1);
  addSample(width - 1, height - 1);
  addSample(Math.floor(width / 2), 0);
  addSample(Math.floor(width / 2), height - 1);
  addSample(0, Math.floor(height / 2));
  addSample(width - 1, Math.floor(height / 2));

  // 전체 픽셀에서 투명/반투명 픽셀 비율 계산
  let transparentCount = 0;
  const total = width * height;
  for (let i = 0; i < total; i++) {
    const alpha = pixels[(i + 1) * bytesPerPixel - 1];
    if (alpha < 255) transparentCount++;
  }

  const transparentRatio = transparentCount / total;
  const cornerAlphas = samples.slice(0, 4).map(s => s.alpha);
  const allCornersOpaque = cornerAlphas.every(a => a === 255);

  return {
    hasAlphaChannel: true,
    colorType,
    transparentRatio,
    cornerAlphas,
    allCornersOpaque,
    transparent: transparentRatio > 0.01, // 1% 이상 투명 픽셀이 있으면 "투명 처리됨"
  };
}

console.log('=== 캐릭터 이미지 투명도 검사 ===\n');

const files = readdirSync(DIR).filter(f => f.endsWith('.png')).sort();

const noAlphaChannel = [];
const allOpaqueDespiteAlpha = [];
const properlyTransparent = [];
const partialIssues = [];

for (const file of files) {
  const filePath = join(DIR, file);
  const result = checkTransparency(filePath);

  if (!result.hasAlphaChannel) {
    noAlphaChannel.push({ file, colorType: result.colorType });
  } else if (result.transparent === 'unknown') {
    partialIssues.push({ file, reason: result.reason });
  } else if (!result.transparent) {
    allOpaqueDespiteAlpha.push({ file, cornerAlphas: result.cornerAlphas });
  } else {
    properlyTransparent.push({ file, transparentRatio: result.transparentRatio, allCornersOpaque: result.allCornersOpaque });
  }
}

console.log(`🚨 alpha 채널 자체가 없음 (RGB only) — ${noAlphaChannel.length}개:`);
for (const { file, colorType } of noAlphaChannel) {
  console.log(`   ${file}  (colorType=${colorType})`);
}

console.log(`\n🚨 alpha 채널은 있지만 모든 픽셀이 불투명 — ${allOpaqueDespiteAlpha.length}개:`);
for (const { file, cornerAlphas } of allOpaqueDespiteAlpha) {
  console.log(`   ${file}  (corners=[${cornerAlphas.join(',')}])`);
}

console.log(`\n✅ 정상 (투명 픽셀 ≥1%) — ${properlyTransparent.length}개:`);
for (const { file, transparentRatio, allCornersOpaque } of properlyTransparent) {
  const ratioPct = (transparentRatio * 100).toFixed(1);
  const flag = allCornersOpaque ? ' ⚠️ 코너는 모두 불투명 (배경 잘렸을 수 있음)' : '';
  console.log(`   ${file}  (투명 ${ratioPct}%)${flag}`);
}

if (partialIssues.length > 0) {
  console.log(`\n⚠️  파싱 한계 (수동 확인 필요) — ${partialIssues.length}개:`);
  for (const { file, reason } of partialIssues) {
    console.log(`   ${file}  (${reason})`);
  }
}

console.log(`\n=== 요약 ===`);
console.log(`  전체: ${files.length}개`);
console.log(`  🚨 alpha 채널 없음: ${noAlphaChannel.length}개`);
console.log(`  🚨 alpha 있으나 전부 불투명: ${allOpaqueDespiteAlpha.length}개`);
console.log(`  ✅ 투명 처리됨: ${properlyTransparent.length}개`);
if (partialIssues.length > 0) console.log(`  ⚠️  미검증: ${partialIssues.length}개`);
