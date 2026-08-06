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
| `setup-prod.sh` | Interactive first-time setup. Prompts, generates secrets, installs certificates, writes `.env`. |
| `compose.yml` | The stack. Pulls from GHCR; never builds. |
| `.env.example` | Template for the VM's `.env`. Reference — `setup-prod.sh` writes the real one. |
| `traefik/traefik.yml` | Static config. Changes need a Traefik restart. |
| `traefik/dynamic.yml` | Routing and TLS. Hot-reloaded. |

The signing certificate itself is documented separately in `certs/README.md` —
trust level, regeneration, and why Acrobat still shows an identity warning.

`docker/production/compose.yml` is upstream's and is deliberately untouched, so
it stays byte-identical across syncs. It pulls `documenso/documenso:latest` —
stock upstream, with none of the WAF fork in it. Do not deploy it.

## Deploying to a fresh VM

**Order of operations, since it is the usual question:** the deploy files come
first, the image comes last and arrives on its own. `setup-prod.sh` only reads
`compose.yml` to validate it — it never contacts the registry. The image is
pulled by `docker compose up -d` at the end.

```
  files ──▶ certificates ──▶ setup-prod.sh ──▶ up -d ──▶ (image pulled here)
```

### Have ready

- The WAF TLS certificate and key for the hostname, key **unencrypted**
- A published image tag — from the summary of the latest green **WAF Publish
  Image** run, or from
  `github.com/users/<owner>/packages/container/waf-esign/versions`
- DNS pointing at the VM (needed to verify, not to install)
- SMTP relay host, port, username, password

You do **not** need the signing `.p12`. The script offers to generate a
production one, which is the better option — see step 3.

### 0. Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo docker compose version    # must print v2.x
```

Nothing else. No Node, no npm, no build toolchain — the VM never builds.

### 1. Deploy files

```bash
sudo git clone --depth 1 --branch waf/main \
  https://github.com/Shoneel/documenso.git /opt/waf-esign/src
cd /opt/waf-esign/src/docker/waf
```

Shallow, and only `docker/waf/` is used. Cloning rather than copying means a
later `git pull` picks up changes to the compose or Traefik config. If the VM
has no outbound access to GitHub, `scp -r docker/waf/` from a workstation
instead — it is five files.

### 2. Stage the certificates

Anywhere readable by root; you give the script the paths and it installs them
properly.

```bash
sudo mkdir -p /root/incoming
sudo cp esign.waf.com.fj.crt esign.waf.com.fj.key /root/incoming/
```

If the CA issued a separate intermediate bundle, concatenate it **after** the
server certificate in the `.crt`.

### 3. Run the setup script

```bash
sudo ./setup-prod.sh
```

It asks only for what a human knows — hostname, GHCR owner, image tag, SMTP,
the two certificate paths — and does the rest: generates the session, encryption
and database secrets, installs the certificates with the right ownership and
modes, writes `.env` at mode 600, and validates before telling you anything
worked.

It refuses to continue on a TLS certificate that does not match its key, has
expired, or does not cover the hostname; and on a `.p12` whose passphrase does
not open it. Every check runs before the first file is written, so a rejected
run leaves the machine untouched. An existing `.env` is backed up with a
timestamp rather than overwritten.

Say **yes** when it offers to generate a production signing certificate. The
development key has lived on a workstation, and it is the thing that lets
someone produce PDFs that appear signed by WAF. Each signed PDF embeds its own
signer certificate, so separate development and production keys verify
identically and cost nothing.

### 4. Start

Accept the script's final prompt, or:

```bash
sudo docker compose up -d
sudo docker compose logs -f esign
```

**This is where the image is pulled** — automatically and anonymously, since the
package is public. First boot runs `prisma migrate deploy` against an empty
database before listening, so allow a minute or two.

> Optional, to fail fast: `sudo docker pull ghcr.io/<owner>/waf-esign:<tag>`
> after step 1. It proves the tag exists and the VM can reach GHCR, which is a
> far clearer error in isolation than discovering it during `up -d`.

### 5. Verify

```bash
sudo docker compose ps
curl -s https://esign.waf.com.fj/api/health
curl -s https://esign.waf.com.fj/api/certificate-status
```

Then the check that actually counts: send a document to yourself, sign it, open
the PDF, and confirm the signature panel reads **Signed by Water Authority of
Fiji**. `certificate-status` only reports that the file is readable — it does not
prove the key loads or that the subject is right.

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

## Troubleshooting

**HTTPS serves nothing, but `docker compose ps` says everything is healthy.**
Check ownership of the TLS files:

```bash
sudo ls -l /opt/waf-esign/tls/
```

Both must be `root root`. Traefik runs with `cap_drop: ALL`, which removes
`CAP_DAC_OVERRIDE` — the capability that lets root read a file regardless of
mode — so a mode-600 key owned by anyone else is unreadable. The failure is
quiet: Traefik starts, answers its healthcheck and reports healthy while serving
no certificate. Confirm with:

```bash
sudo docker compose logs traefik | grep -i "permission denied"
```

`setup-prod.sh` sets this correctly. It bites when certificates are replaced by
hand later.

**Documents sign but the signature panel says "Signed by Documenso".** The
container is using the bundled demo certificate, which means
`NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH` did not resolve. Confirm the mount and
the ownership — the file must be readable by uid 1001:

```bash
sudo ls -l /opt/waf-esign/cert.p12          # expect: -r-------- 1 1001 1001
sudo docker compose exec esign ls -l /opt/waf-esign/cert.p12
```

Note the signer is baked into each PDF at signing time, so documents already
signed keep the old certificate. Only new signatures change.

**Recipients never receive anything.** SMTP failures do not stop the app
starting. Check the logs for send errors, and remember `NEXT_PRIVATE_SMTP_SECURE`
must be `true` for port 465 and `false` for 587 with STARTTLS.

**`up -d` fails with "manifest unknown".** `IMAGE_TAG` names a tag that was never
published. List what exists at
`github.com/users/<owner>/packages/container/waf-esign/versions`.

**The app restarts in a loop on first boot.** Almost always the database URL.
`POSTGRES_PASSWORD` and the password embedded in `NEXT_PRIVATE_DATABASE_URL` are
set independently and nothing checks they agree — `setup-prod.sh` keeps them in
step, hand-editing does not.

## Known gaps

- **Health endpoints are public.** `/api/health` and `/api/certificate-status`
  are reachable from the internet. Restrict them at Traefik with an IP-allowlist
  middleware if that matters to you.
- **`apps/docs` is not deployed.** `docker/Dockerfile` prunes to
  `--scope=@documenso/remix`, so the documentation site — including its WAF
  theme — is not in this image. It needs its own build if you want it hosted.
- **Single instance.** `prisma migrate deploy` runs on container start, which
  would race across replicas. Fine as is; revisit before scaling out.
