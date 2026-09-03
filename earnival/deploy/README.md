# Deploying Earnival on a VPS

Adapted from the Hoo Socials infrastructure repo, which is a working
Ansible + Nginx + Postgres setup, and reshaped for Next.js.

## Why a VPS rather than Vercel or Netlify

Both alternatives are serverless, and the risk register already names the
consequence: each function instance opens its own Postgres connection, Postgres
caps out around 100, and a ticket drop exhausts the pool at exactly peak load.
Avoiding that needs a pooler configured correctly, which is one more thing to get
wrong.

Earnival also needs a sweep every 15 minutes — release expired reservations, run
settlements, purge counters. On a VPS that is a cron line.

One box runs the app, the database and the cron. No pooler, no cold starts, no
per-invocation billing, and the database is a unix socket away.

**Sizing.** 2 vCPU / 4 GB is comfortable for the first hundred events. Hetzner
CX22, DigitalOcean 4 GB, or any Lagos-region VPS if latency to Nigerian buyers
matters more than to Paystack.

## One-time provisioning

```bash
cd earnival/deploy
cp inventory.example.ini inventory.ini      # put your server's IP in it
ansible-playbook -i inventory.ini ansible/provision.yml
```

That installs PostgreSQL 16, Nginx, Node 22, certbot and a `earnival` system
user; creates the database and a role with a generated password written to
`.env.db` on your machine; and sets up the firewall.

`.env.db` is the only copy of that password. Put it in a password manager.

## Deploying

```bash
./scripts/deploy.bash
```

Pulls the branch, installs, runs `prisma migrate deploy`, builds, and restarts
the systemd unit. Zero-downtime is not attempted — a restart is about two
seconds and the alternative is complexity you do not need yet.

## Domains and TLS

```bash
./scripts/setup-domain.bash earnival.app --ssl
```

Writes an Nginx vhost proxying to the app on 127.0.0.1:3000 and obtains a
Let's Encrypt certificate. Re-run with a different hostname for a demo
subdomain.

## The cron sweep

`provision.yml` installs it. Confirm it is running:

```bash
sudo -u earnival crontab -l
sudo journalctl -u earnival -n 50
```

If the sweep stops, inventory is never released and nobody is paid, so point an
uptime check at `/api/health` as described in `LAUNCH.md`.
