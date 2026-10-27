# syntax=docker/dockerfile:1
# 단일 컨테이너: Node 서버(dist/server.mjs)가 화면(public/ 정적 파일)과 /ws 를 함께 맡는다.
# x86_64·arm64(라즈베리파이 64비트 OS 포함)에서 빌드·실행된다. node:24 이미지에는 32비트 ARM(armv7) 판이 없다.

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# 설치 스크립트는 돌리지 않는다. wrangler 가 딸려 오는 workerd 설치는 Node 서버 빌드에 필요 없다.
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY tsconfig.json ./
COPY src/ src/
COPY public/ public/
# Cloudflare 배포(.assetsignore)처럼 개발용 미리보기는 뺀다
RUN npm run build:client \
 && npm run build:node \
 && rm -rf public/_dev public/js/dev-sprites.js public/js/dev-sprites.js.map public/.assetsignore

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=8787 \
    DATA_DIR=/app/data
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
RUN mkdir -p /app/data && chown node:node /app/data
USER node
# 진행 상태(room.json). 컨테이너를 다시 만들어도 이어지게 볼륨에 둔다.
VOLUME ["/app/data"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8787) + '/').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "dist/server.mjs"]
