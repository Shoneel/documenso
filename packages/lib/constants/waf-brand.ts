/**
 * WAF eSign brand identity — Water Authority of Fiji.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * This is a fork of Documenso. Brand strings used to be typed inline wherever
 * they were needed (page titles, the email header, the email footer), which
 * meant a rename touched many upstream-owned files and every one of those
 * edits became a merge conflict.
 *
 * Everything fork-specific about *who we are* belongs here, in one additive
 * file that upstream will never touch. Import from here instead of typing the
 * name again.
 *
 * PREFER RUNTIME CONFIG WHERE IT EXISTS
 * -------------------------------------
 * Documenso already stores brand identity per organisation/team in
 * `OrganisationGlobalSettings` (`brandingEnabled`, `brandingLogo`,
 * `brandingUrl`, `brandingCompanyDetails`, `brandingColors`, `brandingCss`).
 * That is the better home for anything an administrator might reasonably want
 * to change without a deploy, and it is what `useBranding()` reads.
 *
 * The values below are the *fallbacks* used when branding has not been
 * configured for an organisation. Seed the real values with
 * `scripts/waf/apply-waf-branding.ts`.
 */
export const WAF_BRAND = {
  /** Short product name. Used in page titles and image alt text. */
  appName: 'WAF eSign',

  /** Logo lockup wordmark, shown beside the default logo in email headers. */
  platformName: 'WAF eSign Platform',

  /** Registered entity name. */
  legalName: 'Water Authority of Fiji',

  /**
   * Fallback for `brandingCompanyDetails`, rendered as a multi-line block in
   * the email footer.
   *
   * Deliberately carries no copyright year and no build number. The previous
   * hardcoded footer read "© 2026 … Development Build v1.1.0", which would
   * have gone stale on 1 January and leaked a development build marker into
   * production mail. If a year is wanted, render it from the current date at
   * send time rather than storing it.
   */
  companyDetails: ['Water Authority of Fiji', 'Developed by WAF ICT'].join('\n'),

  /**
   * Fallback link target for the email header logo. Empty means "link to the
   * application itself" (the caller's `assetBaseUrl`), which is almost always
   * what a transactional email wants.
   */
  url: '',

  /** Path, relative to `assetBaseUrl`, of the logo bundled with the app. */
  logoPath: '/static/logo.png',
} as const;
