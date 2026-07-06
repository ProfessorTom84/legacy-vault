FROM node:20-bookworm-slim

# ffmpeg for video thumbnails, animated GIF previews and audio waveforms;
# python3/make/g++ so better-sqlite3 can compile if no prebuilt binary matches.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "src/server.js"]
