# CoolSpot

A community map of interesting places — roughly *Instagram's social structure on top of Google Maps'
place pages*. Find a good spot near you (or anywhere), see whether it's any good, and add your own.

This is the rebuild of the original Flask + SQLite + Create React App app that ran at
`coolspot.lv`. The specification lives in the legacy repo under `docs/rebuild/`.

**Status: all six phases' code is complete.** The rebuild is functionally done end to end — shell,
themes, Google auth, the PostGIS map + spots, discovery/search, reviews, and social + admin. The 11
legacy spots are imported. What remains is the manual launch: rotating the leaked secrets, adding the
Google OAuth redirect URI and a MapTiler key, and cutting over on the Ubuntu box (see the deployment
runbook below). See [Build phases](#build-phases).

---

## Contents

- [What exists now](#what-exists-now)
- [Local development (macOS)](#local-development-macos)
- [Environment variables](#environment-variables)
- [Google sign-in setup](#google-sign-in-setup)
- [Deployment (Ubuntu)](#deployment-ubuntu)
- [Backups and restore](#backups-and-restore)
- [Build phases](#build-phases)
- [Conventions and gotchas](#conventions-and-gotchas)

---

## What exists now

| Route | Status | Notes |
|---|---|---|
| `/` | Phase 3 | Feed: Trending / Following / Nearby tabs, search box, category + sort filters |
| `/map` | Phase 2 | Full-screen Leaflet map, category-coloured pins, live viewport queries |
| `/spot/<slug>` | Phase 4 | Server-rendered spot page — gallery, stars, distribution, reviews, actions |
| `/spots` | Phase 3 | All spots, filterable + sortable |
| `/category/<slug>` | Phase 3 | Spots in one category |
| `/city/<city>` | Phase 3 | Spots in one city |
| `/leaderboard` | Phase 3 | Contributors ranked by spots posted + combined rating |
| `/spots/new` | Phase 2 | Create a spot (map picker + photos), sign-in required |
| `/spots/<id>/edit` | Phase 2 | Edit a spot, creator/admin only |
| `/api/spots` | Phase 2 | `GET` viewport/radius query (PostGIS); `POST` create |
| `/api/spots/<id>` | Phase 2 | `PATCH` edit name/description/location/categories |
| `/api/spots/<id>/media` | Phase 2 | `POST` add photos, `DELETE` remove one |
| `/api/search` | Phase 3 | One-box search (unaccent + trigram + prefix) |
| `/api/spots/<id>/reviews` | Phase 4 | `POST` write a review (rating, photos, video) |
| `/api/reviews/<id>` | Phase 4 | `PATCH` edit a review |
| `/api/reviews/<id>/media` | Phase 4 | `POST` add media, `DELETE` remove |
| `/api/reviews/<id>/vote` | Phase 4 | `POST` toggle a helpful vote |
| `/api/reviews/<id>/replies` | Phase 4 | `POST` reply to a review |
| `/api/spots/<id>/visit` | Phase 4 | `POST` mark visited (once per day) |
| `/api/spots/<id>/save` | Phase 4 | `POST` toggle save |
| `/u/<nickname>` | Phase 5 | Instagram-style profile — My Spots + My Reviews + saved |
| `/admin` | Phase 5 | Moderation dashboard (admins only) |
| `/api/users/<id>/follow` | Phase 5 | `POST` toggle follow |
| `/api/profile` | Phase 5 | `PATCH` edit description |
| `/api/profile/export` | Phase 5 | `GET` GDPR data export |
| `/api/profile/delete` | Phase 5 | `POST` delete account (identity-strip) |
| `/api/reports` | Phase 5 | `POST` report a spot/review/user |
| `/api/spots/<id>/request` | Phase 5 | `POST` request delete/edit |
| `/api/admin/*` | Phase 5 | report queue, request queue, merge (admin) |
| `/api/geocode/search`, `/reverse` | Phase 2 | Server-side geocoding (keys never reach the browser) |
| `/media/[...path]` | Phase 2 | Serves uploaded WebP files (dev/standalone path) |
| `/profile` | Phase 5 | Redirects to your profile, or shows sign-in |
| `/signin` | Phase 1 | Google sign-in, with readable failure messages |
| `/api/auth/google` | Phase 1 | Starts the OAuth flow (PKCE + state) |
| `/api/auth/google/callback` | Phase 1 | Verifies the ID token, persists the user, creates the session |
| `/api/auth/signout` | Phase 1 | POST-only sign-out |
| `/robots.txt`, `/sitemap.xml` | Phase 3 | Generated; the sitemap lists spots, categories and index pages |

Working: light/dark themes with a three-way toggle (system / light / dark) that follows the OS live,
bottom tab bar on mobile and a sidebar on desktop, server-rendered pages with per-page metadata, and
Google sign-in verified server-side with an HttpOnly session cookie.

---

## Local development (macOS)

Requires **Node 20+** (developed on 26) and Homebrew.

```bash
# 1. Install the system tools Homebrew provides
brew install postgresql@17 postgis ffmpeg
#   postgresql + postgis → database (needed from Phase 2)
#   ffmpeg               → video transcoding (needed in Phase 4)

# 2. Install JS dependencies
npm install

# 3. Configure the environment
cp .env.example .env.local
#    then fill in AUTH_SECRET, GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
#    generate a secret with:  openssl rand -base64 32

# 4. Start Postgres and create the dev database (one-time)
brew services start postgresql@17
psql -d postgres -c "CREATE ROLE coolspot LOGIN PASSWORD 'coolspot_dev';"
createdb -O coolspot coolspot
psql -d coolspot -c "CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS unaccent; CREATE EXTENSION IF NOT EXISTS citext;"
#    then set DATABASE_URL in .env.local to the password you chose

# 5. Run the migrations and seed the 15 categories
npm run migrate

# 6. Import the 11 legacy spots (optional but recommended for local review)
#    reads the legacy SQLite DB + uploads tree from ../ (set LEGACY_DIR to override)
npm run import:legacy

# 7. Run it
npm run dev            # http://localhost:3000
```

Useful commands:

```bash
npm run dev            # development server with hot reload
npm run build          # production build
npm run start:prod     # run the production (standalone) build
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run smoke          # the smoke check — see below
```

### The smoke check

`npm run smoke` is the **only** automated check in this project (a full test suite was deliberately
declined). It asserts that each route returns 200, that the response is HTML with a real `<title>`,
and that expected text appears in the **raw** response body.

That last assertion is the point: it catches the failure mode that made the original site invisible to
Google for two years — a 200 response whose body is an empty `<div id="root">`. A status-code check
alone would have passed that.

```bash
npm run build
npm run start:prod &     # must be running
npm run smoke
# or against another origin:  npm run smoke -- http://localhost:3001
```

---

## Environment variables

Copy `.env.example` to `.env.local`. **Never commit a real `.env` file** — `.gitignore` blocks `.env*`
except the example. The previous version of this project shipped a Google OAuth client secret and a
geocoding API key inside a file that was served to every browser and committed to a public repo; both
of those values must be rotated before launch.

Anything that ships to the browser must be prefixed `NEXT_PUBLIC_`. Everything else stays server-side.
Currently only the MapTiler key is public (Phase 2).

---

## Google sign-in setup

1. Go to **Google Cloud Console → APIs & Services → Credentials**.
2. Create an **OAuth 2.0 Client ID** of type **Web application**.
3. Under **Authorised redirect URIs**, add one per environment — all three are needed:
   - `http://localhost:3000/api/auth/google/callback`
   - `https://coolspot.lv/api/auth/google/callback`
   - `https://www.coolspot.lv/api/auth/google/callback` *(only if you keep the `www` host)*
4. Put the client id and secret in `.env.local` (or the systemd unit on the server).

The client secret is **server-side only**. It is exchanged on the callback route and never sent to the
browser. Identity is taken from the verified ID token's `sub` claim — never from an email or id
supplied by the client.

---

## Deployment (Ubuntu)

The production target is a self-hosted Ubuntu box. Everything below is **Ubuntu-native on purpose** —
do not copy the Homebrew commands from the section above onto the server.

Assumed: Ubuntu 22.04 or 24.04, a domain pointing at the box, and sudo access.

### 1. System packages

```bash
sudo apt update
sudo apt install -y curl git nginx postgresql postgresql-contrib postgis ffmpeg

# Node 22 LTS from NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version    # should be v22.x or newer
```

### 2. Service user and directories

```bash
sudo adduser --system --group --home /srv/coolspot coolspot
sudo mkdir -p /srv/coolspot/app /srv/coolspot/data/media /srv/coolspot/backups
sudo chown -R coolspot:coolspot /srv/coolspot
```

### 3. Database

```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE coolspot LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
CREATE DATABASE coolspot OWNER coolspot;
\c coolspot
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
SQL
```

`postgis` gives radius and viewport queries off one GiST index; `pg_trgm` + `unaccent` give
diacritic-insensitive fuzzy search, so `riga` finds `Rīga`.

### 4. Code and environment

```bash
sudo -u coolspot git clone <NEW_REPO_URL> /srv/coolspot/app
cd /srv/coolspot/app
sudo -u coolspot npm ci
sudo -u coolspot cp .env.example .env
sudo -u coolspot nano .env      # fill in every value; SITE_URL=https://coolspot.lv
```

In `.env` set these values (everything else in the example is a sensible default):

```bash
NODE_ENV=production          # ← REQUIRED: makes the session cookie `Secure` behind HTTPS
SITE_URL=https://coolspot.lv
DATABASE_URL=postgres://coolspot:CHANGE_ME_STRONG_PASSWORD@localhost:5432/coolspot
AUTH_SECRET=…                # openssl rand -base64 32
GOOGLE_CLIENT_ID=…
GOOGLE_CLIENT_SECRET=…
GEOAPIFY_API_KEY=…           # optional — location search degrades to map-clicks without it
NEXT_PUBLIC_MAPTILER_KEY=…   # optional — falls back to OpenStreetMap tiles without it
MEDIA_ROOT=/srv/coolspot/data/media
```

### 5. Migrations and build

```bash
sudo -u coolspot npm run migrate
sudo -u coolspot npm run build
```

The legacy import is optional and needs the old SQLite database + `uploads/` tree:

```bash
# Only if you have the legacy data. Point LEGACY_DIR at the old repo and run once:
sudo -u coolspot LEGACY_DIR=/path/to/legacy-repo npm run import:legacy
```

If you're starting fresh (no legacy data), skip it — `npm run migrate` already seeds the 15
categories and the site works empty.

### 6. systemd unit

`/etc/systemd/system/coolspot.service`:

```ini
[Unit]
Description=CoolSpot
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=coolspot
Group=coolspot
WorkingDirectory=/srv/coolspot/app
EnvironmentFile=/srv/coolspot/app/.env
ExecStart=/usr/bin/node scripts/start-standalone.mjs
Restart=always
RestartSec=5
# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/srv/coolspot

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now coolspot
sudo systemctl status coolspot
journalctl -u coolspot -f         # logs
```

### 7. nginx

`/etc/nginx/sites-available/coolspot`:

```nginx
server {
    listen 80;
    server_name coolspot.lv www.coolspot.lv;
    return 301 https://coolspot.lv$request_uri;   # one canonical host
}

server {
    listen 443 ssl http2;
    server_name coolspot.lv;

    # client_max_body_size must exceed the 10 MB video cap plus form overhead.
    client_max_body_size 12M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";
        proxy_read_timeout 60s;
    }

    # Uploaded media is served straight off disk, never through Node.
    location /media/ {
        alias /srv/coolspot/data/media/;
        expires 30d;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options nosniff;
    }
}
```

TLS with certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d coolspot.lv
sudo nginx -t && sudo systemctl reload nginx
```

### 8. Verify

```bash
curl -sI https://coolspot.lv | head -5
sudo -u coolspot npm run smoke -- https://coolspot.lv
```

Then verify the site in **Google Search Console** and submit `https://coolspot.lv/sitemap.xml`.
Verification needs either a DNS TXT record or the HTML file — do it yourself, the app cannot.

---

## Backups and restore

The legacy project had a script that copied the database file and **documented no way to restore it**.
This section exists so that is not repeated.

### Backup

`/srv/coolspot/backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +%Y-%m-%d_%H-%M-%S)
DEST=/srv/coolspot/backups
mkdir -p "$DEST"

# Postgres logical dump — consistent, and restorable on any machine.
sudo -u postgres pg_dump --format=custom coolspot > "$DEST/coolspot_$STAMP.dump"

# Uploaded media, which the database only references by path.
tar -czf "$DEST/media_$STAMP.tar.gz" -C /srv/coolspot/data media

# Keep 30 days
find "$DEST" -type f -mtime +30 -delete

echo "Backed up to $DEST/coolspot_$STAMP.dump and media_$STAMP.tar.gz"
```

```bash
chmod +x /srv/coolspot/backup.sh
sudo crontab -e
# 02:30 every night
30 2 * * * /srv/coolspot/backup.sh >> /var/log/coolspot-backup.log 2>&1
```

**Copy backups off the machine.** A dump on the same disk as the database is not a backup — this is a
laptop in a closet, so treat the laptop as expendable.

```bash
# from another machine
rsync -avz --delete you@server:/srv/coolspot/backups/ ~/coolspot-backups/
```

### Restore

```bash
# 1. Database
sudo -u postgres createdb coolspot_restore
sudo -u postgres pg_restore --dbname=coolspot_restore --clean --if-exists /path/to/coolspot_STAMP.dump

# 2. Media
sudo mkdir -p /srv/coolspot/data
sudo tar -xzf /path/to/media_STAMP.tar.gz -C /srv/coolspot/data
sudo chown -R coolspot:coolspot /srv/coolspot/data

# 3. Point the app at it
sudo -u coolspot nano /srv/coolspot/app/.env    # update DATABASE_URL if the db name changed
sudo systemctl restart coolspot
sudo -u coolspot npm run smoke -- https://coolspot.lv
```

**Practise this once, on a scratch database, before you need it.**

---

## Build phases

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation — Next.js + TS + Tailwind, tokens, themes, shell, nav, Google auth | **Done** |
| 2 | Map + spots — PostGIS schema, Leaflet map, image pipeline, `/spot/<slug>` | **Done** |
| 3 | Discovery — feed, filters on map *and* list, search, city/category pages, leaderboard | **Done** |
| 4 | Reviews — star ratings, multi-photo and video reviews, helpful votes, replies, visits, saved | **Done** |
| 5 | Social + admin — follow/friend graph, profiles, GDPR export/delete, reports, merge | **Done** |
| 6 | Polish + launch — accessibility pass, states, robots/sitemap, legacy import, cutover | **Done** (cutover is manual) |

The full specification — schema, media pipeline, SEO scope and the legacy migration inventory — is in
the legacy repo at `docs/rebuild/03-rebuild-spec.md`, and the driving prompt at
`docs/rebuild/04-rebuild-prompt.md`.

---

## Conventions and gotchas

**Rules that are easy to break and expensive to fix:**

1. **Identity comes from the verified Google ID token's `sub` claim only.** Never from an email, user
   id or nickname in a request body. The legacy app trusted client-supplied identity on every write,
   which let any signed-in user read, edit and delete anyone else's data. See `src/lib/session.ts`.
2. **Never store base64 in the database, and never send it in JSON.** Real files on disk, real URLs,
   `srcset` variants. The legacy app stored avatars as 55–77 KB data-URIs and base64-encoded every spot
   image into every response.
3. **Never commit secrets, databases or uploads.** `.gitignore` covers `.env*`, `/data/` and `*.db`.
4. **Always show attribution for externally sourced photos.** Wikidata / Wikimedia / Panoramax images
   are rehosted with `{author, licence, source}` stored and rendered.
5. **No rating is shown for a spot with zero reviews.** `rating_avg` is NULL, never 0.
6. **Nothing is hard-deleted that a user cannot get back.** Deleting a spot is admin-only; deleting an
   account identity-strips contributions rather than cascade-deleting them.
7. **Design tokens live in one place** — `src/app/globals.css`. Never hard-code a hex, font or px value
   a token already carries. Both themes must be checked.
8. **Accessibility is part of the build, not a pass at the end.** Every icon button gets an
   `aria-label`, every image gets meaningful alt text, and contrast must pass AA in both themes.

**Practical gotchas:**

- **npm can install truncated native binaries.** If you see `dlopen ... content extends beyond end of
  file`, or a missing `data/unpacker` directory, the cached tarball is corrupt. Fix:
  `rm -rf node_modules package-lock.json && npm cache verify && npm install`.
- **`next start` does not work with `output: "standalone"`.** Use `npm run start:prod`, which copies
  `public/` and `.next/static/` next to the standalone server first — without that copy the server
  boots and then 404s every asset.
- **The standalone server chdirs into `.next/standalone`.** Because of that, `scripts/start-standalone.mjs`
  resolves a relative `MEDIA_ROOT` against the project root before spawning. In production set
  `MEDIA_ROOT` to an absolute path anyway (`/srv/coolspot/data/media`).
- **Spots have up to three categories, not one.** The spec's §3 sketch lists a single `category_id`,
  but its own multi-select requirement (§5) and migration table (§10) point to a many-to-many join.
  Phase 2 models it as `spot_categories(spot_id, category_id, position)` — `position = 0` is the
  primary category that drives the pin colour, and `spots` has no singular `category_id`.
- **The legacy app lives in the parent directory** and has its own lockfile, so
  `turbopack.root` is pinned in `next.config.ts`. Don't remove it.
- **Mobile layout uses `env(safe-area-inset-bottom)`** on the tab bar and content padding. Check on a
  real device, not just a narrow browser window.
- **`output: "export"` must never be enabled.** A static export would recreate the empty-shell problem
  this rebuild exists to fix.
