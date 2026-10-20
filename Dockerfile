# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app
# Toolchain in case better-sqlite3 / argon2 need to compile instead of using prebuilt binaries.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
	&& rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
	DATA_DIR=/app/data \
	PORT=3000 \
	TZ=America/New_York
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/drizzle ./drizzle
VOLUME /app/data
EXPOSE 3000
HEALTHCHECK --interval=1m --timeout=5s \
	CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "build"]
