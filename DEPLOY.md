# CoolSpot — Ubuntu deployment checklist

Copy-paste runbook for a fresh **Ubuntu 22.04 / 24.04** box serving `https://coolspot.lv`.
Run as root (or prefix every command with `sudo`). The app runs on `127.0.0.1:3000`;
nginx terminates TLS on `:443` and redirects `:80` → `:443`.

Layout (data kept out of the code directory):

```
/srv/coolspot/app            ← git clone
/srv/coolspot/data/media     ← uploads (MEDIA_ROOT)
/srv/coolspot/backups        ← nightly dumps + media tarballs
```

---

## 0. Before you SSH in

- Push this repo to a remote the server can reach (private GitHub/GitLab). You'll use its
  `<REPO_URL>` below.
- Have ready:
  - Google OAuth **client id** + **client secret**
  - a DB password
  - `AUTH_SECRET` (generate with `openssl rand -base64 32`)
  - *(optional)* Geoapify key (location search), MapTiler key (map tiles)

---

## 1. Install packages

```bash
sudo apt update
sudo apt install -y curl git nginx postgresql postgresql-contrib postgis ffmpeg

# Node 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version        # v22.x
```

---

## 2. Service user + directories

```bash
sudo adduser --system --group --home /srv/coolspot coolspot
sudo mkdir -p /srv/coolspot/app /srv/coolspot/data/media /srv/coolspot/backups
sudo chown -R coolspot:coolspot /srv/coolspot
```

---

## 3. Database

```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE coolspot LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
CREATE DATABASE coolspot OWNER coolspot;
\c coolspot
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS citext;
SQL
```

All four extensions are required — `citext` is used for case-insensitive nicknames/emails.

---

## 4. Clone + environment

```bash
sudo -u coolspot git clone <REPO_URL> /srv/coolspot/app
cd /srv/coolspot/app
sudo -u coolspot npm ci
sudo -u coolspot cp .env.example .env
sudo -u coolspot nano .env
```

Set these in `.env` (the rest of the example is fine):

```bash
NODE_ENV=production                        # ← REQUIRED: makes the session cookie Secure
SITE_URL=https://coolspot.lv
DATABASE_URL=postgres://coolspot:CHANGE_ME_STRONG_PASSWORD@localhost:5432/coolspot
AUTH_SECRET=<openssl rand -base64 32>
GOOGLE_CLIENT_ID=…
GOOGLE_CLIENT_SECRET=…
GEOAPIFY_API_KEY=…                          # optional
NEXT_PUBLIC_MAPTILER_KEY=…                  # optional
MEDIA_ROOT=/srv/coolspot/data/media
PORT=8333                                   # nginx proxies coolspot.lv here (see step 7)
```

---

## 5. Migrate + build

```bash
cd /srv/coolspot/app
sudo -u coolspot npm run migrate          # applies drizzle/*.sql + seeds the 15 categories
sudo -u coolspot npm run build
```

Legacy import is optional and only if you have the old SQLite DB + `uploads/` tree:

```bash
sudo -u coolspot LEGACY_DIR=/path/to/legacy-repo npm run import:legacy
```

---

## 6. systemd service

Create `/etc/systemd/system/coolspot.service`:

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
journalctl -u coolspot -f                # live logs
```

---

## 7. nginx + HTTPS

Your nginx is already set up (Certbot-managed, `proxy_pass http://localhost:8333`,
`client_max_body_size 50M`). The only thing that has to match is the port — keep
`PORT=8333` in `.env` (step 4) so the app listens where nginx forwards.

Media (`/media/…`) goes through the app on purpose — it serves byte-range (206) for
videos and per-type cache headers. If you later let nginx serve `/media/` straight off
disk, keep videos **out** of `Cache-Control: immutable` (Safari stalls mid-playback).

If you ever need to reissue the cert:

```bash
sudo certbot --nginx -d coolspot.lv
sudo nginx -t && sudo systemctl reload nginx
```

---

## 8. Daily backups

Create `/srv/coolspot/backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +%Y-%m-%d_%H-%M-%S)
DEST=/srv/coolspot/backups
mkdir -p "$DEST"

sudo -u postgres pg_dump --format=custom coolspot > "$DEST/coolspot_$STAMP.dump"
tar -czf "$DEST/media_$STAMP.tar.gz" -C /srv/coolspot/data media

find "$DEST" -type f -mtime +30 -delete
echo "Backed up $DEST/coolspot_$STAMP.dump + media_$STAMP.tar.gz"
```

```bash
sudo chmod +x /srv/coolspot/backup.sh
sudo crontab -e
# run every night at 02:30
30 2 * * * /srv/coolspot/backup.sh >> /var/log/coolspot-backup.log 2>&1
```

**Copy backups off the machine** (a dump on the same disk is not a backup):

```bash
# from your own laptop
rsync -avz --delete you@server:/srv/coolspot/backups/ ~/coolspot-backups/
```

---

## 9. Verify

```bash
curl -sI https://coolspot.lv | head -5
cd /srv/coolspot/app && sudo -u coolspot npm run smoke -- https://coolspot.lv
```

Then add `https://coolspot.lv/sitemap.xml` in **Google Search Console** and submit it.
