# Legacy Vault

A private, self-hosted content library for the things you want to leave behind — videos, voice notes, letters, and documents your family can browse and search like a personal Netflix.

- **Netflix-style browsing** — hero banner, category shelves, animated GIF hover previews on videos
- **Instant search** — SQLite FTS5 across titles, descriptions, letters, notes and tags
- **Record in the browser** — video and voice notes via your camera/microphone
- **Collections** — ordered walkthroughs ("Everything about the house") with next/previous navigation
- **Legacy items** — content hidden from viewers until the admin releases it
- **Roles** — admin / author / viewer, unlimited users
- **Private by design** — every media file is served through authenticated endpoints; nothing is publicly reachable

## Publish on GitHub, deploy to Unraid (recommended workflow)

The repo ships with a GitHub Actions workflow (`.github/workflows/build-images.yml`) that builds both Docker images and publishes them to GitHub Container Registry on every push to `main`. Unraid then just pulls — no building on the server.

**One-time setup:**

1. Create a repo on GitHub (private is fine) and push this project:
   ```bash
   git init && git add . && git commit -m "Legacy Vault"
   git branch -M main
   git remote add origin git@github.com:yourname/legacy-vault.git
   git push -u origin main
   ```
2. Wait for the **Actions** tab to go green (~3–5 min). Two packages appear under your profile: `legacy-vault-backend` and `legacy-vault-frontend`.
3. **If the repo is private**, the images are too. Either make just the packages public (each package → Package settings → Change visibility — the code stays private), or log Unraid into GHCR once with a personal access token that has `read:packages`:
   ```bash
   docker login ghcr.io -u yourname
   ```
4. On Unraid, put the repo in appdata (clone it, or download the zip from GitHub):
   ```bash
   cd /mnt/user/appdata && git clone https://github.com/yourname/legacy-vault.git && cd legacy-vault
   cp .env.example .env   # set JWT_SECRET, GITHUB_REPO, BASE_URL, SMTP
   ```
5. In the Compose Manager plugin, point a stack at that folder and set the compose file to `docker-compose.ghcr.yml` — or from the terminal:
   ```bash
   docker compose -f docker-compose.ghcr.yml up -d
   ```

**Updating later:** push your change to GitHub, wait for Actions to finish, then on Unraid:

```bash
docker compose -f docker-compose.ghcr.yml pull && docker compose -f docker-compose.ghcr.yml up -d
```

Your data is untouched by updates — it lives in the `vault_db` and `vault_media` volumes, not in the images.

## Quick start (single command, builds locally)

```bash
git clone <your-repo-url> legacy-vault && cd legacy-vault \
  && cp .env.example .env \
  && sed -i "s/change-me-to-a-long-random-string/$(openssl rand -hex 48)/" .env \
  && docker compose up -d --build
```

Then open `http://<server-ip>:8080`. The first visit walks you through creating the **admin account** — that's the only account setup creates. Add your family afterwards in **Admin → Users**.

> Edit `.env` before (or after) starting to set `BASE_URL` and SMTP details — password-reset emails need them. Without SMTP, reset links are printed to the backend logs (`docker compose logs backend`) so you can pass them on manually.

## Unraid

1. Install the **Compose Manager** plugin from Community Applications.
2. Create a new stack, paste in this repo's `docker-compose.yml`, and add the `.env` values in the stack's env section (or place the whole repo in `/mnt/user/appdata/legacy-vault` and point the stack at it).
3. Set `PORT` to a free host port, then **Compose Up**.

Uploads and the database live in named Docker volumes (`vault_media`, `vault_db`). To keep them on the array instead, replace the named volumes in `docker-compose.yml` with bind mounts, e.g. `/mnt/user/appdata/legacy-vault/uploads:/data/uploads`.

## Remote access

This app is designed to stay off the public internet. Two good options:

### Tailscale (recommended — zero exposure)

1. Install Tailscale on the server (Unraid has a plugin) and on each family member's phone/laptop.
2. Sign everyone into the same tailnet (use free "invite" sharing for family).
3. Open `http://<tailscale-ip-or-magicdns-name>:8080` from any device on the tailnet.
4. Set `BASE_URL=http://<magicdns-name>:8080` in `.env` so reset emails link correctly.

Optional: `tailscale serve` can front the app with HTTPS on your tailnet.

### Cloudflare Tunnel (public URL, no open ports)

1. In the Cloudflare Zero Trust dashboard, create a **Tunnel** and install `cloudflared` (or add it as a service in the compose file).
2. Add a public hostname, e.g. `vault.yourdomain.com`, pointing at `http://nginx:80` (same Docker network) or `http://localhost:8080`.
3. Strongly recommended: add a Cloudflare **Access** policy (email OTP allow-list of your family) in front of the hostname.
4. Set `BASE_URL=https://vault.yourdomain.com` in `.env`.

## Backups

Everything that matters lives in two volumes:

```bash
docker run --rm -v legacy-vault_vault_db:/db -v legacy-vault_vault_media:/media \
  -v "$PWD":/backup alpine tar czf /backup/vault-backup.tar.gz /db /media
```

Automate that (cron / Unraid User Scripts) and copy it off-site. This is a legacy vault — treat backups as part of the promise.

## Architecture

| Service  | Role |
|----------|------|
| `nginx`    | Reverse proxy, single entry point on `PORT` |
| `frontend` | React 18 (Vite build) served by nginx |
| `backend`  | Node.js/Express API, SQLite + FTS5, FFmpeg for thumbnails/GIF previews/waveforms |

- **Auth:** JWT (30-day expiry), bcrypt-hashed passwords (8+ chars enforced client- and server-side). Media tags (`<img>`, `<video>`) can't send headers, so media URLs carry the JWT as `?token=`.
- **Media pipeline:** on upload, FFmpeg probes duration, extracts a poster frame, and builds a short animated GIF sampled from three points in the video; audio gets a waveform image. Generation runs in the background — thumbnails appear moments after upload.
- **Search:** FTS5 virtual table kept in sync with a delete-then-reinsert pattern (FTS5 tables don't support UPDATE), with prefix matching for search-as-you-type.

## Development

```bash
# backend
cd backend && npm install
DATA_DIR=./data JWT_SECRET=dev-secret node src/server.js

# frontend (separate terminal — Vite proxies /api to :4000)
cd frontend && npm install && npm run dev
```

## Environment variables

See `.env.example`. `JWT_SECRET` and `BASE_URL` are required; SMTP is optional but recommended; `MAX_UPLOAD_MB` defaults to 2048.
