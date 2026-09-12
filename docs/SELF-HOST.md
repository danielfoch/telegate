# Run your own Telegate relay

Telegate Community is MIT-licensed and has no Telegate subscription requirement. You run the relay, control the database, and bring your own API key in the phone app. Hosting, Apple account options and OpenAI usage may have their own costs.

## Persistent HTTPS host

Use a Linux/Docker host with persistent disk and a hostname you control. The relay is a single-instance SQLite service. The included Caddy service manages HTTPS. A server on your home network must have a deliberate reachable HTTPS ingress; a local LAN address alone is insufficient for an out-of-office phone.

Install Git, Node 24+ (for the setup helper), Docker and Docker Compose, then:

```sh
git clone https://github.com/danielfoch/telegate.git
cd telegate
npm run doctor -- --server
npm run deploy:setup
docker compose up -d --build
```

Before starting Caddy, point the chosen hostname to this host and allow inbound TCP 80/443. The setup helper asks for the hostname and writes a private `.env` with the invitation, callback-signing and push-token encryption secrets. It will not overwrite an existing `.env`. No OpenAI key belongs on this server.

After launch:

- Open your HTTPS origin followed by `/health`; it should return `{"status":"ok","version":1}`. Test from a different network too.
- Read `TELEGATE_SIGNUP_CODE` from your server’s `.env` and use it for your own account creation in the app. Do not commit or publish this code.
- Run `npm run setup` on the Mac used to build the iPhone app and enter this HTTPS origin.
- Follow [DIY-IPHONE.md](DIY-IPHONE.md) to install the app and pair your execution computer.

The service stores credentials in derived/encrypted form where applicable, plus task briefs/results and project metadata. Protect its disk and backups. A public hostname does not make task contents public; account and device authentication still apply. The optional community leaderboard contains only opted-in aliases/counts on **your relay**, not a global Telegate network.

## Updates and backups

Keep the `.env` secrets and the Docker `relay-data` volume. Use SQLite's backup API for a live backup, or stop the relay before copying its database files; preserve WAL state. Do not copy only a changing main database file. Read release notes before upgrading and back up first:

```sh
git pull --ff-only
docker compose up -d --build
```

`docker compose down` preserves named volumes by default; do not add `-v` unless intentionally deleting your data. Existing app installations and companions continue using their configured hostname and credentials.

## Optional Grok Bot integration

The included [Grok Bot / Clydesdale adapter](integrations/GROKBOT.md) runs inside this relay and uses the same persistent database and HTTPS address. Configure a dedicated webhook routine and its private environment variables to enable it. No additional host or OpenAI key is needed.

## Optional full push support

The free DIY scheme uses in-app results. If you have the required Apple developer credentials, use the full Telegate scheme and the optional APNs secret mount described in [RELEASE.md](RELEASE.md). Push support remains in the open-source project; the planned paid offering is managed convenience, not a restriction on this code.

## Local development

```sh
npm start
```

This starts a loopback HTTP service on port 8790 for a same-Mac simulator/CLI test. **It does not deploy an internet-facing relay or configure a phone.** The Debug scheme defaults to this loopback URL; DIY expects the HTTPS address from setup.
