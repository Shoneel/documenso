/**
 * Applies WAF eSign branding to every organisation's global settings.
 *
 * WHY THIS EXISTS
 * ---------------
 * This is a fork of Documenso. Rather than hardcoding "Water Authority of
 * Fiji" into upstream-owned email templates (which is what the fork used to
 * do, and which turned every template into a merge conflict), brand identity
 * lives in `OrganisationGlobalSettings` — the runtime branding Documenso
 * already supports and reads via `useBranding()`.
 *
 * This script writes those settings. It is idempotent: running it repeatedly
 * converges on the same state, and it never clears a logo an administrator
 * uploaded through the settings UI.
 *
 * THIS SCRIPT IS OPTIONAL
 * -----------------------
 * Correctness does not depend on it. `TemplateFooter` already falls back to
 * `WAF_BRAND.companyDetails` for any organisation without explicit branding,
 * so mail is correctly attributed out of the box — including from the
 * personal organisation Documenso creates for every new user, which no
 * one-off script could keep up with.
 *
 * What this script adds is *explicit* per-organisation branding: it flips
 * `brandingEnabled` on, which is what allows an uploaded logo to be served
 * from `/api/branding/logo/organisation/:id` and used in email headers.
 *
 * Run it after creating the real WAF organisation:
 *
 *   npm run waf:branding               # apply
 *   npm run waf:branding -- --dry-run  # show what would change
 *
 * NOT HANDLED HERE: the logo
 * --------------------------
 * `brandingLogo` does not store a path or a URL — it stores a JSON file
 * descriptor that is resolved through the configured storage backend and
 * served from `/api/branding/logo/organisation/:id`. Uploading it correctly
 * means going through the supported path: Organisation Settings → Branding.
 * Until a logo is uploaded, the email header falls back to the bundled
 * `/static/logo.png`, which is already the WAF mark, so this is cosmetic
 * rather than blocking.
 *
 * NOT HANDLED HERE: colours
 * -------------------------
 * `brandingColors` is deliberately left unset. It holds a single palette with
 * no light/dark variants, and it is applied via a `.documenso-branded`
 * wrapper on `<body>` for signing routes — which, because custom properties
 * resolve to the nearest ancestor, would override the dark theme and force
 * dark-mode signers into light colours. The WAF palette is already applied to
 * every surface, in both themes, by `packages/ui/styles/waf-theme.css`.
 * Setting it here would regress dark mode and gain nothing.
 */
import { WAF_BRAND } from '@documenso/lib/constants/waf-brand';
import { prisma } from '@documenso/prisma';

const isDryRun = process.argv.includes('--dry-run');

const main = async () => {
  const organisations = await prisma.organisation.findMany({
    select: {
      id: true,
      name: true,
      organisationGlobalSettingsId: true,
      organisationGlobalSettings: {
        select: {
          brandingEnabled: true,
          brandingUrl: true,
          brandingCompanyDetails: true,
          brandingLogo: true,
        },
      },
    },
  });

  if (organisations.length === 0) {
    console.warn('No organisations found. Nothing to do.');
    console.warn('If this is a fresh install, create the organisation first, then re-run.');
    return;
  }

  console.log(`${isDryRun ? '[dry run] ' : ''}Applying WAF branding to ${organisations.length} organisation(s).\n`);

  let changed = 0;

  for (const organisation of organisations) {
    const current = organisation.organisationGlobalSettings;

    const desired = {
      brandingEnabled: true,
      brandingUrl: WAF_BRAND.url,
      brandingCompanyDetails: WAF_BRAND.companyDetails,
    };

    const drift = (Object.keys(desired) as (keyof typeof desired)[]).filter((key) => current?.[key] !== desired[key]);

    if (drift.length === 0) {
      console.log(`  = ${organisation.name} (${organisation.id}) — already correct`);
      continue;
    }

    console.log(`  ${isDryRun ? '?' : '+'} ${organisation.name} (${organisation.id})`);

    for (const key of drift) {
      console.log(`      ${key}: ${JSON.stringify(current?.[key] ?? null)} -> ${JSON.stringify(desired[key])}`);
    }

    if (!isDryRun) {
      // brandingLogo is intentionally absent from `data` — an administrator may
      // have uploaded one through the settings UI and this script must not
      // clobber it.
      await prisma.organisationGlobalSettings.update({
        where: { id: organisation.organisationGlobalSettingsId },
        data: desired,
      });
    }

    changed += 1;
  }

  console.log(
    `\n${isDryRun ? '[dry run] ' : ''}${changed} organisation(s) ${isDryRun ? 'would be' : ''} updated, ` +
      `${organisations.length - changed} already correct.`,
  );

  const missingLogo = organisations.filter((o) => !o.organisationGlobalSettings?.brandingLogo);

  if (missingLogo.length > 0) {
    console.log(
      `\nNote: ${missingLogo.length} organisation(s) have no branding logo uploaded. ` +
        'Email headers will use the bundled /static/logo.png. ' +
        'To upload one: Organisation Settings -> Branding.',
    );
  }
};

main()
  .catch((error) => {
    console.error('Failed to apply WAF branding:');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
