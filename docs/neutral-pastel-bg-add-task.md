# [CODEX TASK] Neutral 포트레이트에 파스텔 배경 합성 (얼굴/캐릭터 불변)

## 목표 (한 줄)
기존 neutral 포트레이트 PNG(투명 배경)의 **캐릭터 픽셀은 1개도 바꾸지 않고**, 뒤에 **soft pastel pink→blue 그라데이션 배경만 합성**해서 같은 파일명으로 덮어쓴다.

## 절대 제약 (CRITICAL)
- **재생성 금지 / 이미지 생성 모델 사용 금지.** 텍스트→이미지 재생성은 얼굴이 바뀌므로 절대 쓰지 않는다.
- 캐릭터(인물) 픽셀은 원본 그대로 보존. **배경(현재 투명 영역)만 채운다.**
- 즉 이건 순수 **알파 합성(alpha composite)** 작업이다: `결과 = 파스텔배경 위에 원본PNG를 알파 합성`.
- 반투명 가장자리(머리카락 등 anti-alias)는 그대로 살려 자연스럽게 배경과 섞이게 한다.

## 대상 파일 (24개) — `game/public/images/characters/`
```
player_m_neutral        player_m_high_neutral
player_f_neutral        player_f_high_neutral
jihun_neutral           jihun_elementary_neutral   jihun_high_neutral
subin_neutral           subin_high_neutral
minjae_neutral          minjae_elementary_neutral  minjae_high_neutral
yuna_neutral            yuna_elementary_neutral    yuna_high_neutral
doyun_neutral           doyun_elementary_neutral   doyun_high_neutral
haeun_neutral           haeun_high_neutral
seoa_neutral            siwoo_neutral
junha_neutral           yerin_neutral
```
**제외(이미 정상 파스텔, 건드리지 말 것)**: `subin_elementary_neutral`, `player_f_elementary_neutral`, `player_m_elementary_neutral`.

> 배경 크기는 각 파일의 원본 크기에 맞춘다 (대부분 1024×1536, 단 `jihun_neutral`=512×1024, `subin_high_neutral`·`yuna_high_neutral`=1023×1537).

## 파스텔 배경 스펙
기존 정상 파스텔 neutral(`subin_elementary_neutral` 등)에서 샘플링한 톤에 맞춘다. 위→아래 핑크→블루 대각 그라데이션, 아주 옅은 파스텔.

4코너 기준색(이미지 크기에 맞춰 bilinear 보간):
```
top-left     RGB(253, 224, 236)   # soft pink
top-right    RGB(250, 230, 248)   # pink-lavender
bottom-left  RGB(236, 242, 252)   # pale blue
bottom-right RGB(244, 246, 252)   # sky blue
```
- (선택, 권장) 분위기 일치를 위해 아주 옅은 sparkle/bokeh 점을 흩뿌려도 좋다(불투명도 낮게, 과하지 않게). 필수 아님 — 기본은 매끈한 그라데이션.

## 흰 fringe 선처리 (합성 전, 해당 파일만)
일부 파일은 배경 제거가 덜 돼 **불투명한 흰 잔여물/halo**가 가장자리에 남아 있다. 그냥 배경을 깔면 흰 테두리가 보이므로, 합성 **전에** 정리한다.

대상 및 강도:
- `doyun_elementary_neutral` — 테두리 흰 약 25% (하단 + 우측 팔 옆). **반드시 정리.**
- `siwoo_neutral` — 하단 흰 띠 약 10%. **반드시 정리.**
- `jihun_neutral` — 경미(약 2%). 가볍게 정리 권장.

정리 방법(안전 규칙):
1. **테두리/투명영역에 연결된** near-white 불투명 픽셀만 제거(알파→0). 이미지 경계와 기존 투명영역에서 flood-fill로 near-white(예: R,G,B 모두 >238 & 채널차<12)를 따라 들어가며 제거.
2. **인물 내부의 흰색(doyun 저지 카라·소매, siwoo 셔츠)은 보존** — 이들은 컬러에 둘러싸여 테두리와 끊겨 있으므로 flood-fill에 안 걸린다.
3. 보조로 알파 경계를 1px erode 해 잔털 같은 흰 halo를 제거해도 됨(실루엣 거의 불변).
4. 정리 후에도 흰 점이 남으면 위 1을 반복하거나 임계값을 약간 높인다.

## 작업 순서
1. 대상 24개 각각 로드(RGBA).
2. fringe 대상이면 흰 잔여물 선처리.
3. 동일 크기의 파스텔 그라데이션 배경 생성.
4. `Image.alpha_composite(배경, 원본)` → RGB(또는 RGBA 불투명)로 저장, **같은 파일명 덮어쓰기**.
5. 원본 캐릭터 영역 픽셀이 바뀌지 않았는지 self-check(아래).

## 검증 (완료 기준)
- [ ] 24개 모두 배경이 더 이상 투명이 아니고 파스텔 그라데이션이다 (코너가 위 기준색 근처).
- [ ] **인물 보존 확인**: 원본의 불투명 영역(alpha>200) 픽셀의 RGB가 결과물에서 동일해야 한다. 픽셀 단위 diff로 인물 영역 변화 0 확인.
- [ ] `doyun_elementary`, `siwoo`(및 `jihun`) 가장자리에 흰 halo/잔여물이 없다.
- [ ] doyun 저지 흰 카라·소매, siwoo 흰 셔츠 등 **인물 내부 흰색은 그대로 보존**됐다.
- [ ] 제외 3개(subin/player_f/player_m_elementary)는 수정되지 않았다.
- [ ] 크기·종횡비가 원본과 동일.

## 참고 문서
- 캐릭터 배경 컨벤션·사고 기록: `docs/character-prompt-spec.md` (Section 2 Portrait, Section 9 Background Removal, Section 4.5 face consistency).
- 이번 작업의 배경(왜 파스텔로 되돌리나): 2026-05-20 일괄 알파 제거가 파스텔이어야 할 neutral 포트레이트까지 투명으로 만든 것을 복구.
- (참고용, 텍스트 재생성 프롬프트는 이 작업에선 쓰지 않음 — 얼굴 변경 위험: `docs/neutral-pastel-regen-2026-05-30.md`)
