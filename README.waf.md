# WAF eSign — Fork Maintainer's Guide

WAF eSign is the Water Authority of Fiji's document signing platform, built as a fork of
[Documenso](https://github.com/documenso/documenso).

This document covers **how branding works in this fork and where to change it**. For everything else
(local setup, tech stack, self-hosting), see the upstream [`README.md`](./README.md), which is kept
byte-identical to upstream on purpose.

---

## The one rule

**Never customise by editing an upstream file in place when a fork-owned file or runtime config can
do the job.**

Every in-place edit to a file Documenso also maintains becomes a merge conflict, on every sync,
forever. Additive files never conflict. Runtime config never conflicts and can be changed without a
deploy.

This is not a style preference. The fork previously carried 161 lines of in-place edits to
`packages/ui/styles/theme.css` and a rewrite of `template-footer.tsx` that deleted upstream's
branding logic. Both have been moved out.

---

## Branch strategy

| Branch | Contains | Merge direction |
| --- | --- | --- |
| `main` | Pristine upstream. Never commit WAF work here. | Pull from `upstream/main` |
| `waf/main` | All WAF customisation. | Merge `main` **into** this branch |

Always **merge**, never rebase. Merging records each conflict resolution permanently; rebasing a
long-lived branch replays every conflict on every sync.

Sync often. Small frequent merges are cheap; large rare ones are how forks die.

```bash
git checkout main
git pull upstream main
git checkout waf/main
git merge main
```

---

## Where branding lives

Branding is deliberately split across three layers. Pick the lowest layer that can do the job.

### Layer 1 — Runtime config (no deploy, no conflict)

Documenso stores per-organisation branding in `OrganisationGlobalSettings`. Teams inherit from their
organisation unless they override it.

| Field | Purpose |
| --- | --- |
| `brandingEnabled` | Master switch. Gates the logo endpoint. |
| `brandingLogo` | Uploaded logo. **Not a path or URL** — a JSON file descriptor resolved through the storage backend. |
| `brandingUrl` | Link target for the email header logo. |
| `brandingCompanyDetails` | Multi-line block rendered in the email footer. |
| `brandingColors` | CSS custom properties. **Not used by this fork** — see [Why colours are not runtime config](#why-colours-are-not-runtime-config). |
| `brandingCss` | Raw CSS, auto-scoped. Sanitised on write. |

Change these in the UI: **Organisation Settings → Branding**.

To apply the WAF defaults to existing organisations:

```bash
npm run waf:branding               # apply
npm run waf:branding -- --dry-run  # preview, changes nothing
```

The script is idempotent and never clears an uploaded logo. It is **optional** — see
[Personal organisations](#personal-organisations-and-why-the-fallback-matters).

### Layer 2 — Fork constants (`packages/lib/constants/waf-brand.ts`)

Fallback identity used when an organisation has no explicit branding. One additive file, imported
wherever a brand string is needed.

```ts
WAF_BRAND.appName        // "WAF eSign"          — page titles, image alt text
WAF_BRAND.legalName      // "Water Authority of Fiji"
WAF_BRAND.companyDetails // email + sign-in footer block
WAF_BRAND.url            // header logo link; empty means "link to the app"
WAF_BRAND.logoPath       // "/static/logo.png"   — wordmark
WAF_BRAND.iconPath       // "/new-waf-favicon.png" — square mark, mobile headers
```

Import it rather than retyping a brand string:

```ts
import { WAF_BRAND } from '@documenso/lib/constants/waf-brand';
```

### Layer 3 — Theme overlay (`packages/ui/styles/waf-theme.css`)

The WAF palette for the whole application, light and dark. This is a **new file**, imported after
upstream's theme in `apps/remix/app/app.css`:

```css
@import "@documenso/ui/styles/theme.css";
@import "@documenso/ui/styles/waf-theme.css";   /* the only upstream edit */
```

It redeclares only the tokens that differ from upstream; everything else inherits.

---

## Changing something: where to go

| You want to change | Edit this | Requires deploy |
| --- | --- | --- |
| A colour, anywhere in the app | `packages/ui/styles/waf-theme.css` | Yes |
| Product name, wordmark, footer text | `packages/lib/constants/waf-brand.ts` | Yes |
| Logo shown in email, per organisation | Organisation Settings → Branding | No |
| Company details in email footer | Organisation Settings → Branding | No |
| Application / signer-header logo | `packages/lib/constants/waf-brand.ts` (`logoPath`, `iconPath`) | Yes |
| Favicons, app logo asset | `apps/remix/public/` | Yes |

---

## Do not touch

**`packages/ui/styles/theme.css`** — upstream's theme. Kept pristine so it never conflicts. Put your
override in `waf-theme.css` instead. If you edit this file you have re-created the problem this
architecture exists to solve.

**`packages/lib/constants/theme.ts`** — upstream mirrors `theme.css` here as hex strings for the
colour-picker UI, with no automated check linking the two. Because we no longer edit `theme.css`,
this file stays correct by construction. Editing either one reintroduces the drift upstream warns
about in that file's own header comment.

---

## Why `@layer base` matters in `waf-theme.css`

Keep the overrides inside `@layer base`, matching how `theme.css` declares the same tokens.

Tailwind flattens the directive at build time, so it carries no cascade weight of its own — it is
for consistency and Tailwind's base/components/utilities ordering. What actually makes the cascade
work is source order: `waf-theme.css` is imported second, so its declarations win at equal
specificity.

Per-recipient branding still overrides everything here, because custom properties resolve by
**inheritance**: `.documenso-branded` sits on `<body>` and is a nearer ancestor than `:root`, so its
values win for anything inside it regardless of source order.

---

## Why colours are not runtime config

`brandingColors` looks like the natural home for the WAF palette. It is not, for two reasons:

1. **It only reaches signing and embed routes.** It is injected as a `<style>` block scoped to a
   `.documenso-branded` wrapper, loaded by `loadRecipientBrandingByTeamId` — "the branding payload
   for a recipient-facing route". The authenticated application (dashboard, editor, settings, admin)
   never applies it.
2. **It has no light/dark variants.** It holds one palette. Applied to `<body>` on a signing route,
   it overrides the `.dark` theme on `<html>` and forces dark-mode signers into light colours.

`waf-theme.css` covers every surface in both themes, so setting `brandingColors` would regress dark
mode and gain nothing.

Two tokens also cannot round-trip through it even if you wanted them to: `--card-border-tint` is
consumed as `rgb(var(--token))` while the converter emits HSL (upstream excludes it from the
branding UI for this reason), and `--field-border` plus the `--new-primary-*` ramp are not in the
schema at all.

---

## Personal organisations, and why the fallback matters

Documenso creates a **personal organisation for every user**. An organisation nobody has explicitly
branded is therefore the common case, not the exception.

`TemplateFooter` renders `brandingCompanyDetails` when branding is enabled, and a fallback when it is
not. Upstream's fallback is Documenso's own registered address. In this fork that fallback is
`WAF_BRAND.companyDetails`, so mail is correctly attributed from every organisation — including ones
created after any setup script has run.

This is why `npm run waf:branding` is optional rather than a required deployment step. It exists to
turn on *explicit* per-organisation branding, which is what allows an uploaded logo to be served.

---

## Email branding behaviour

Upstream's `TemplateBrandingLogo` reads `useBranding()` and degrades cleanly. Every email is rendered
inside `BrandingProvider`, so the hook is always safe to call.

| Organisation state | Logo shown | Links to |
| --- | --- | --- |
| No branding configured | bundled `/static/logo.png` (the WAF mark) | not linked |
| Branding on, logo uploaded | `/api/branding/logo/organisation/:id` | `brandingUrl`, if a safe http(s) URL |
| Branding on, no logo yet | bundled `/static/logo.png` | not linked |

The fork previously carried its own `TemplateEmailHeader` for this. It was deleted in the
`upstream/main` merge: it existed to work around a gap upstream has since closed, and keeping it
meant editing every template.

---

## Verifying a theme change

After editing `waf-theme.css`, confirm the cascade resolves as intended:

```bash
cd apps/remix
npx tailwindcss -c tailwind.config.ts -i app/app.css -o /tmp/built.css
grep -- "--primary:" /tmp/built.css     # last declaration wins
```

The WAF declarations must appear **after** the upstream ones. When this overlay was introduced, all
133 theme custom properties across light and dark resolved identically to the previous in-place
edits — the refactor changed no rendered colour.

---

## Removing "Documenso" from user-facing surfaces

No WAF user should see the word "Documenso" anywhere in the product. These are the surfaces that
carried it, and how each is now handled.

| Surface | Where it came from | Fix |
| --- | --- | --- |
| "This document was sent using Documenso" in email footers | `hidePoweredBy` | Root cause, see below |
| Email sender display name | `NEXT_PRIVATE_SMTP_FROM_NAME` | Set in `.env`; fallback is `WAF_BRAND.appName` |
| Email subjects (welcome, team deleted, org invite, email verification) | `msg` literals | Renamed in source |
| Authenticator app entry (TOTP issuer) | `setup-2fa.ts`, `generate-2fa-credentials-from-email.ts` | `WAF_BRAND.appName` |
| OS passkey prompt | `authenticator.ts` `rpName` | `WAF_BRAND.appName` |
| PDF signature reason, shown in Acrobat | `packages/signing/index.ts` | `Signed by ${WAF_BRAND.appName}` |
| "Send from" dropdown default option | `add-subject.tsx`, `add-template-settings.tsx` | `WAF_BRAND.appName` |
| Sign-in provider label | `IDENTITY_PROVIDER_NAME` | Label only — the `DOCUMENSO` key is a DB enum value and must not change |
| Signing certificate PDF | `render-certificate.ts` reads `public/static/logo.png` | Already the WAF mark |

### The powered-by line

Upstream computes `hidePoweredBy` two different ways, and they disagreed:

- `loadRecipientBrandingByTeamId` (signing pages): `!billingEnabled || claim.flags.hidePoweredBy`
- `get-email-context.ts` (emails): `claim.flags.hidePoweredBy ?? false`

A self-hosted instance therefore got an unbranded signing page but a branded email footer. This fork
applies the signing-page rule to emails too, via `resolveHidePoweredBy`. That is upstream's own
mechanism, not a deletion of the block — worth sending upstream as a bug fix.

Because `NEXT_PUBLIC_FEATURE_BILLING_ENABLED` is unset, `brandingHidePoweredBy` now resolves to
`true` and the line does not render.

### Two things deliberately left alone

- **`X-Documenso-Secret`** (`execute-webhook-call.ts`) is an HTTP header and part of the webhook
  contract. Renaming it would break every existing consumer. It is not visible in the product.
- **Translation catalogs** still contain ~36 stale `msgid`s mentioning Documenso. They are orphaned —
  the source strings no longer match, so Lingui falls back to the current source text and they never
  render. Do **not** run `lingui extract --clean` to tidy them: it rewrites every upstream-owned `.po`
  file and creates a large merge conflict for no user-visible gain. One consequence: the four renamed
  email subjects fall back to English in non-English locales until catalogs are regenerated.

### Licensing

Documenso is AGPL-3.0, and upstream grants `hidePoweredBy` to self-hosted instances in its own code,
so removing the attribution line is a supported configuration rather than a workaround. The AGPL
obligations that do still apply are unchanged: keep `LICENSE` and the copyright headers intact, and
under §13 offer the corresponding source to users who interact with the deployed instance over a
network.

---

## Known gaps

- **`graphify-out/` is committed and not ignored** — roughly 23 MB across 282 files, including a
  ~17 MB `graph.json`. These are derived artifacts that churn on every run and add noise to every
  merge.
- **Translation catalogs drift further each rename.** Renamed strings fall back to English in
  non-English locales, because regenerating catalogs would rewrite every upstream-owned `.po` file.
  Fine while WAF runs in English; revisit if that changes.
- **The email layout is now upstream's.** The fork's dark-header design was dropped in the
  `upstream/main` merge in favour of upstream's config-driven branding. If WAF wants a distinct email
  look, build it on `brandingColors` / `brandingCss` rather than by editing templates again.

Two gaps listed here previously are now closed. `branding-logo.tsx` renders the WAF mark (it had to —
upstream's new signer header renders that component to signers), and the ~40 in-place email template
edits are gone, resolved by adopting upstream during the merge.

---

## Sending fixes upstream

Some of what this fork carries are fixes to Documenso's own bugs, not WAF customisations — the SMTP
transport defaults in `packages/email/mailer.ts` and the password-reset token race in
`packages/lib/server-only/user/forgot-password.ts` among them.

Send those upstream as pull requests. If accepted they leave this branch entirely and return through
`main`, which is the whole economic argument for forking a community project instead of copying it.
