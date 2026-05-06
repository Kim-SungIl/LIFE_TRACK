# 2026-05-04 Character Regeneration Realistic

Gated generation pass for the realistic ordinary-student tone.

## Scope

Generated 24 requested review images:

- Batch 1 fullbody gate: `junha`, `siwoo`, `yerin`, `seoa`,
  `jihun_high`, `doyun_high`, `yuna_high`, `subin_high`
- Batch 2 new high fullbody: `player_m_high`, `player_f_high`,
  `minjae_high`, `haeun_high`, `seoa_high`
- Batch 2 P1 fullbody regeneration: `doyun`, `doyun_elementary`,
  `minjae_elementary`
- Batch 2 portraits for Batch 1: `junha`, `siwoo`, `yerin`, `seoa`,
  `jihun_high`, `doyun_high`, `yuna_high`, `subin_high`
- Batch 3 fix: `haeun_high` regenerated from production Haeun identity
  after v1 was rejected.
- Batch 4 portraits: added `haeun_high`, `seoa_high`, `minjae_high`,
  `player_m_high`, `player_f_high`, `doyun`, `doyun_elementary`,
  `minjae_elementary`.

Excluded:

- P2 elementary preservation set: `player_m_elementary`, `player_f_elementary`,
  `jihun_elementary`, `subin_elementary`, `yuna_elementary`
- Gender-specific `_f` variants

## Source Documents

- `docs/character-regeneration-prompt-2026-05.md`
- `docs/character-prompt-spec.md`
- `docs/character-regeneration-batch1-prompts-2026-05.md`
- `docs/character-regeneration-batch2-prompts-2026-05.md`

## Folder Layout

- `source/`: generated fullbody sources on magenta chroma-key background
- `fullbody/`: chroma-key removed transparent PNGs
- `portrait/`: portrait review PNGs
- `contact_sheet_source_magenta.png`: source review sheet
- `contact_sheet_fullbody.png`: transparent-output review sheet on checker background
- `contact_sheet_portrait.png`: portrait review sheet
- `contact_sheet_haeun_high_v2.png`: Batch 3 comparison sheet
  (`REJECTED_v1` vs `haeun_high_v2`)
- `manifest.json`: generation metadata

## Review Notes

Acceptable changes from Batch 1 gate:

- `yuna_high` has no sketchbook and remains accepted. Sketchbook is not a
  Haeun cue after the production-spec correction.
- `subin_high` posture reads as a calmer grown version.
- `jihun_high` hair is slightly more settled than the original messy-spiky
  spec, but remains recognizable.
- Fullbody earrings are small; portrait sheet should be used to confirm
  `subin` star earrings and `yerin` studs.

Potential Batch 2 notes:

- `doyun_elementary` shows a soccer ball both held and underfoot; acceptable
  for review, but choose the cleaner version if regenerating.
- `minjae_high` has a stronger confident pose than the ordinary-student
  baseline; still matches his class-energizer spec.

Batch 3 Haeun fix:

- `haeun_high_fullbody_REJECTED_v1.png` and
  `haeun_high_fullbody_source_magenta_REJECTED_v1.png` preserve the rejected
  Yuna-like version.
- Current `haeun_high_fullbody.png` uses the corrected production identity:
  dark brown bob, black-framed glasses, red book held at chest, shy bookish
  stance.
- Haeun must not use Yuna cues: caramel hair, wavy texture, star clip,
  bracelet, sketchbook, or waving pose.

Batch 4 portrait fill:

- Existing accepted portraits were left unchanged: `junha`, `siwoo`, `yerin`,
  `seoa`, `jihun_high`, `doyun_high`, `yuna_high`, `subin_high`.
- Added missing 1:1 portrait counterparts for accepted fullbody assets.
- All new portraits were saved as RGBA PNGs with soft pastel pink-blue
  gradient backgrounds.

## Gate Checklist

Pass before production promotion:

- Correct school-stage proportions: middle 6.5 to 7.0 heads, high 6.8 to 7.2 heads
- No abnormal long-leg or runway proportions
- Youthful student faces, not sharp mature fashion faces
- Ordinary lived-in uniforms, no glossy catalog styling
- Natural student snapshot poses, not idol or runway poses
- High variants preserve character identity, hair, skin tone, and accessories
