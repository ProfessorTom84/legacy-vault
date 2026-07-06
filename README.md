# Legacy Vault

A private, self-hosted content library for the things you want to leave behind — videos, voice notes, letters, and documents your family can browse and search like a personal Netflix.

- **Netflix-style browsing** — hero banner, category shelves, animated GIF hover previews on videos
- **Instant search** — SQLite FTS5 across titles, descriptions, letters, notes and tags
- **Record in the browser** — video and voice notes via your camera/microphone
- **Collections** — ordered walkthroughs ("Everything about the house") with next/previous navigation
- **Legacy items** — content hidden from viewers until the admin releases it
- **Roles** — admin / author / viewer, unlimited users
- **Private by design** — every media file is served through authenticated endpoints; nothing is publicly reachable
- **One container** — API, web app, media streaming and ffmpeg processing in a single image

## How it fits together

One container runs everything: Node/Express serves the compiled React app, the JSON API, and authenticated media streams (with HTTP range support, so video seeking works). ffmpeg inside the same image generates thumbnails, GIF hover previews and audio waveforms. Data lives outside the container in two mounts: `/data/db` (SQLite) and `/data/uploads` (all media).

## Publish on GitHub, deploy anywhere (recommended)

The repo ships with a GitHub Actions workflow (`.github/workflows/build-images.yml`) that builds the image and publishes it to GitHub Container Registry as `ghcr.io/yourname/legacy-vault` on every push to `main`.

1. Push this project to a GitHub repo (private is fine).
2. Wait for the **Actions** tab to go green (~3–5 min). A package named `legacy-vault` appears under your profile.
3. **If the repo is private**, the image is too. Either make just the package public (Package settings → Change visibility — your code stays private, and the image contains no secrets), or log your server into GHCR once with a personal access token that has `read:packages`:
   ```bash
   docker login ghcr.io -u yourname
   ```

## Unraid — Add Container (plain GUI, no plugins)

Because it's a single container, the standard **Docker → Add Container** form is all you need:

| Field | Value |
|---|---|
| Name | `legacy-vault` |
| Repository | `ghcr.io/yourname/legacy-vault:latest` |
| Network Type | `bridge` |
| Port | Container `4000` → Host `8080` (or any free port) |
| Path 1 | Container `/data/db` → Host `/mnt/user/appdata/legacy-vault/db` |
| Path 2 | Container `/data/uploads` → Host `/mnt/user/appdata/legacy-vault/uploads` |
| Path 3 | Container `/data/logs` → Host `/mnt/user/appdata/legacy-vault/logs` |
| Variable | `JWT_SECRET` = a long random string (`openssl rand -hex 48`) |
| Variable | `DATA_DIR` = `/data` |
| Variable | `BASE_URL` = the address you'll open it at, e.g. `http://192.168.1.10:8080` |

Optional variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (password-reset emails — without them, reset links print to the container log), and `MAX_UPLOAD_MB` (default 2048).

Click **Apply**, open `http://<unraid-ip>:8080`, and the first visit walks you through creating the **admin account** — the only account setup creates. Add your family afterwards in **Admin → Users**.

**Updating:** push your change to GitHub, wait for Actions, then in Unraid click the container → **Force Update** (or enable auto-updates via the Auto Update Applications plugin). Your database and media are in the appdata paths, untouched by updates.

## Docker Compose (any server, or Unraid Compose Manager)

Pull the published image:

```bash
git clone https://github.com/yourname/legacy-vault.git && cd legacy-vault
cp .env.example .env   # set JWT_SECRET, GITHUB_REPO, BASE_URL, SMTP
docker compose -f docker-compose.ghcr.yml up -d
```

Or build locally from source (no GitHub needed):

```bash
cp .env.example .env \
  && sed -i "s/change-me-to-a-long-random-string/$(openssl rand -hex 48)/" .env \
  && docker compose up -d --build
```

Update a compose deployment with:

```bash
docker compose -f docker-compose.ghcr.yml pull && docker compose -f docker-compose.ghcr.yml up -d
```

Compose uses named volumes by default. To keep data as plain files instead (easier backups), swap the volumes for bind mounts:

```yaml
    volumes:
      - /mnt/user/appdata/legacy-vault/db:/data/db
      - /mnt/user/appdata/legacy-vault/uploads:/data/uploads
```

## Remote access

This app is designed to stay off the public internet. Two good options:

### Tailscale (recommended — zero exposure)

1. Install Tailscale on the server (Unraid has a plugin) and on each family member's phone/laptop.
2. Sign everyone into the same tailnet (free invite sharing works for family).
3. Open `http://<tailscale-ip-or-magicdns-name>:8080` from any device on the tailnet.
4. Set `BASE_URL=http://<magicdns-name>:8080` so reset emails link correctly.

Optional: `tailscale serve` can front the app with HTTPS on your tailnet.

### Cloudflare Tunnel (public URL, no open ports)

1. In the Cloudflare Zero Trust dashboard, create a **Tunnel** and install `cloudflared`.
2. Add a public hostname, e.g. `vault.yourdomain.com`, pointing at `http://localhost:8080` on the server.
3. Strongly recommended: add a Cloudflare **Access** policy (email OTP allow-list of your family) in front of the hostname.
4. Set `BASE_URL=https://vault.yourdomain.com`.


## Logs & diagnostics

The app writes structured logs to two places at once: the container output (`docker logs legacy-vault`) and a persistent file at **`/data/logs/app.log`** inside the container. Mount that path to the host (see the table above / compose files) and the log **survives container removal and recreation** — so you can diagnose a problem even after replacing the container.

Useful commands:

```bash
docker logs --tail 100 legacy-vault          # recent activity
docker logs -f legacy-vault                  # follow live
grep ERROR /mnt/user/appdata/legacy-vault/logs/app.log       # persisted errors
```

What to look for:

- **Startup block** — version, whether JWT_SECRET/SMTP are set, and whether ffmpeg was found.
- **`received SIGTERM — shutting down cleanly`** — the container was *asked* to stop (docker stop, array shutdown, an update). Not a crash.
- **`uncaughtException — exiting`** with a stack — a real crash; the stack says where.
- **Hourly `heartbeat` lines** with uptime and memory — if the log simply *ends* at a heartbeat with no shutdown line, the process was killed from outside (out-of-memory kill or power loss).
- **`failed login attempt`** lines — someone typing wrong passwords, with IP.

Set `LOG_LEVEL=debug` to add per-request timing and ffmpeg job durations. Auth tokens are automatically redacted from all logged URLs.

## In-browser recording needs HTTPS

Browsers only allow camera/microphone access on **secure addresses** — `https://` or `localhost`. On a plain `http://192.168.x.x:8181` address, in-browser recording is disabled *by the browser*, on every device; the app detects this and offers the fallback: **"Record with your camera/voice app"**, which opens the phone's native recorder and uploads the result — that works everywhere, HTTPS or not.

To get full in-browser recording, serve the vault over HTTPS. The easiest path is Tailscale:

```bash
# on the server, with Tailscale installed and logged in:
tailscale serve --bg 8181
```

That gives you `https://tower.your-tailnet.ts.net` with a valid certificate, no ports opened. Update `BASE_URL` to that address. Cloudflare Tunnel (see above) also provides HTTPS automatically.

## Backups

Everything that matters is in the two data paths. With bind mounts, back up the appdata folder like any other. With named volumes:

```bash
docker run --rm -v legacy-vault_vault_db:/db -v legacy-vault_vault_media:/media \
  -v "$PWD":/backup alpine tar czf /backup/vault-backup.tar.gz /db /media
```

Automate it (cron / Unraid User Scripts) and copy it off-site. This is a legacy vault — treat backups as part of the promise.

## Development

```bash
# API (terminal 1) — needs Node 20+ and ffmpeg installed
cd backend && npm install
JWT_SECRET=dev-secret DATA_DIR=./data node src/server.js

# Web app with hot reload (terminal 2) — proxies /api to :4000
cd frontend && npm install && npm run dev
```

## Environment reference

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `JWT_SECRET` | ✅ | — | Signs login tokens. Long and random. |
| `BASE_URL` | for emails | `http://localhost:8080` | Used in password-reset links |
| `PORT` | | `8080` | Host port (compose deployments) |
| `GITHUB_REPO` | ghcr compose only | — | e.g. `yourname/legacy-vault` |
| `SMTP_*` | | — | Reset emails; without SMTP, links print to logs |
| `MAX_UPLOAD_MB` | | `2048` | Upload size limit |
| `DATA_DIR` | | `/data` | Where the DB and uploads live |
