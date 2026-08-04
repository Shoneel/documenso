/**
 * WAF eSign Tailwind overlay — Water Authority of Fiji.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `waf-theme.css` re-themes everything that flows through CSS custom
 * properties. The `documenso` colour scale does not: it is hardcoded hex in
 * `packages/tailwind-config/index.cjs` (`DEFAULT: '#A2E771'`, Documenso green)
 * and compiled straight into utility classes, so no stylesheet override can
 * reach it.
 *
 * That left Documenso green in every `bg-documenso` / `text-documenso-700` /
 * `bg-documenso-200` usage — about twenty call sites, including the sign-in
 * submit button (`dark:bg-documenso`), folder icons, and admin chart labels.
 *
 * This preset re-points that scale at the WAF ramp. It is applied *after* the
 * upstream preset in `apps/remix/tailwind.config.ts`, so the values here win.
 *
 * WHY THE TOKEN IS STILL CALLED `documenso`
 * -----------------------------------------
 * Renaming it to `waf` would mean editing every call site — all upstream-owned
 * files, all permanent merge conflicts — to change nothing a user can see. The
 * name is an internal Tailwind token; only its value is visible. Leave it.
 *
 * Note it does surface in the DOM as a class name (`class="bg-documenso"`),
 * visible in devtools. That is the one place the word survives on the client.
 *
 * VALUES COME FROM `waf-theme.css`
 * --------------------------------
 * These reference `--new-primary-*` rather than restating hex, so the ramp has
 * a single owner. Change a colour there and this follows automatically — the
 * same drift trap `packages/lib/constants/theme.ts` warns about, avoided.
 *
 * The `--new-primary-*` variables are stored comma-separated
 * (`210, 55%, 55%`), which is what `hsl()` needs here.
 *
 * Not usable in email: React Email inlines styles and mail clients cannot
 * resolve custom properties. Verified no email template uses this scale.
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        documenso: {
          DEFAULT: 'hsl(var(--new-primary-500))',
          50: 'hsl(var(--new-primary-50))',
          100: 'hsl(var(--new-primary-100))',
          200: 'hsl(var(--new-primary-200))',
          300: 'hsl(var(--new-primary-300))',
          400: 'hsl(var(--new-primary-400))',
          500: 'hsl(var(--new-primary-500))',
          600: 'hsl(var(--new-primary-600))',
          700: 'hsl(var(--new-primary-700))',
          800: 'hsl(var(--new-primary-800))',
          900: 'hsl(var(--new-primary-900))',
          950: 'hsl(var(--new-primary-950))',
        },
      },
    },
  },
};
