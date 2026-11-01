#!/usr/bin/env bash
#
# WAF eSign — update a running production stack.
#
# Run by hand on the VM. Nothing connects in: the VM pulls the deploy files from
# git and the image from GHCR, so it never needs to accept SSH from CI.
#
#   sudo ./update.sh              pull waf/main and deploy the image built from it
#   sudo ./update.sh sha-1a2b3c4  deploy that exact tag, git untouched (rollback / pin)
#
# The image for a commit is tagged sha-<first 7 of the commit> by
# waf-publish.yml, so after `git pull` the tag to deploy is derived from HEAD
# rather than copied across by hand. The deploy files and the image therefore
# always come from the same commit.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

INSTALL_ROOT="${INSTALL_ROOT:-/opt/waf-esign}"
ENV_FILE="$SCRIPT_DIR/.env"
BACKUP_DIR="$INSTALL_ROOT/backups"
# compose.yml allows 120s start_period for migrations; leave headroom past it.
HEALTH_TIMEOUT=240

bold=$'\033[1m'; dim=$'\033[2m'; red=$'\033[31m'; green=$'\033[32m'; yellow=$'\033[33m'; reset=$'\033[0m'

step()  { printf '\n%s==> %s%s\n' "$bold" "$*" "$reset"; }
info()  { printf '    %s\n' "$*"; }
note()  { printf '    %s%s%s\n' "$dim" "$*" "$reset"; }
warn()  { printf '    %s!  %s%s\n' "$yellow" "$*" "$reset"; }
ok()    { printf '    %s✓  %s%s\n' "$green" "$*" "$reset"; }
die()   { printf '\n%sERROR: %s%s\n\n' "$red" "$*" "$reset" >&2; exit 1; }

confirm() {
  local __reply
  read -r -p "    $1 [y/N]: " __reply || true
  [[ ${__reply,,} == y || ${__reply,,} == yes ]]
}

env_value() { sed -n "s/^$1=//p" "$ENV_FILE" | tail -n1; }

# ── preflight ────────────────────────────────────────────────────────────────

step "Checking prerequisites"

[[ $EUID -eq 0 ]] || die "Run with sudo."
docker compose version >/dev/null 2>&1 || die "The Docker Compose plugin is not available."
[[ -f $ENV_FILE ]] || die "$ENV_FILE not found. Run setup-prod.sh first."

CURRENT_TAG=$(env_value IMAGE_TAG)
GHCR_OWNER=$(env_value GHCR_OWNER); GHCR_OWNER=${GHCR_OWNER:-shoneel}
[[ -n $CURRENT_TAG ]] || die "IMAGE_TAG is not set in $ENV_FILE."
info "Running: $CURRENT_TAG"

is_git=false
git -C "$SCRIPT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1 && is_git=true

# ── 1. work out the target ───────────────────────────────────────────────────

traefik_static_changed=false
migrations_changed=""

if [[ $# -ge 1 ]]; then
  TARGET_TAG=$1
  step "Deploying a pinned tag"
  note "git is left alone — the deploy files stay as they are."
else
  $is_git || die "Not a git checkout, so there is nothing to pull. Pass a tag: sudo ./update.sh sha-1a2b3c4"

  step "Pulling deploy files (waf/main)"

  # Hand edits to tracked files would make the pull fail half-way, or worse,
  # be silently kept. Configuration belongs in .env, which git ignores.
  if [[ -n $(git status --porcelain --untracked-files=no) ]]; then
    git status --short --untracked-files=no
    die "Tracked files were edited on this VM. Move the change into .env or commit it upstream, then: git checkout -- <file>"
  fi

  old_head=$(git rev-parse HEAD)
  git pull --ff-only --quiet || die "git pull failed. Check outbound access to GitHub."
  new_head=$(git rev-parse HEAD)

  if [[ $old_head == "$new_head" ]]; then
    ok "Already at ${new_head:0:7}"
  else
    ok "${old_head:0:7} → ${new_head:0:7}"
    git log --oneline --no-decorate "$old_head..$new_head" | sed 's/^/      /'
    git diff --quiet "$old_head" "$new_head" -- traefik/traefik.yml || traefik_static_changed=true
    migrations_changed=$(git diff --name-only --diff-filter=A "$old_head" "$new_head" -- \
      ../../packages/prisma/migrations | sed -n 's#.*/migrations/\([^/]*\)/.*#\1#p' | sort -u)
  fi

  TARGET_TAG="sha-${new_head:0:7}"
fi

IMAGE="ghcr.io/$GHCR_OWNER/waf-esign:$TARGET_TAG"
info "Target:  $TARGET_TAG"

if [[ -n $migrations_changed ]]; then
  warn "This release adds database migrations:"
  sed 's/^/        /' <<<"$migrations_changed"
  warn "They apply on start and are forward-only — rolling the image back"
  warn "afterwards does not undo them. The backup below is your way back."
fi

# ── 2. fetch the image before touching anything ──────────────────────────────

step "Pulling image"

# Fails here, with nothing changed, if CI has not finished publishing this
# commit yet — rather than half-way through `up -d`.
if ! docker pull --quiet "$IMAGE" >/dev/null; then
  die "Could not pull $IMAGE.
       If that commit was just pushed, the 'WAF Publish Image' run may still be
       going or may have failed — check it, then re-run. Nothing was changed."
fi
ok "$IMAGE"

if [[ $TARGET_TAG == "$CURRENT_TAG" ]] && ! $traefik_static_changed; then
  note "Image unchanged. Applying any compose.yml changes."
  docker compose up -d --remove-orphans
  ok "Up to date."
  exit 0
fi

# ── 3. back up the database ──────────────────────────────────────────────────

step "Backing up the database"

install -d -m 700 "$BACKUP_DIR"
dump="$BACKUP_DIR/esign-$(date +%Y%m%d-%H%M%S)-before-$TARGET_TAG.dump"
# Credentials come from the container's own environment, not this shell.
if docker compose exec -T database sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' >"$dump"; then
  chmod 600 "$dump"
  ok "$dump ($(du -h "$dump" | cut -f1))"
else
  rm -f "$dump"; dump=""
  warn "Backup failed."
  confirm "Deploy anyway, without a backup?" || die "Aborted; nothing was changed."
fi

# ── 4. switch ────────────────────────────────────────────────────────────────

step "Deploying $TARGET_TAG"

cp -a "$ENV_FILE" "$ENV_FILE.bak"
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$TARGET_TAG/" "$ENV_FILE"
ok "IMAGE_TAG: $CURRENT_TAG → $TARGET_TAG"

docker compose up -d --remove-orphans

# dynamic.yml is hot-reloaded; traefik.yml is static and only read at start.
if $traefik_static_changed; then
  docker compose restart traefik >/dev/null
  ok "Restarted traefik (traefik.yml changed)"
fi

# ── 5. wait for health ───────────────────────────────────────────────────────

step "Waiting for esign to report healthy"
note "Migrations run before the server listens, so this can take a minute or two."

cid=$(docker compose ps -q esign)
status=starting
for ((i = 0; i < HEALTH_TIMEOUT; i += 5)); do
  status=$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo missing)
  [[ $status == healthy || $status == unhealthy ]] && break
  sleep 5
done

if [[ $status != healthy ]]; then
  printf '\n'
  docker compose logs --tail 40 esign
  die "esign did not become healthy (status: $status). Logs above.
       Roll back:  sudo ./update.sh $CURRENT_TAG
       Database backup taken before this deploy: ${dump:-none}"
fi

ok "healthy"

step "Done"
info "Now running $TARGET_TAG (was $CURRENT_TAG)."
info "Roll back:  sudo ./update.sh $CURRENT_TAG"
[[ -n $migrations_changed ]] && warn "Rolling back after migrations needs the database restored too — see README."
note "Old backups in $BACKUP_DIR are not pruned; ship them off the VM and clear them."
exit 0
