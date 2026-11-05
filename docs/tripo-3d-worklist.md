# Tripo 3D 작업 목록 — MBTI 타운 (Claude in Chrome 작업용)

> 만든 날: 2026-11-05 · 대상: 지금 게임에 **임시 모델(`_ph`)** 로 들어가 있는 3D 오브젝트
> 이미 실제 모델로 바뀐 것(사람 캐릭터, 동물 주민 4종, 강아지 펫, 나무·덤불·돌 같은 자연물)은 목록에 없다.

이 문서는 **Claude in Chrome**이 Tripo 웹사이트(https://www.tripo3d.ai)에서 순서대로 3D 모델을 만들고 내려받도록 쓴 작업 지시서다.
내려받은 파일은 사용자가 Claude Code에게 넘기고, Claude Code가 크기·바닥 위치·방향·용량을 맞춰 게임에 넣는다.

---

## 0. Claude in Chrome 작업 규칙 (먼저 읽기)

### 하지 말 것
- 결제, 요금제 바꾸기, 크레딧 사기, 구독 버튼 누르기. 결제 창이 뜨면 닫는다.
- 모델을 공개·공유하거나 커뮤니티에 올리기. 공개 여부를 고르는 칸이 있으면 **비공개(Private)** 로 둔다.
- 이미 있는 모델 지우기, 계정 설정 바꾸기.
- tripo3d.ai 밖의 사이트로 가기 (광고·이벤트 링크 누르지 않기).

### 멈추고 사용자에게 물을 때
- 로그인 화면이 나올 때 (비밀번호를 대신 넣지 않는다).
- 크레딧이 모자라 다음 항목을 만들 수 없을 때. 그때까지 한 것을 진행 표에 적고 멈춘다.
- 같은 항목을 3번 만들어도 "고르는 기준"에 맞는 결과가 없을 때. 그 항목은 ⚠️로 적고 다음으로 넘어간다.

### 항목 하나를 만드는 순서
1. **Text to 3D**(글로 만들기)를 연다.
2. 프롬프트 칸에 **항목의 프롬프트 + 공백 + 공통 스타일**(1장)을 그대로 붙여 넣는다.
   부정 프롬프트(Negative prompt) 칸이 있으면 **공통 부정 프롬프트**를 넣는다.
3. 옵션은 아래처럼 맞춘다. 이름이 조금 다르면 가장 가까운 것을 고르고, 없는 옵션은 건너뛴다.
   - 텍스처(Texture): **켜기**. 고를 수 있으면 HD/고화질.
   - PBR: 끄기 (또는 기본값).
   - 면 수 제한(Face limit / Polycount): 항목에 적힌 **면 수 상한**. 고를 수 없으면 기본값.
   - 쿼드(Quad) 메시: **끄기** (삼각형).
   - 스타일(Style)을 고르는 칸이 있으면: Cartoon / Stylized 계열.
   - 리깅(Rig)·애니메이션: **하지 않는다**.
4. 만들기를 누르고 기다린다. 시안이 여러 개 나오면 **고르는 기준**으로 하나를 고른다.
   텍스처를 따로 입히는 단계(예: "Texture", "Refine")가 있으면 고른 시안에 실행한다.
5. 기준에 맞는 게 없으면 다시 만든다 (같은 프롬프트로, 또는 항목의 "다시 할 때 덧붙이기"를 프롬프트 앞에 붙여서). **한 항목에 최대 3번.**
6. 고른 모델의 이름을 항목의 **파일 이름**(예: `furn_turntable`)으로 바꾼다. 이름을 바꿀 수 없으면 그대로 둔다.
7. **GLB** 형식으로 내려받는다 (텍스처 포함 옵션이 있으면 포함).
8. 맨 아래 **진행 표**의 그 줄에 상태(✅ 완료 / ⚠️ 기준 미달 / ⏭️ 건너뜀), 모델 페이지 주소, 내려받은 파일 이름, 짧은 메모를 적는다.

### 고르는 기준 (모든 항목 공통)
- **물체 하나만** 있다. 바닥 판·받침대·배경·여러 개의 물체가 붙어 있으면 안 된다 (항목에 "받침 포함"이라고 적힌 것은 예외).
- 정면(앞모습)이 또렷하고, 위아래가 뒤집히거나 비스듬히 누워 있지 않다.
- **글자·숫자·로고가 없다.** (간판 자리는 비어 있어야 한다. 글자는 게임이 그린다.)
- 색이 밝은 파스텔 톤이고, 표면이 매끈하며, 모양이 단순하고 둥글둥글하다 (사람 캐릭터·동물 주민과 어울리게).
- 항목의 **꼭 있어야 할 것**이 보이고, **비워 둘 곳**이 비어 있다.
- 크기 비율(가로:높이:깊이)이 항목의 크기와 대체로 비슷하다. 크기 자체는 나중에 맞추므로 정확하지 않아도 된다.

---

## 1. 공통 스타일 (모든 프롬프트 뒤에 붙인다)

**공통 스타일**
```
cute stylized cozy life-sim game asset, chibi toy-like proportions, chunky rounded shapes with soft bevels, soft pastel colors, smooth clean surfaces with subtle hand-painted texture, simple readable silhouette, single object, centered, front view, no text, no logo, no base, no ground
```

**공통 부정 프롬프트** (칸이 있을 때만)
```
realistic, photorealistic, gritty, noisy fine detail, text, letters, numbers, logo, watermark, multiple objects, base platform, pedestal, ground plane, floor, scene, background, people, character, animal
```

---

## 2. 게임에 넣을 때 우리가 맞추는 것 (Claude in Chrome은 신경 쓰지 않아도 된다)

- 크기, 바닥 가운데 기준점, 정면 방향(+Z), 텍스처 크기·용량은 Claude Code의 변환 스크립트가 맞춘다.
- 아래 자리는 게임이 따로 칠하거나 그린다. 그래서 Tripo 모델에서는 **흰색·빈칸으로 두는 것이 좋다** (항목마다 "비워 둘 곳"에 적었다).
  - **마을 색 자리**: 집 지붕, 동네 아치 현판, 상가 점포 차양 줄무늬, 깃발 천. 화면에서 마을(MBTI) 색이나 주인이 고른 색을 입힌다.
  - **옷 색 자리**: 모자, 헤드폰 귀덮개. 캐릭터 티셔츠 색을 입힌다.
  - **그림이 들어가는 자리**: 창문 유리(창밖 풍경), 사진 액자 안(내 사진), 광장 전광판 화면(순위·토론 글), 상가 간판(점포 이름).
  - **빛나는 자리**: 스탠드 갓, 가로등 등, 비콘 수정, 촛불처럼 밤에 켜지는 곳. 밝은 색으로만 칠해 두면 된다.
- 나뭇잎은 바람에 흔들리게 따로 표시한다. 잎과 열매가 줄기와 붙어 있어도 괜찮다.

---

## 3. 작업 목록

크기는 **가로 × 높이 × 깊이** (1 = 바닥 한 칸 = 약 1m)이고, 사람 캐릭터 키는 약 1.3이다. "정면"은 사람이 보는 쪽이다.

### 1순위 — 나의 방 가구 (15개)

방은 1인칭으로 가까이서 보므로 모양이 깔끔해야 한다. 바닥 가구는 바닥에 서 있는 모습, 벽 가구는 벽에 거는 모습으로 만든다.

#### F01 · 턴테이블 — `furn_turntable`
- 쓰는 곳: 방 바닥 (누르면 배경음악이 나온다) · 크기 0.8 × 0.8 × 0.7 · 면 수 상한 8,000
- 프롬프트: `a retro record player turntable on top of a small low wooden cabinet, vinyl record on the platter, tonearm, two small round speaker grills on the cabinet front`
- 꼭 있어야 할 것: 위에서 레코드판이 잘 보일 것

#### F02 · 책상 — `furn_desk`
- 쓰는 곳: 방 바닥, 가로 2칸 (누르면 기록 쓰기) · 크기 1.9 × 0.9 × 0.8 · 면 수 상한 8,000
- 프롬프트: `a cozy wooden writing desk with a drawer unit on one side and simple legs, an open notebook and a small pencil cup on the desktop`
- 꼭 있어야 할 것: 가로로 긴 책상 (가로가 높이의 2배쯤)

#### F03 · 우편함 — `furn_mailbox`
- 쓰는 곳: 방 바닥 (누르면 방명록) · 크기 0.6 × 1.15 × 0.35 · 면 수 상한 5,000
- 프롬프트: `a cute standing mailbox on a single wooden post, rounded top, a small red flag on the side, a letter slot on the front`
- 꼭 있어야 할 것: 기둥 하나 위의 우편함, 정면의 편지 넣는 곳

#### F04 · 옷장 — `furn_wardrobe`
- 쓰는 곳: 방 바닥 (누르면 옷장 = 캐릭터 꾸미기) · 크기 1.0 × 1.9 × 0.6 · 면 수 상한 6,000
- 프롬프트: `a tall two-door wooden wardrobe with round knobs, small rounded feet and a softly rounded top edge`
- 꼭 있어야 할 것: 문 두 짝이 닫힌 앞모습

#### F05 · 책장 — `furn_bookshelf`
- 쓰는 곳: 방 바닥 · 크기 0.9 × 1.8 × 0.4 · 면 수 상한 8,000
- 프롬프트: `a tall open wooden bookshelf with four shelves filled with colorful books, a small potted plant on one shelf`
- 꼭 있어야 할 것: 앞이 트인 책장 (문 없음)

#### F06 · 소파 — `furn_sofa`
- 쓰는 곳: 방 바닥, 가로 2칸 · 크기 1.85 × 0.9 × 0.8 · 면 수 상한 8,000
- 프롬프트: `a plump two-seat fabric sofa with rounded armrests, two seat cushions and two small throw pillows`

#### F07 · 침대 — `furn_bed`
- 쓰는 곳: 방 바닥, 세로 2칸 · 크기 0.95 × 0.9 × 1.95 · 면 수 상한 10,000
- 프롬프트: `a cozy single bed with a wooden frame and a tall rounded headboard, a fluffy pillow and a thick folded quilt blanket`
- 꼭 있어야 할 것: 1인용 침대 (폭이 좁고 길이가 길다), 머리판
- 다시 할 때 덧붙이기: `three-quarter view, long single bed,`

#### F08 · 의자 — `furn_chair`
- 쓰는 곳: 방 바닥 · 크기 0.5 × 0.9 × 0.5 · 면 수 상한 5,000
- 프롬프트: `a small wooden chair with a rounded backrest and a soft seat cushion`

#### F09 · 탁자 — `furn_table`
- 쓰는 곳: 방 바닥 · 크기 0.75 × 0.75 × 0.75 · 면 수 상한 5,000
- 프롬프트: `a small round wooden side table with four short legs, a teacup on top`

#### F10 · 화분 — `furn_plant`
- 쓰는 곳: 방 바닥 · 크기 0.6 × 1.0 × 0.45 · 면 수 상한 8,000
- 프롬프트: `a potted monstera plant with big round leaves in a round ceramic pot`

#### F11 · 스탠드 조명 — `furn_lamp`
- 쓰는 곳: 방 바닥 · 크기 0.55 × 1.65 × 0.55 · 면 수 상한 5,000
- 프롬프트: `a tall floor lamp with a bell-shaped fabric lampshade, a slim pole and a round base`
- 비워 둘 곳: 갓은 밝은 크림색 (밤에 빛나게 한다)

#### F12 · 창문 — `furn_window`
- 쓰는 곳: **벽**, 가로 2칸 (누르면 창밖 풍경) · 크기 2.1 × 1.4 × 0.25 · 면 수 상한 8,000
- 프롬프트: `a wall-mounted wooden window frame with a cross-shaped divider, curtains tied open on both sides, a small flower box under the window, flat back side`
- 비워 둘 곳: **유리 자리는 뚫려 있거나 단색 하늘색** (게임이 창밖 풍경을 넣는다)
- 꼭 있어야 할 것: 벽에 붙는 납작한 뒷면

#### F13 · 사진 액자 — `furn_frame`
- 쓰는 곳: **벽** (누르면 내 사진) · 크기 0.6 × 0.8 × 0.06 · 면 수 상한 3,000
- 프롬프트: `a simple wooden picture frame hanging on a wall, portrait orientation, the picture area is completely plain white and blank, flat back side`
- 비워 둘 곳: **사진 자리 전체가 흰 빈칸** (게임이 사진을 넣는다)

#### F14 · 시계 — `furn_clock`
- 쓰는 곳: **벽** · 크기 0.5 × 0.5 × 0.1 · 면 수 상한 3,000
- 프롬프트: `a round wall clock with a thick wooden rim, simple dot hour marks without numbers, two clock hands, flat back side`
- 꼭 있어야 할 것: 숫자 없는 시계판 (점 표시)

#### F15 · 벽 선반 — `furn_shelf`
- 쓰는 곳: **벽** · 크기 0.85 × 0.4 × 0.25 · 면 수 상한 5,000
- 프롬프트: `a small wall-mounted wooden shelf with two tiny potted plants and a lit candle on it, flat back side`
- 비워 둘 곳: 촛불은 밝은 노란색 (밤에 빛나게 한다)

### 2순위 — 마을 (21개)

마을은 위에서 비스듬히 내려다보므로 지붕·윗면 모양이 잘 보여야 한다.

#### V01 · 주민의 집 — `prop_town_house`
- 쓰는 곳: 마을 집터 (주민마다 하나, 동물 주민 집도 같은 모델) · 크기 2.85 × 2.8 × 3.0 · 면 수 상한 15,000
- 프롬프트: `a cute small cottage house with round cream walls on a low stone foundation, a big overhanging roof, an arched front door with a small awning, a window with a flower box, a chimney, a wall lantern beside the door, stepping stones in front of the door`
- 비워 둘 곳: **지붕과 문 위 차양은 흰색** (마을 색을 입힌다)
- 꼭 있어야 할 것: 정면 가운데의 문

#### V02 · 빈 집터 — `prop_town_lot`
- 쓰는 곳: 아직 아무도 살지 않는 집터 · 크기 2.4 × 0.8 × 2.2 (낮게) · 면 수 상한 5,000
- 프롬프트: `an empty small garden plot of soft dirt with four short wooden corner stakes, a tiny blank wooden signpost at the front, a few small grass tufts`
- 꼭 있어야 할 것: 낮고 평평할 것 (집을 짓기 전 땅) · 받침(흙 바닥) 포함

#### V03 · 분수 — `prop_plaza_fountain`
- 쓰는 곳: 중앙광장 한가운데 · 크기 3.0 × 1.7 × 3.0 · 면 수 상한 12,000
- 프롬프트: `a round stone plaza fountain with a wide lower basin, a smaller upper bowl and a small spout on top, clear light blue water in the basins`

#### V04 · 벤치 — `prop_plaza_bench`
- 쓰는 곳: 중앙광장 · 크기 1.7 × 0.8 × 0.45 · 면 수 상한 4,000
- 프롬프트: `a wooden park bench with a slatted seat and backrest and curved dark iron armrests and legs`

#### V05 · 게시판 — `prop_plaza_board`
- 쓰는 곳: 중앙광장 (오늘의 토론 게시판) · 크기 2.2 × 2.2 × 0.6 · 면 수 상한 6,000
- 프롬프트: `a wooden notice board on two posts with a small pitched roof on top, a few blank paper notes pinned to the board`
- 비워 둘 곳: 종이는 글자 없는 빈 종이

#### V06 · 깃발 — `prop_plaza_flag`
- 쓰는 곳: 중앙광장 · 크기 1.2 × 2.7 × 0.45 · 면 수 상한 3,000
- 프롬프트: `a tall slim flag pole with a waving pennant flag near the top`
- 비워 둘 곳: 깃발 천은 흰색, 무늬·글자 없음

#### V07 · 가로등 — `prop_plaza_lamp`
- 쓰는 곳: 광장·마을 길 · 크기 0.5 × 2.65 × 0.55 · 면 수 상한 4,000
- 프롬프트: `a classic slim street lamp post with a lantern head on top`
- 비워 둘 곳: 등은 밝은 크림색 (밤에 빛나게 한다)

#### V08 · 광장 전광판 — `prop_plaza_screen`
- 쓰는 곳: 중앙광장 북서쪽 (대항전 순위·오늘의 토론) · 크기 7.4 × 3.5 × 0.7 (아주 넓다) · 면 수 상한 8,000
- 프롬프트: `a large wide outdoor billboard screen frame standing on two thick posts, rounded frame corners, the screen area is completely plain black`
- 비워 둘 곳: **화면 전체가 검은 빈칸** (게임이 글·그림을 그린다)
- 다시 할 때 덧붙이기: `very wide panoramic screen, width four times the height,`

#### V09 · 운세 나무 — `prop_plaza_fortune_tree`
- 쓰는 곳: 중앙광장 (하루 한 번 운세 열매) · 크기 2.95 × 3.5 × 2.8 · 면 수 상한 15,000
- 프롬프트: `a magical round pink blossom tree with glowing golden fruits and small red ribbons tied on the branches, growing in a round stone planter`
- 꼭 있어야 할 것: 분홍 꽃 수관, 황금 열매 · 받침(돌 화단) 포함

#### V10 · 낚시터 비콘 — `prop_plaza_beacon_fishing`
- 쓰는 곳: 광장 가장자리 (누르면 낚시터로) · 크기 1.75 × 1.85 × 1.3 · 면 수 상한 6,000
- 프롬프트: `a glowing light blue crystal pillar on a round stone base, with a round sign plate on the front showing a simple fish silhouette`
- 꼭 있어야 할 것: 하늘색 수정 · 받침(돌) 포함 · 글자 없이 물고기 모양만

#### V11 · 클럽 비콘 — `prop_plaza_beacon_club`
- 쓰는 곳: 광장 가장자리 (누르면 클럽으로) · 크기 1.75 × 1.85 × 1.3 · 면 수 상한 6,000
- 프롬프트: `a glowing violet crystal pillar on a round stone base, with a round sign plate on the front showing a simple music note silhouette`
- 꼭 있어야 할 것: 보라색 수정 · 받침 포함 · 음표 모양만

#### V12 · 상가 비콘 — `prop_plaza_beacon_market`
- 쓰는 곳: 광장 가장자리 (누르면 상가로) · 크기 1.75 × 1.85 × 1.3 · 면 수 상한 6,000
- 프롬프트: `a glowing warm orange crystal pillar on a round stone base, with a round sign plate on the front showing a simple shopping bag silhouette`
- 꼭 있어야 할 것: 주황색 수정 · 받침 포함 · 쇼핑백 모양만

#### V13 ~ V16 · 열매 나무 4종
- 쓰는 곳: 마을 입구 (열매 따기). 기질 그룹마다 열매가 다르다 · 크기 2.3 × 2.6 × 2.3 · 면 수 상한 12,000 (각각)
- 꼭 있어야 할 것: 둥근 수관에 열매가 잘 보일 것, 짧고 굵은 줄기

| 번호 | 파일 이름 | 마을 | 프롬프트 |
|---|---|---|---|
| V13 | `prop_fruit_nt` | 분석가(NT) 은빛 언덕 — 배 | `a round fruit tree with a short thick trunk and a full round canopy covered with ripe yellow pears` |
| V14 | `prop_fruit_nf` | 외교관(NF) 초록 숲 — 사과 | `a round fruit tree with a short thick trunk and a full round canopy covered with ripe green apples` |
| V15 | `prop_fruit_sj` | 관리자(SJ) 푸른 호숫가 — 포도 | `a round fruit tree with a short thick trunk and a full round canopy hung with bunches of purple grapes` |
| V16 | `prop_fruit_sp` | 탐험가(SP) 노을 거리 — 복숭아 | `a round fruit tree with a short thick trunk and a full round canopy covered with ripe pink peaches` |

#### V17 · 동네 길 아치 — `prop_hood_gate`
- 쓰는 곳: 큰길 끝 (2동·3동으로 가는 길) · 크기 3.4 × 2.8 × 0.6 · 면 수 상한 6,000
- 프롬프트: `a wooden archway gate with two thick posts and a gently curved top beam, a blank wooden signboard hanging in the middle of the beam`
- 비워 둘 곳: **현판은 흰색 빈칸** (마을 색을 입힌다) · 꼭: 두 기둥 사이로 지나갈 수 있게 가운데가 뚫려 있을 것

#### V18 · 온실 (외교관 NF 명소) — `prop_district_greenhouse`
- 크기 3.2 × 2.4 × 2.4 · 면 수 상한 10,000
- 프롬프트: `a small glass greenhouse with a white frame and a pitched glass roof, green plants and flowers inside`

#### V19 · 공연 무대 (탐험가 SP 명소) — `prop_district_stage`
- 크기 3.2 × 2.3 × 2.0 · 면 수 상한 10,000
- 프롬프트: `a small outdoor wooden performance stage with a curtain backdrop, string lights along the top and two small spotlights`
- 비워 둘 곳: 커튼은 흰색 (마을 색을 입힌다)

#### V20 · 금속 공방 (분석가 NT 명소) — `prop_district_workshop`
- 크기 3.1 × 2.9 × 2.3 · 면 수 상한 10,000
- 프롬프트: `a small metalworking workshop cottage with large windows, a brick chimney and a gear-shaped emblem above the door`

#### V21 · 나무 부두 (관리자 SJ 명소) — `prop_district_pier`
- 크기 2.3 × 1.0 × 2.5 · 면 수 상한 8,000
- 프롬프트: `a small wooden pier dock on short posts with a tiny rowing boat tied beside it and a lantern post at the end`

### 3순위 — 놀이터: 클럽·상가·낚시 (7개)

#### P01 · DJ 부스 — `prop_club_booth`
- 쓰는 곳: 클럽 (DJ 너굴이 서는 곳) · 크기 2.2 × 1.05 × 0.95 · 면 수 상한 6,000
- 프롬프트: `a DJ booth table with two turntables and a mixer on top, a glowing neon pink front panel`

#### P02 · 스피커 — `prop_club_speaker`
- 쓰는 곳: 클럽 · 크기 0.9 × 1.7 × 0.8 · 면 수 상한 4,000
- 프롬프트: `a tall dark loudspeaker cabinet with two round woofers on the front and neon cyan trim`

#### P03 · 바 — `prop_club_bar`
- 쓰는 곳: 클럽 (바텐더 곰돌의 카운터) · 크기 4.0 × 1.9 × 2.4 · 면 수 상한 12,000
- 프롬프트: `a nightclub bar counter with three round bar stools in front and a back shelf with softly glowing bottles`
- 꼭 있어야 할 것: 카운터 뒤에 사람이 설 자리 (카운터와 선반 사이가 비어 있을 것)

#### P04 · 클럽 소파 — `prop_club_sofa`
- 쓰는 곳: 클럽 · 크기 2.4 × 1.1 × 0.9 · 면 수 상한 6,000
- 프롬프트: `a long velvet lounge sofa in dark purple with rounded armrests`

#### P05 · 클럽 출입문 — `prop_club_door`
- 쓰는 곳: 클럽 남쪽 벽 · 크기 2.0 × 3.0 × 0.6 · 면 수 상한 5,000
- 프롬프트: `a dark double door set in a wall frame with metal handles and a blank glowing green sign panel above the door, flat back side`
- 비워 둘 곳: **표지판은 글자 없는 초록 빈칸** (게임이 글자를 쓴다)

#### P06 · 상가 점포 — `prop_market_stall`
- 쓰는 곳: 상가 (점포 20칸, 주인이 차양 색을 고른다) · 크기 2.65 × 2.9 × 1.45 · 면 수 상한 8,000
- 프롬프트: `a cute wooden market stall booth with a striped awning, a wooden counter in front and a blank signboard above the awning`
- 비워 둘 곳: **차양 줄무늬는 흰색과 연회색, 간판은 흰 빈칸** (주인 색과 점포 이름을 게임이 넣는다)

#### P07 · 낚싯대 — `prop_tool_rod`
- 쓰는 곳: 낚시할 때 캐릭터 오른손 · 크기 0.11 × 1.45 × 0.11 (가늘고 길다) · 면 수 상한 2,000
- 프롬프트: `a fishing rod standing straight up, cork handle at the bottom, a small reel, a thin tapered rod with a small tip ring`
- 다시 할 때 덧붙이기: `vertical, isolated, very thin long object,`

### 4순위 — 캐릭터 머리 소품 (4개)

캐릭터 머리에 붙인다. 크기는 캐릭터 머리 기준이라 아주 작다. 머리나 얼굴 없이 **소품만** 만든다.

#### A01 · 동그란 안경 — `char_acc_glasses`
- 크기 0.38 × 0.15 × 0.03 · 면 수 상한 2,000
- 프롬프트: `round eyeglasses with thin dark frames and clear lenses, front view, no head`

#### A02 · 꽃 핀 — `char_acc_flower`
- 크기 0.17 × 0.17 × 0.07 · 면 수 상한 2,000
- 프롬프트: `a small flower hair clip with five round pink petals and a yellow center, no head`

#### A03 · 모자 — `char_acc_cap`
- 크기 0.66 × 0.29 × 0.76 · 면 수 상한 3,000
- 프롬프트: `a baseball cap with a short curved brim, no head`
- 비워 둘 곳: **모자 몸통은 흰색** (캐릭터 옷 색을 입힌다)

#### A04 · 헤드폰 — `char_acc_headphones`
- 크기 0.77 × 0.46 × 0.17 · 면 수 상한 3,000
- 프롬프트: `over-ear headphones with a rounded headband, no head`
- 비워 둘 곳: **귀덮개는 흰색** (캐릭터 옷 색을 입힌다)

### 만들지 않는 것 (참고)

| 키 | 이유 |
|---|---|
| `furn.rug` 러그 | 납작한 판이라 3D보다 바닥 그림(텍스처)이 낫다. 원하면 나중에 그림으로 만든다 |
| `prop.club.wall` 클럽 벽 | 반복되는 평평한 벽 패널이라 코드로 그리는 편이 낫다 |
| `char.npc.monnyang`·`char.npc.dj`·`char.npc.bartender` | 사용자가 지금 모습 그대로 두기로 했다 (2026-11-05). 바꾸려면 뼈대(리깅)·동작이 필요하다 |
| `prop.plaza.tree`·`prop.district.shop` | 지금 게임에서 쓰지 않는 임시 모델 |

---

## 4. 다 만든 뒤 (사용자 → Claude Code)

1. 내려받은 GLB 파일들을 한 폴더에 모아 Claude Code 대화에 올린다 (진행 표와 함께).
2. Claude Code가 할 일:
   - `assets-src/models/`에 원본을 넣고, 변환 스크립트로 크기(표의 크기)·바닥 가운데 기준점·정면(+Z)·텍스처(WebP)·압축(meshopt)을 맞춘다.
   - 마을 색·옷 색 자리, 빛나는 자리, 그림 자리(창밖·사진·전광판·간판)를 표시하고, 바람에 흔들리는 잎을 표시한다.
   - manifest의 `_ph` 파일을 새 파일로 바꾸고, `LICENSES.md`에 출처(Tripo로 제작)를 적는다. 화면 용량 기준(첫 화면 3MB)을 확인한다.
3. **[결정 필요]** 쓰고 있는 Tripo 요금제가 상업적 이용을 허용하는지 확인한다 (캐릭터·동물 주민·강아지와 같은 질문).

---

## 5. 진행 표 (Claude in Chrome이 채운다)

상태: ✅ 완료 · ⚠️ 기준 미달(다시 필요) · ⏭️ 건너뜀 · (빈칸) 아직

| 번호 | 파일 이름 | 이름 | 상태 | Tripo 모델 주소 | 내려받은 파일 | 메모 |
|---|---|---|---|---|---|---|
| F01 | furn_turntable | 턴테이블 | | | | |
| F02 | furn_desk | 책상 | | | | |
| F03 | furn_mailbox | 우편함 | | | | |
| F04 | furn_wardrobe | 옷장 | | | | |
| F05 | furn_bookshelf | 책장 | | | | |
| F06 | furn_sofa | 소파 | | | | |
| F07 | furn_bed | 침대 | | | | |
| F08 | furn_chair | 의자 | | | | |
| F09 | furn_table | 탁자 | | | | |
| F10 | furn_plant | 화분 | | | | |
| F11 | furn_lamp | 스탠드 조명 | | | | |
| F12 | furn_window | 창문 | | | | |
| F13 | furn_frame | 사진 액자 | | | | |
| F14 | furn_clock | 시계 | | | | |
| F15 | furn_shelf | 벽 선반 | | | | |
| V01 | prop_town_house | 주민의 집 | | | | |
| V02 | prop_town_lot | 빈 집터 | | | | |
| V03 | prop_plaza_fountain | 분수 | | | | |
| V04 | prop_plaza_bench | 벤치 | | | | |
| V05 | prop_plaza_board | 게시판 | | | | |
| V06 | prop_plaza_flag | 깃발 | | | | |
| V07 | prop_plaza_lamp | 가로등 | | | | |
| V08 | prop_plaza_screen | 광장 전광판 | | | | |
| V09 | prop_plaza_fortune_tree | 운세 나무 | | | | |
| V10 | prop_plaza_beacon_fishing | 낚시터 비콘 | | | | |
| V11 | prop_plaza_beacon_club | 클럽 비콘 | | | | |
| V12 | prop_plaza_beacon_market | 상가 비콘 | | | | |
| V13 | prop_fruit_nt | 배나무 | | | | |
| V14 | prop_fruit_nf | 사과나무 | | | | |
| V15 | prop_fruit_sj | 포도나무 | | | | |
| V16 | prop_fruit_sp | 복숭아나무 | | | | |
| V17 | prop_hood_gate | 동네 길 아치 | | | | |
| V18 | prop_district_greenhouse | 온실 | | | | |
| V19 | prop_district_stage | 공연 무대 | | | | |
| V20 | prop_district_workshop | 금속 공방 | | | | |
| V21 | prop_district_pier | 나무 부두 | | | | |
| P01 | prop_club_booth | DJ 부스 | | | | |
| P02 | prop_club_speaker | 스피커 | | | | |
| P03 | prop_club_bar | 바 | | | | |
| P04 | prop_club_sofa | 클럽 소파 | | | | |
| P05 | prop_club_door | 클럽 출입문 | | | | |
| P06 | prop_market_stall | 상가 점포 | | | | |
| P07 | prop_tool_rod | 낚싯대 | | | | |
| A01 | char_acc_glasses | 동그란 안경 | | | | |
| A02 | char_acc_flower | 꽃 핀 | | | | |
| A03 | char_acc_cap | 모자 | | | | |
| A04 | char_acc_headphones | 헤드폰 | | | | |

모두 47개 (1순위 15 · 2순위 21 · 3순위 7 · 4순위 4).
