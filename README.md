# 워크샵 비시바시

회사 워크샵에서 참가자 30명 안팎이 각자 폰으로 접속해 미니게임 라운드를 겨루는 실시간 파티 게임입니다.
진행자 화면은 프로젝터에 띄우고, 참가자는 로비의 QR 코드를 찍어 명단에서 자기 이름을 골라 들어옵니다.

- 폰이 컨트롤러가 됩니다. 빨강·초록·파랑 버튼과 FINISH 버튼으로 게임을 합니다.
- 라운드마다 등수로 점수를 줍니다. 참가자 n명 중 1등은 n점, 꼴등은 1점, 기록이 없으면 0점입니다. 탈락은 없습니다.
- 합계로 최종 순위를 냅니다. 합계가 같으면 1등 한 횟수로 가르고, 그래도 같으면 같은 등수입니다.
- 진행자는 순서표(최대 30라운드)를 짜 두고 라운드마다 게임 설명(자동 시연) → READY·3·2·1·GO → 결과 확정 순으로 진행합니다. 마지막에 시상대와 전체 순위를 발표합니다.

## 미니게임 11종

| 게임 | 하는 법 |
| --- | --- |
| 🎈 풍선 불기 | 빨강·파랑을 번갈아 눌러 풍선을 불어요. 다 차면 FINISH! 더 불면 펑 터져요. |
| 🍬 알사탕 담기 | 빨강 +1, 초록 +5, 파랑 +10. 병에 적힌 숫자만큼 담고 FINISH! 넘치면 쏟아져요. |
| 👁️ 시력검사 | 고리가 뚫린 쪽을 눌러요. ← 빨강 · ↑ 초록 · → 파랑 · ↓ FINISH. 틀리면 잠깐 멈춰요. |
| 👾 몬스터 퇴치 | 맨 앞 몬스터와 같은 버튼을 눌러요(▲ 빨강 · ■ 초록 · ● 파랑). 마지막 드래곤은 FINISH 연타! |
| ✌️ 가위바위보 판정 | 이긴 쪽을 눌러요. 왼쪽이 이기면 빨강 · 비기면 초록 · 오른쪽이 이기면 파랑. |
| 🎯 권총 속사 | 표적과 같은 버튼을 빨리 쏴요(▲ 빨강 · ■ 초록 · ● 파랑 · ★ FINISH). 점점 빨라져요! |
| 🪜 계단 오르기 | 평지는 빨강·파랑, 계단은 초록으로 한 칸씩 올라가요. 틀리면 넘어져서 잠깐 멈춰요. |
| 🥓 삼겹살 굽기 | 불판 왼쪽·가운데·오른쪽 고기를 빨강·초록·파랑으로 집어요. 느낌표(!)가 뜰 때 집어야 1개! |
| 🧠 순서 기억하기 | 칸이 차례로 반짝이면 그대로 따라 눌러요. 맞히면 하나씩 늘어나요. |
| 🥤 야바위 | 공이 든 컵을 눈으로 따라가요. 다 섞이면 그 자리 버튼! 왼쪽 빨강 · 가운데 초록 · 오른쪽 파랑. |
| ⛏️ 보물 캐기 | 깊이 팔수록 금이 많지만 폭탄을 만나면 가방이 날아가요. FINISH로 금고에! |

## 혼자 하는 도전 3종

라운드와 상관없이 혼자 하는 페이지입니다. 경로가 따로 있어서 폰을 한 사람씩 건네 가며 도전하면 됩니다.
도전 기록은 그 탭에만 쌓이고 새로고침하면 사라집니다. 순위는 매기지 않고, 몇 번이든 다시 할 수 있습니다.

| 경로 | 하는 법 | 기본 기준 |
| --- | --- | --- |
| `/reaction` | 🚦 반응속도 테스트. 신호등이 초록으로 바뀌는 순간 화면을 눌러요. 초록이 되기 전에 누르면 반칙. | 230ms 이하 |
| `/stopwatch` | ⏱️ 10초 맞추기. 눌러서 시작하면 초시계가 돌아가요. 숫자가 `10.00` 일 때 다시 눌러 멈춰요. | 10.00초에서 오차 0.1초 이내 |
| `/circle` | ⭕ 원 그리기. 가운데 점을 중심으로 손가락을 한 바퀴 돌려요. | 95% 이상 |

원 그리기 점수는 각을 180칸으로 나눠 칸마다 중심에서의 거리를 재고, 그 거리가 평균에서 벗어난 정도로 냅니다
(빨리 지난 쪽과 천천히 지난 쪽을 똑같이 보려는 것입니다). 한 바퀴를 못 돌거나, 너무 작게 그리거나, 가던 방향을 되돌리면 실패입니다.

### 성공 기준 그 자리에서 바꾸기

기본 기준은 셉니다. 너무 안 깨지면 진행자 화면 로비의 **도전 기준** 버튼에서 세 기준을 바꿉니다.
저장하면 열려 있는 폰 모두에 바로 닿고, 그 뒤에 끝나는 도전부터 새 기준으로 봅니다(기록판에 이미 쌓인 건 다시 판정하지 않습니다).

| 기준 | 고를 수 있는 범위 | 쉬워지는 쪽 |
| --- | --- | --- |
| 반응속도 | 150 ~ 1000ms | 올린다 |
| 10초 맞추기 오차 | 0.01 ~ 5초 | 올린다 |
| 원 그리기 | 50 ~ 100% | 내린다 |

기준은 명단·순서표처럼 서버가 들고 있어서 '처음부터 다시'를 눌러도, 서버를 다시 켜도 남습니다.
도전 페이지는 기준을 받으려고 서버에 붙습니다. 못 붙어도 마지막으로 받은 기준(한 번도 못 받았으면 기본 기준)으로 그냥 되고,
이때는 제목 아래에 '진행자 화면과 연결 안 됨'이 붙습니다.

## 구조

Cloudflare Workers 위에서 돕니다. 폰 화면(`/`)과 진행자 화면(`/host`), 혼자 하는 도전 세 쪽은 정적 파일로 내려주고, WebSocket(`/ws`)만 Worker가 받습니다.
게임 한 판의 상태는 Durable Object 하나가 들고 모든 연결에 중계합니다.
Docker로 띄울 때는 Node 서버 하나가 같은 일을 합니다([Docker로 실행](#docker로-실행)).

```
src/
  domain/      게임 규칙·점수·순위 (순수 함수), 혼자 하는 도전 판정(solo/)
  server/      Worker와 Durable Object(GameRoom), 저장된 상태 불러오기
  node/        Docker·Node용 서버 (Durable Object 대신 연결·저장·마감 알람)
  client/      폰·진행자 화면, 픽셀 엔진(pixel/), 게임별 장면(games/), 혼자 하는 도전 화면(solo/)
  protocol.ts  서버·클라이언트 메시지 해석
scripts/       리허설·가상 관객 도구
test/          vitest 테스트
```

## 로컬에서 실행

Node.js 22 이상이 필요합니다.

```bash
npm install
npm run dev
```

- 폰 화면: http://localhost:8787
- 진행자 화면: http://localhost:8787/host
- 혼자 하는 도전: http://localhost:8787/reaction · http://localhost:8787/stopwatch · http://localhost:8787/circle

내 컴퓨터(localhost, 127.x)나 사내망(10.x, 172.16~31.x, 192.168.x) 주소로 연 서버는 진행자 키 없이 진행자 화면이 열립니다.

같은 Wi-Fi의 폰으로 시험하려면 모든 네트워크 주소에서 받도록 띄웁니다.

```bash
npm run dev:lan
```

진행자 화면을 내 컴퓨터의 사내망 주소(예: `http://192.168.0.12:8787/host`)로 열면 로비의 QR 코드도 그 주소를 가리킵니다.

## 배포

```bash
npx wrangler login
npx wrangler secret put HOST_KEY
npm run deploy
```

배포한 주소(`https://workshop-bishibashi.<계정 서브도메인>.workers.dev`)의 진행자 화면은 진행자 키를 묻습니다.
`/host?key=...`로 열어도 되고, 이때 주소창의 키는 바로 지워집니다. 키는 그 탭에서만 기억합니다.

## Docker로 실행

Cloudflare 없이 Node 서버 하나로도 돕니다. 게임 로직(GameRoom)은 같고, Durable Object가 하던 연결 관리·저장·마감 알람을 `src/node`가 대신합니다.

```bash
docker compose up --build
```

- 폰 화면: http://localhost:8787
- 진행자 화면: http://localhost:8787/host
- 진행 상태는 `bishibashi-data` 볼륨의 `room.json`에 저장돼서 컨테이너를 다시 켜도 이어집니다.
- 진행자 키는 `HOST_KEY` 환경변수로 넣습니다(예: `HOST_KEY=... docker compose up --build`).
- 이미지는 `node:24-bookworm-slim` 위에서 만들고 x86_64·arm64(라즈베리파이 64비트 OS 포함)에서 돕니다. Node 24 이미지에는 32비트 ARM(armv7) 판이 없습니다.

내 컴퓨터·사내망 주소로 열면 진행자 키 없이 진행자 화면이 열립니다. 운영에서는 컨테이너 포트를 바깥에 열지 말고 리버스 프록시(traefik 등) 뒤에 두세요. 도메인으로 들어온 요청은 키가 맞아야 진행자로 붙습니다.

Docker 없이 Node로 바로 띄우려면 `npm run serve`를 씁니다(환경변수 `PORT`, `DATA_DIR`, `HOST_KEY`).

### 하위 경로에 올리기

화면·소켓 주소가 모두 상대 경로라 `https://example.com/bishibashi/`처럼 다른 서비스와 한 도메인을 나눠 쓸 수 있습니다.
프록시가 앞의 `/bishibashi`를 떼고 넘기면 됩니다. traefik이라면 이렇게 붙입니다.

```yaml
services:
  bishibashi:
    build: ./workshop-bishibashi
    restart: unless-stopped
    environment:
      HOST_KEY: ${BISHIBASHI_HOST_KEY}
    volumes:
      - bishibashi-data:/app/data
    networks:
      - proxy-net
    labels:
      - traefik.enable=true
      - traefik.http.routers.bishibashi.rule=Host(`example.com`) && PathPrefix(`/bishibashi`)
      - traefik.http.routers.bishibashi.entrypoints=web
      - traefik.http.routers.bishibashi.middlewares=bishibashi-slash,bishibashi-strip
      # 끝의 / 가 있어야 상대 경로가 맞으므로 /bishibashi 는 /bishibashi/ 로 보낸다
      - traefik.http.middlewares.bishibashi-slash.redirectregex.regex=^[^:]+://[^/]+/bishibashi$$
      - traefik.http.middlewares.bishibashi-slash.redirectregex.replacement=/bishibashi/
      - traefik.http.middlewares.bishibashi-strip.stripprefix.prefixes=/bishibashi
      - traefik.http.services.bishibashi.loadbalancer.server.port=8787

volumes:
  bishibashi-data:
```

서브도메인(`bishibashi.example.com`)에 올리면 `rule`만 `Host(...)`로 바꾸고 미들웨어 두 개는 빼면 됩니다.

## 리허설과 가상 관객

서버(`npm run dev`나 Docker)를 띄워 둔 상태에서 씁니다. 명단과 진행 상태를 덮어쓰기 때문에 localhost가 아니면 `--allow-remote`를 붙여야 실행됩니다.

```bash
npm run rehearsal
```

가상 참가자 30명이 순서표 6라운드를 돌며 재접속·늦은 입장·라운드 취소를 거쳐 최종 순위까지 확인합니다. `npm run rehearsal -- --rounds=3`으로 줄일 수 있습니다(늦은 입장은 3라운드 앞에서 확인합니다).

```bash
npm run crowd
```

가상 참가자 29명과 빈자리 '나'를 입장시킵니다. 진행자 화면에서 직접 진행하며 화면을 점검할 때 씁니다. '나'는 폰으로 입장하면 됩니다.

배포한 서버에 돌릴 때는 `HOST_KEY` 환경변수가 필요합니다.

## 테스트

```bash
npm test
npm run typecheck
```

`worker-configuration.d.ts`는 `npm run cf-typegen`으로 다시 만듭니다. 이때 `.dev.vars`에 `HOST_KEY=...` 한 줄이 있어야 `Env`에 `HOST_KEY`가 들어갑니다. `.dev.vars`는 저장소에 올리지 않습니다.

## 라이선스

[MIT](LICENSE). 픽셀 글꼴 [Galmuri](https://github.com/quiple/galmuri)는 SIL Open Font License 1.1을 따르며, 빌드할 때 `node_modules/galmuri`에서 `public/fonts`로 복사합니다.
