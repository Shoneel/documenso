# WAF eSign — production deployment

Single VM. Traefik terminates TLS with WAF's own certificates and proxies to the
application container, which talks to Postgres on an internal network. The image
is built by GitHub Actions and pulled from GHCR; **nothing is built on the VM**.

```
        :443                    :3000                   :5432
  ┌──────────────┐        ┌──────────────┐       ┌──────────────┐
  │   traefik    │───────▶│    esign     │──────▶│   database   │
  │  WAF certs   │        │  GHCR image  │       │  postgres:15 │
  └──────────────┘        └──────────────┘       └──────────────┘
         ▲                        │                      │
   only published            cert.p12 (ro)          named volume
     host ports                                      + pg_dump
```

## Why this shape

**No Docker socket in Traefik.** Routing is declared in `traefik/dynamic.yml`
rather than discovered from container labels. Label discovery requires mounting
`/var/run/docker.sock`, which makes a Traefik compromise equivalent to root on
the host. With one fixed service, discovery buys nothing.

**One image, every environment.** `apps/remix/app/root.tsx` injects every
`NEXT_PUBLIC_*` variable into the page at request time via `window.__ENV__`,
rather than compiling it into the client bundle. So the same image runs in
staging and production, and changing the hostname does not need a rebuild.

**Pinned tags, never `latest`.** `IMAGE_TAG` holds a `sha-` tag. Rollback is a
one-line edit, not a rebuild.

## Files

| File | Purpose |
|---|---|
| `compose.yml` | The stack. Pulls from GHCR; never builds. |
| `.env.example` | Template for the VM's `.env`. |
| `traefik/traefik.yml` | Static config. Changes need a Traefik restart. |
| `traefik/dynamic.yml` | Routing and TLS. Hot-reloaded. |

`docker/production/compose.yml` is upstream's and is deliberately untouched, so
it stays byte-identical across syncs. It pulls `documenso/documenso:latest` —
stock upstream, with none of the WAF fork in it. Do not deploy it.

## First deploy — the short way

```bash
sudo ./setup-prod.sh
```

Prompts for the handful of things only you know — hostname, image tag, SMTP,
and where your certificates are — and does the rest: generates the session,
encryption and database secrets, installs the certificates with the right
ownership and modes, writes `.env` at mode 600, and validates the result before
anything starts.

It refuses to proceed on a TLS certificate that does not match its key, has
expired, or does not cover the hostname; and on a `.p12` whose passphrase does
not open it. Every check runs before the first file is written, so a failed run
changes nothing. An existing `.env` is backed up with a timestamp rather than
overwritten.

It also offers to generate a production-only signing certificate, which is worth
taking: the development key has lived on a workstation, and it is the thing that
lets someone produce PDFs that appear signed by WAF. Each signed PDF embeds its
own signer certificate, so having separate development and production keys costs
nothing.

The rest of this section is what the script does, for when you need to do it by
hand or understand what it changed.

## First deploy — by hand

The VM needs Docker with the Compose plugin. It does **not** need a git
checkout — copy this directory across and nothing else.

**1. Lay out the host paths**

```bash
sudo mkdir -p /opt/waf-esign/tls
sudo chmod 700 /opt/waf-esign
```

**2. Install the TLS certificate.** Filenames must match `traefik/dynamic.yml`:

```
/opt/waf-esign/tls/esign.waf.com.fj.crt     # server cert + intermediate chain
/opt/waf-esign/tls/esign.waf.com.fj.key     # private key, unencrypted
```

If your CA issued a separate intermediate bundle, concatenate it after the
server certificate in the `.crt`. Traefik serves the file as given; browsers
will not chase a missing intermediate.

Both files must be **root-owned**:

```bash
sudo chown root:root /opt/waf-esign/tls/esign.waf.com.fj.{crt,key}
sudo chmod 644 /opt/waf-esign/tls/esign.waf.com.fj.crt
sudo chmod 600 /opt/waf-esign/tls/esign.waf.com.fj.key
```

Traefik runs with `cap_drop: ALL`, which removes `CAP_DAC_OVERRIDE` — the
capability that lets root read files regardless of mode. A mode-600 key owned by
another user is unreadable, and the failure is quiet: Traefik starts, answers its
healthcheck, and serves no certificate. `setup-prod.sh` sets this for you.

**3. Install the signing certificate.** It is in neither the repository nor the
image — the `.p12` is gitignored, so a CI checkout never sees it. Copy it from
wherever you keep it and fix ownership:

```bash
sudo cp waf-signing.p12 /opt/waf-esign/cert.p12
sudo chown 1001:1001 /opt/waf-esign/cert.p12
sudo chmod 400 /opt/waf-esign/cert.p12
```

uid 1001 is the `nodejs` user the image runs as. **Get this wrong and the
container starts anyway** — `docker/start.sh` prints a warning and boots — so
signing fails later, at seal time, rather than at startup. Verify explicitly:

```bash
curl -s https://esign.waf.com.fj/api/certificate-status
```

**4. Configure**

```bash
cp .env.example .env && chmod 600 .env
$EDITOR .env
```

Set `IMAGE_TAG` to a published tag — the `sha-` value from the workflow run
summary. Generate the three secrets separately:

```bash
openssl rand -hex 32
```

Back up `NEXT_PRIVATE_ENCRYPTION_KEY` somewhere that is not this VM. Losing it
makes existing encrypted data unreadable.

**5. Registry access — nothing to do.**

The package is public, so the VM pulls anonymously. No `docker login`, no token
to provision, nothing to rotate.

The image lives at `ghcr.io/$GHCR_OWNER/waf-esign`, currently
`ghcr.io/shoneel/waf-esign`. GHCR packages belong to whoever owns the repository
that published them, so the namespace follows the repository rather than the
organisation.

If the package is ever made private, this step comes back: create a machine
account with `read:packages` and, on the VM,

```bash
echo "$GHCR_PAT" | docker login ghcr.io -u <machine-account> --password-stdin
```

Use a machine account rather than a personal token, which dies when someone
leaves.

> **The image is world-readable.** Anything baked in at build time is published
> with it. Runtime configuration is safe — the database URL, SMTP password,
> signing passphrase and the `.p12` all arrive from this `.env` and the bind
> mount, and `.env` is in `.dockerignore`. The rule to hold is: never pass a
> real secret as a Docker build arg. The only build args the final image carries
> are `NEXT_PRIVATE_TELEMETRY_KEY` and `NEXT_PRIVATE_TELEMETRY_HOST`, and the
> publish workflow passes neither.

**6. Up**

```bash
docker compose up -d
docker compose logs -f esign
```

Migrations apply themselves — `start.sh` runs `prisma migrate deploy` before the
server listens. First boot is slower for that reason; the healthcheck allows
120s.

## Deploying a change

Push to `waf/main`. CI lints, builds and builds the image; `waf-publish.yml`
pushes to GHCR and prints the tag in the run summary. Then, on the VM:

```bash
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=sha-1a2b3c4/' .env
docker compose pull && docker compose up -d
```

Only `esign` restarts. Traefik and Postgres are untouched.

## Rolling back

```bash
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=<previous-sha-tag>/' .env
docker compose up -d
```

Seconds, no rebuild. **Caveat:** this rolls back code, not the database.
`prisma migrate deploy` is forward-only, so if the release you are leaving added
a migration, rolling the image back does not undo it. Check for new files under
`packages/prisma/migrations` before assuming a rollback is clean.

## Certificate rotation

WAF's TLS certificate is not issued by ACME. **Nothing renews it and nothing
will warn you.** Put the expiry in a calendar.

Rotation is a file copy — the file provider watches for changes, so no restart:

```bash
sudo cp new.crt /opt/waf-esign/tls/esign.waf.com.fj.crt
sudo cp new.key /opt/waf-esign/tls/esign.waf.com.fj.key
```

The signing certificate is separate and expires in 2036 (see `certs/README.md`).

## Backups

Documents live in Postgres — `NEXT_PUBLIC_UPLOAD_TRANSPORT` defaults to
`database`, which keeps the stack to one service and one backup, at the cost of
a database that grows with document volume.

```bash
docker compose exec -T database \
  pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" \
  > "/opt/waf-esign/backups/esign-$(date +%F).dump"
```

Nightly via cron, shipped off the VM. A backup that only exists on the machine
it protects is not a backup.

Restore:

```bash
docker compose exec -T database \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists < backup.dump
```

Also back up, separately and not on this VM: `.env` (the encryption keys), the
signing `.p12` and its passphrase. Restoring the database without the encryption
key gets you nothing.

## Health

```bash
curl -s https://esign.waf.com.fj/api/health
curl -s https://esign.waf.com.fj/api/certificate-status
docker compose ps
```

`certificate-status` reports on the file, not on a real signature. It probes
readability; it does not verify that the key loads or that the subject is right.
The definitive check is sending a document through and opening the result.

## Known gaps

- **Health endpoints are public.** `/api/health` and `/api/certificate-status`
  are reachable from the internet. Restrict them at Traefik with an IP-allowlist
  middleware if that matters to you.
- **`apps/docs` is not deployed.** `docker/Dockerfile` prunes to
  `--scope=@documenso/remix`, so the documentation site — including its WAF
  theme — is not in this image. It needs its own build if you want it hosted.
- **Single instance.** `prisma migrate deploy` runs on container start, which
  would race across replicas. Fine as is; revisit before scaling out.
