#!/usr/bin/env bash
#
# WAF eSign — interactive production setup.
#
# Prompts for the values only a human can supply, generates every secret itself,
# installs the certificates with the right ownership, writes .env, and validates
# the result before you start anything.
#
# Safe to re-run: it refuses to overwrite an existing .env without taking a
# timestamped backup first.
#
#   sudo ./setup-prod.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

INSTALL_ROOT="${INSTALL_ROOT:-/opt/waf-esign}"
ENV_FILE="$SCRIPT_DIR/.env"

# The uid the application image runs as (`USER nodejs` in docker/Dockerfile).
# The signing certificate must be readable by it.
APP_UID=1001
APP_GID=1001

bold=$'\033[1m'; dim=$'\033[2m'; red=$'\033[31m'; green=$'\033[32m'; yellow=$'\033[33m'; reset=$'\033[0m'

step()  { printf '\n%s==> %s%s\n' "$bold" "$*" "$reset"; }
info()  { printf '    %s\n' "$*"; }
note()  { printf '    %s%s%s\n' "$dim" "$*" "$reset"; }
warn()  { printf '    %s!  %s%s\n' "$yellow" "$*" "$reset"; }
ok()    { printf '    %s✓  %s%s\n' "$green" "$*" "$reset"; }
die()   { printf '\n%sERROR: %s%s\n\n' "$red" "$*" "$reset" >&2; exit 1; }

# ── prompt helpers ───────────────────────────────────────────────────────────

# ask VAR "Question" ["default"]  — blank answer takes the default.
ask() {
  local __var=$1 __prompt=$2 __default=${3:-} __reply
  if [[ -n $__default ]]; then
    read -r -p "    $__prompt [$__default]: " __reply || true
    __reply=${__reply:-$__default}
  else
    read -r -p "    $__prompt: " __reply || true
  fi
  printf -v "$__var" '%s' "$__reply"
}

# ask_required VAR "Question" ["default"] — re-prompts until non-empty.
ask_required() {
  local __var=$1
  while :; do
    ask "$@"
    [[ -n ${!__var} ]] && break
    warn "Required."
  done
}

# ask_secret VAR "Question" — no echo, re-prompts until non-empty.
ask_secret() {
  local __var=$1 __prompt=$2 __reply
  while :; do
    read -r -s -p "    $__prompt: " __reply || true
    printf '\n'
    [[ -n $__reply ]] && break
    warn "Required."
  done
  printf -v "$__var" '%s' "$__reply"
}

confirm() {
  local __reply
  read -r -p "    $1 [y/N]: " __reply || true
  [[ ${__reply,,} == y || ${__reply,,} == yes ]]
}

secret() { openssl rand -hex 32; }

# Compose interpolates .env values, so a literal `$` is significant. Rather than
# silently rewriting a password, flag it — silently changing a credential is a
# worse failure than an explicit warning.
check_dollar() {
  [[ $2 == *'$'* ]] && warn "$1 contains a '\$'. Compose may interpolate it; verify after writing, or use a value without '\$'."
  return 0
}

# ── preflight ────────────────────────────────────────────────────────────────

step "Checking prerequisites"

[[ $EUID -eq 0 ]] || die "Run with sudo — this writes to $INSTALL_ROOT and sets file ownership."
command -v docker >/dev/null 2>&1 || die "Docker is not installed."
docker compose version >/dev/null 2>&1 || die "The Docker Compose plugin is not available."
command -v openssl >/dev/null 2>&1 || die "openssl is not installed."
[[ -f $SCRIPT_DIR/compose.yml ]] || die "compose.yml not found. Run this from docker/waf."

ok "docker $(docker --version | awk '{print $3}' | tr -d ,), compose plugin present, openssl present"

if [[ -f $ENV_FILE ]]; then
  warn "$ENV_FILE already exists."
  confirm "Back it up and start over?" || die "Aborted; nothing was changed."
  backup="$ENV_FILE.$(date +%Y%m%d-%H%M%S).bak"
  cp -a "$ENV_FILE" "$backup"; chmod 600 "$backup"
  ok "Backed up to $backup"
fi

# ── 1. application ───────────────────────────────────────────────────────────

step "Application"

ask_required HOSTNAME_FQDN "Public hostname" "esign.waf.com.fj"
ask_required GHCR_OWNER    "GHCR owner (the account owning the repo)" "shoneel"
info ""
note "The tag published by the 'WAF Publish Image' workflow — see its run summary."
ask_required IMAGE_TAG "Image tag to deploy" "waf-main"

if [[ $IMAGE_TAG == "waf-main" || $IMAGE_TAG == "latest" ]]; then
  warn "'$IMAGE_TAG' is a moving tag. Rollback stops being a one-line edit."
  confirm "Use it anyway?" || ask_required IMAGE_TAG "Image tag to deploy"
fi

# ── 2. mail ──────────────────────────────────────────────────────────────────

step "Mail"
note "Every signing request goes through this. If it is wrong the app still"
note "starts and recipients simply never hear from it."

ask_required SMTP_HOST "SMTP host"
ask_required SMTP_PORT "SMTP port" "587"
ask_required SMTP_USER "SMTP username"
ask_secret   SMTP_PASS "SMTP password"
ask_required SMTP_FROM "From address" "noreply@waf.com.fj"
ask_required SMTP_SECURE "Use implicit TLS (true for port 465, else false)" "false"
check_dollar "SMTP password" "$SMTP_PASS"

# ── 3. TLS ───────────────────────────────────────────────────────────────────

step "TLS certificate (Traefik)"
note "WAF's own certificate. Give the paths to copy from; they are installed to"
note "$INSTALL_ROOT/tls with the filenames traefik/dynamic.yml expects."

ask_required TLS_CRT_SRC "Path to the certificate (.crt/.pem, incl. intermediates)"
ask_required TLS_KEY_SRC "Path to the private key (unencrypted)"

[[ -f $TLS_CRT_SRC ]] || die "Not found: $TLS_CRT_SRC"
[[ -f $TLS_KEY_SRC ]] || die "Not found: $TLS_KEY_SRC"

openssl x509 -in "$TLS_CRT_SRC" -noout >/dev/null 2>&1 || die "$TLS_CRT_SRC is not a readable X.509 certificate."

# Compare public keys rather than RSA moduli, so EC keys work too.
crt_pub=$(openssl x509 -in "$TLS_CRT_SRC" -noout -pubkey 2>/dev/null | openssl dgst -sha256 | awk '{print $NF}')
key_pub=$(openssl pkey -in "$TLS_KEY_SRC" -pubout 2>/dev/null | openssl dgst -sha256 | awk '{print $NF}')
[[ -n $key_pub ]] || die "$TLS_KEY_SRC is not a readable private key (is it encrypted?)."
[[ $crt_pub == "$key_pub" ]] || die "The certificate and key do not match."
ok "Certificate and key match"

tls_subject=$(openssl x509 -in "$TLS_CRT_SRC" -noout -subject | sed 's/^subject=//')
tls_expiry=$(openssl x509 -in "$TLS_CRT_SRC" -noout -enddate | cut -d= -f2)
info "Subject: $tls_subject"
info "Expires: $tls_expiry"

if openssl x509 -in "$TLS_CRT_SRC" -noout -checkend 0 >/dev/null 2>&1; then
  openssl x509 -in "$TLS_CRT_SRC" -noout -checkend 2592000 >/dev/null 2>&1 \
    || warn "Expires within 30 days. Nothing renews this automatically."
else
  die "This certificate has already expired."
fi

tls_names=$( { openssl x509 -in "$TLS_CRT_SRC" -noout -ext subjectAltName 2>/dev/null | tr ',' '\n' | sed -n 's/.*DNS://p'
              openssl x509 -in "$TLS_CRT_SRC" -noout -subject | sed -n 's/.*CN *= *\([^,]*\).*/\1/p'; } | tr -d ' ' | sort -u)
if ! grep -qx -- "$HOSTNAME_FQDN" <<<"$tls_names" && ! grep -qx -- "\*.${HOSTNAME_FQDN#*.}" <<<"$tls_names"; then
  warn "'$HOSTNAME_FQDN' is not in this certificate: $(tr '\n' ' ' <<<"$tls_names")"
  confirm "Continue anyway?" || die "Aborted; nothing was changed."
else
  ok "Certificate covers $HOSTNAME_FQDN"
fi

# ── 4. signing certificate ───────────────────────────────────────────────────

step "Signing certificate"
note "This is what Acrobat shows as the signer. Generating a production-only"
note "certificate is recommended: a key that has lived on a workstation should"
note "not be the one signing WAF's documents."

GENERATE_P12=false
if confirm "Generate a new production signing certificate?"; then
  GENERATE_P12=true
  ask_required P12_SUBJ_O  "Organisation" "Water Authority of Fiji"
  ask_required P12_SUBJ_OU "Organisational unit" "WAF ICT"
  ask_required P12_SUBJ_CN "Common name (shown in Acrobat)" "Water Authority of Fiji"
else
  ask_required P12_SRC "Path to the existing .p12"
  [[ -f $P12_SRC ]] || die "Not found: $P12_SRC"
  ask_secret P12_PASS "Passphrase for that .p12"
  openssl pkcs12 -in "$P12_SRC" -nokeys -passin "pass:$P12_PASS" -noout 2>/dev/null \
    || die "That passphrase does not open $P12_SRC."
  ok "Passphrase verified"
  check_dollar "Signing passphrase" "$P12_PASS"
fi

# ── 5. options ───────────────────────────────────────────────────────────────

step "Options"

ask TSA "Timestamp authority (blank to disable)" "http://timestamp.digicert.com"
[[ -z $TSA ]] && warn "Without a TSA, signature times come from this server's clock alone."
ask SIGNING_CONTACT "Signing contact info embedded in PDFs (optional)" ""
ask DISABLE_SIGNUP  "Disable public signup" "true"
ask SIGNUP_DOMAINS  "Allowed signup domains, comma-separated" "waf.com.fj"

# ── 6. apply ─────────────────────────────────────────────────────────────────

step "Summary"
info "Hostname          https://$HOSTNAME_FQDN"
info "Image             ghcr.io/$GHCR_OWNER/waf-esign:$IMAGE_TAG"
info "Install root      $INSTALL_ROOT"
info "Mail              $SMTP_USER@$SMTP_HOST:$SMTP_PORT as $SMTP_FROM"
info "Signing cert      $([[ $GENERATE_P12 == true ]] && echo 'generate new' || echo "$P12_SRC")"
info "Timestamping      ${TSA:-disabled}"
info ""
info "Secrets for the session, database and encryption keys are generated here"
info "and written only to $ENV_FILE (mode 600)."
confirm "Proceed?" || die "Aborted; nothing was changed."

step "Installing"

install -d -m 700 "$INSTALL_ROOT"
install -d -m 700 "$INSTALL_ROOT/tls"
install -d -m 700 "$INSTALL_ROOT/backups"
ok "Created $INSTALL_ROOT"

# Ownership is explicit and load-bearing. Traefik runs as root inside its
# container but with `cap_drop: ALL`, which removes CAP_DAC_OVERRIDE — the
# capability that normally lets root ignore file permissions. A mode-600 key
# owned by anyone other than root is therefore unreadable, and Traefik fails
# with "permission denied" while still starting and answering /ping, so the
# symptom is a site that serves no TLS at all rather than a crash.
install -o root -g root -m 644 "$TLS_CRT_SRC" "$INSTALL_ROOT/tls/$HOSTNAME_FQDN.crt"
install -o root -g root -m 600 "$TLS_KEY_SRC" "$INSTALL_ROOT/tls/$HOSTNAME_FQDN.key"
ok "Installed TLS certificate and key (root-owned)"

P12_DEST="$INSTALL_ROOT/cert.p12"

if [[ $GENERATE_P12 == true ]]; then
  tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
  P12_PASS=$(openssl rand -hex 24)
  openssl req -x509 -newkey rsa:4096 -sha256 -days 3650 -nodes \
    -keyout "$tmp/k.pem" -out "$tmp/c.pem" \
    -subj "/C=FJ/ST=Central/L=Suva/O=$P12_SUBJ_O/OU=$P12_SUBJ_OU/CN=$P12_SUBJ_CN" \
    -addext "basicConstraints=critical,CA:FALSE" \
    -addext "keyUsage=critical,digitalSignature,nonRepudiation" \
    -addext "extendedKeyUsage=1.3.6.1.5.5.7.3.36,emailProtection" \
    -addext "subjectKeyIdentifier=hash" >/dev/null 2>&1
  openssl pkcs12 -export -out "$P12_DEST" -inkey "$tmp/k.pem" -in "$tmp/c.pem" \
    -name "WAF eSign Document Signing" -passout "pass:$P12_PASS" >/dev/null 2>&1
  install -m 644 "$tmp/c.pem" "$INSTALL_ROOT/waf-signing-public.crt"
  ok "Generated a signing certificate (10 years)"
  note "Public certificate: $INSTALL_ROOT/waf-signing-public.crt — this is what"
  note "staff install to trust WAF-signed PDFs."
else
  install -m 400 "$P12_SRC" "$P12_DEST"
fi

# Must be readable by the container's uid, or signing fails at seal time while
# the app starts up perfectly happily.
chown "$APP_UID:$APP_GID" "$P12_DEST"
chmod 400 "$P12_DEST"
ok "Installed signing certificate (owner $APP_UID, mode 400)"

POSTGRES_USER=waf_esign
POSTGRES_DB=waf_esign
POSTGRES_PASSWORD=$(openssl rand -hex 24)   # hex: no URL-encoding needed below

umask 077
cat >"$ENV_FILE" <<ENVFILE
# WAF eSign production environment.
# Generated by setup-prod.sh on $(date -Is). Contains secrets — mode 600, never commit.

GHCR_OWNER=$GHCR_OWNER
IMAGE_TAG=$IMAGE_TAG

WAF_TLS_DIR=$INSTALL_ROOT/tls
WAF_SIGNING_CERT_PATH=$P12_DEST

NEXT_PUBLIC_WEBAPP_URL=https://$HOSTNAME_FQDN

# Generated. Back these up somewhere that is not this VM: without the encryption
# key a database restore is unreadable.
NEXTAUTH_SECRET=$(secret)
NEXT_PRIVATE_ENCRYPTION_KEY=$(secret)
NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY=$(secret)

POSTGRES_USER=$POSTGRES_USER
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=$POSTGRES_DB
NEXT_PRIVATE_DATABASE_URL=postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@database:5432/$POSTGRES_DB

NEXT_PRIVATE_SMTP_TRANSPORT=smtp-auth
NEXT_PRIVATE_SMTP_HOST=$SMTP_HOST
NEXT_PRIVATE_SMTP_PORT=$SMTP_PORT
NEXT_PRIVATE_SMTP_USERNAME=$SMTP_USER
NEXT_PRIVATE_SMTP_PASSWORD=$SMTP_PASS
NEXT_PRIVATE_SMTP_SECURE=$SMTP_SECURE
NEXT_PRIVATE_SMTP_FROM_NAME=WAF eSign
NEXT_PRIVATE_SMTP_FROM_ADDRESS=$SMTP_FROM

NEXT_PRIVATE_SIGNING_TRANSPORT=local
NEXT_PRIVATE_SIGNING_PASSPHRASE=$P12_PASS
NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY=$TSA
NEXT_PUBLIC_SIGNING_CONTACT_INFO=$SIGNING_CONTACT

NEXT_PUBLIC_DISABLE_SIGNUP=$DISABLE_SIGNUP
NEXT_PRIVATE_ALLOWED_SIGNUP_DOMAINS=$SIGNUP_DOMAINS
NEXT_PUBLIC_DOCUMENT_SIZE_UPLOAD_LIMIT=
ENVFILE
chmod 600 "$ENV_FILE"
ok "Wrote $ENV_FILE"

# ── 7. validate ──────────────────────────────────────────────────────────────

step "Validating"

docker compose --env-file "$ENV_FILE" -f compose.yml config --quiet \
  && ok "compose.yml resolves" || die "compose.yml did not resolve."

resolved=$(docker compose --env-file "$ENV_FILE" -f compose.yml config 2>/dev/null | awk '/waf-esign:/ {print $2; exit}')
ok "Image: $resolved"

if [[ $GENERATE_P12 == true ]]; then
  openssl pkcs12 -in "$P12_DEST" -nokeys -passin "pass:$P12_PASS" -noout 2>/dev/null \
    && ok "Signing certificate opens with the generated passphrase" \
    || die "The generated .p12 does not open. This is a bug; do not deploy."
  info "Signer: $(openssl pkcs12 -in "$P12_DEST" -nokeys -passin "pass:$P12_PASS" 2>/dev/null | openssl x509 -noout -subject | sed 's/^subject=//')"
fi

step "Done"
info "Start it:"
info "    sudo docker compose up -d && sudo docker compose logs -f esign"
info ""
info "First boot runs database migrations before listening, so give it a minute."
info "Then verify:"
info "    curl -s https://$HOSTNAME_FQDN/api/health"
info "    curl -s https://$HOSTNAME_FQDN/api/certificate-status"
info ""
warn "certificate-status only checks the file is readable. The real test is"
warn "sending a document through and confirming Acrobat reads the WAF signer."
info ""
warn "Back up $ENV_FILE and $P12_DEST off this VM. Losing the encryption key"
warn "makes every database backup unreadable."

if confirm "Start the stack now?"; then
  docker compose up -d
  printf '\n'
  docker compose ps
fi
