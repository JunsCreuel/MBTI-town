# MBTI 마을

MBTI 16개 유형이 팀이 되어 매일 토론 대항전을 벌이고, 그 전적이 마을에 쌓이는 웹 3D 공간.
개발 기준은 [PROJECT_GUIDE.md](PROJECT_GUIDE.md)를 따른다.

## 지금 되는 것

- 입장: MBTI 직접 고르기 또는 12문항 간단 설문
- 3D 광장: 여러 명 동시 접속, 탭(클릭) 이동과 방향키 이동, 길찾기
- 몸짓: 응원·박수 동작, 하트·궁금·놀람 이모티콘 (자유 채팅 없음)
- 채널: 방(채널)당 정원이 차면 다음 채널이 자동으로 열린다
- 임시 에셋: 코드로 만든 3D 캐릭터·소품 (`_ph`). 실제 GLB로 파일만 바꾸면 된다

토론 매치(논거, 추천, 투표, AI 채점, 결과 카드)는 다음 단계다.

## 실행

```bash
npm install
cp .env.example .env.local
npm run dev        # 웹 http://localhost:3000 + 실시간 서버 ws://localhost:2567
```

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 웹과 실시간 서버를 함께 띄운다 |
| `npm test` | 단위 테스트 + 실시간 서버 통합 테스트 |
| `npm run typecheck` | 웹·서버 타입 검사 |
| `npm run assets:ph` | 임시 에셋(GLB 등)을 다시 만든다 (`-- --map`이면 광장 맵도 새로 만든다) |
| `npm run assets:check` | 에셋 규칙·용량·남은 `_ph` 목록 검사 |
| `npm run build` | 에셋 검사 후 웹 빌드 |
| `npm run start:server` | 실시간 서버만 실행 (배포용) |

## 구조

```
src/app/                 Next.js 화면 (입장, 광장)
src/components/plaza/    3D 광장 (React Three Fiber)
src/shared/              웹과 서버가 함께 쓰는 규칙 (맵, 길찾기, 이동 검사, 메시지 규약, 캐릭터 규약)
src/config/game.ts       운영 중 바꿀 값 (방 정원, 전송 빈도, 점수 비율 등)
src/design/              디자인 토큰, MBTI 유형 정보
server/                  실시간 서버 (Colyseus)
scripts/                 임시 에셋 생성, 에셋 검사
public/assets/           에셋 (manifest.json 키로만 불러온다)
```
