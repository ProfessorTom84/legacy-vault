# ---------- Stage 1: build the React frontend ----------
FROM node:20-bookworm-slim AS frontend
WORKDIR /build
COPY frontend/package.json ./
RUN npm install
COPY frontend/index.html frontend/vite.config.js ./
COPY frontend/src ./src
RUN npm run build

# ---------- Stage 2: runtime — API + static frontend + ffmpeg ----------
FROM node:20-bookworm-slim

# ffmpeg for video thumbnails, GIF hover previews and audio waveforms;
# python3/make/g++ so better-sqlite3 can compile if no prebuilt binary matches.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/package.json ./
RUN npm install --omit=dev

COPY backend/src ./src
COPY --from=frontend /build/dist ./public

ENV NODE_ENV=production
EXPOSE 4000

HEALTHCHECK --interval=60s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://localhost:4000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
