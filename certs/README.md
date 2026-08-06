# WAF eSign signing certificate

The certificate that signs every completed PDF. Its subject is what a PDF reader
shows in the signature panel — this is why documents used to read
"Signed by Documenso".

## What is here

| File | Committed? | What it is |
|---|---|---|
| `waf-signing.crt` | **yes** | Public certificate. Safe to share; this is what people install to trust WAF-signed PDFs. |
| `waf-signing.p12` | no | Certificate **and private key**. Gitignored. |
| `waf-signing.key` | no | Private key on its own. Gitignored. Only needed to re-export the `.p12`. |
| `.passphrase` | no | Passphrase for the `.p12`. Gitignored. Mirrored into `.env`. |

Losing the private key is not a disaster — generate a new one and future
documents sign under it. Already-signed PDFs keep verifying against the
certificate embedded in them at signing time. Leaking it *is* a disaster:
anyone holding it can produce PDFs that appear to be signed by WAF.

## Wiring

`.env`, read by `packages/signing/transports/local.ts`:

```
NEXT_PRIVATE_SIGNING_TRANSPORT="local"
NEXT_PRIVATE_SIGNING_PASSPHRASE="…"
NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH="/absolute/path/to/certs/waf-signing.p12"
```

The path is absolute deliberately. Turbo runs each workspace from its own
directory, so a relative path resolves differently depending on which process
does the signing.

`NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS` (base64 of the `.p12`) is the
alternative and takes priority when set. Prefer it on hosts where secrets arrive
as environment variables and there is no durable filesystem.

## Trust level — read this before anyone asks

This certificate is **self-signed**. WAF issued it to itself, so no PDF reader
has any reason to believe it. Acrobat will show the yellow

> At least one signature has problems / the validity is unknown

banner. That is expected and does not mean the signature is broken. What the
signature genuinely proves is that the document has not been altered since
signing — any edit invalidates it. What it does *not* prove, to an outside
party, is that WAF signed it, because nothing independent vouches for the
identity.

For documents that stay inside WAF, or go to people who can be told to install
`waf-signing.crt` as a trusted publisher, this is adequate. The legal weight
sits in the audit trail and the signing certificate PDF, not in Acrobat's tick.

To remove the warning for external recipients you need a certificate from an
Adobe AATL member CA (GlobalSign, Sectigo, DigiCert, Certum) — roughly
USD 200–600/year, and since the 2023 CA/Browser Forum rules the private key must
live in an HSM. Free ACME CAs cannot help: Let's Encrypt and ZeroSSL issue TLS
server certificates, which carry the wrong key usage and are not part of the
document-signing trust programme. Documenso supports the paid path through the
`gcloud-hsm` transport and the CSC transport under `packages/ee/`.

## Regenerating

```bash
cd certs

openssl req -x509 -newkey rsa:4096 -sha256 -days 3650 -nodes \
  -keyout waf-signing.key -out waf-signing.crt \
  -subj "/C=FJ/ST=Central/L=Suva/O=Water Authority of Fiji/OU=WAF ICT/CN=Water Authority of Fiji" \
  -addext "basicConstraints=critical,CA:FALSE" \
  -addext "keyUsage=critical,digitalSignature,nonRepudiation" \
  -addext "extendedKeyUsage=1.3.6.1.5.5.7.3.36,emailProtection" \
  -addext "subjectKeyIdentifier=hash"

PASS=$(openssl rand -hex 24)
openssl pkcs12 -export -out waf-signing.p12 \
  -inkey waf-signing.key -in waf-signing.crt \
  -name "WAF eSign Document Signing" -passout "pass:$PASS"

chmod 600 waf-signing.p12 waf-signing.key
printf '%s\n' "$PASS" > .passphrase && chmod 600 .passphrase
echo "$PASS"   # copy into NEXT_PRIVATE_SIGNING_PASSPHRASE
```

`1.3.6.1.5.5.7.3.36` is the document-signing extended key usage from RFC 9336.
`emailProtection` is kept alongside it only because the Documenso demo
certificate carried that alone and some older validators still look for it.

Expiry is 10 years. A signature made before expiry stays valid afterwards *if*
it carries a trusted timestamp — see below.

If `P12Signer.create()` rejects the file, re-export with `-legacy`. OpenSSL 3
defaults to AES-256-CBC for PKCS#12, which some parsers cannot read. It was not
needed for `@libpdf/core` 0.4.1.

## Timestamping — still unconfigured

`NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY` is empty, so signatures currently
record no independent proof of *when* they were made, only the server's clock.
Setting it to a free public TSA (`http://timestamp.digicert.com`,
`http://tsa.certum.pl`) makes `packages/signing/index.ts` switch on long-term
validation and archival timestamps automatically. Costs nothing and is arguably
worth more to an audit trail than the name on the certificate.

## Deployment note

`loadP12()` only falls back to Documenso's demo certificate when
`NODE_ENV !== 'production'`. In production, with no certificate configured, it
throws `No certificate found for local signing` — so this is a hard prerequisite
for deployment, not a nicety.

Beware a mismatch in upstream: `packages/lib/server-only/cert/cert-status.ts`
probes `/opt/documenso/cert.p12` as the production default, but `loadP12()`
never reads that path. Place a certificate there and `/api/health` reports the
certificate as available while every signing attempt fails. Always set
`NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH` explicitly.
