import { DEFAULT_BRAND_COLORS } from './theme';

/**
 * WAF eSign brand colours as hex — Water Authority of Fiji.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `packages/ui/styles/waf-theme.css` re-themes everything that renders through
 * CSS custom properties, and `packages/ui/waf-tailwind.config.cjs` covers the
 * one Tailwind scale that doesn't. Neither reaches code that needs a *concrete
 * hex string* rather than a `var(--token)` reference. Two places need that:
 *
 *   1. Email. React Email inlines styles and mail clients cannot resolve custom
 *      properties, so `packages/email/render.tsx` bakes hex values straight
 *      into a per-render Tailwind config. Every transactional email's CTA is
 *      `bg-primary text-primary-foreground` — including the "sign this
 *      document" invite, which is the first thing an external signer ever sees
 *      of WAF eSign.
 *
 *   2. The branding colour-picker (`branding-preferences-form.tsx`), whose
 *      swatch defaults tell an administrator what "unset" looks like.
 *
 * Both read `DEFAULT_BRAND_COLORS` from `./theme`, which mirrors *upstream's*
 * `theme.css` — so both were still emitting Documenso green (`#a2e771`) long
 * after the app itself had gone blue. Verified before this file existed: the
 * invite button rendered `background-color:rgb(162,231,113)`.
 *
 * The colour-picker case is the nastier of the two. Its defaults are what an
 * administrator sees as the starting point, so saving the branding form once
 * would have written Documenso green into `brandingColors` — which is injected
 * under `.documenso-branded` on signing routes and, because custom properties
 * resolve to the nearest ancestor, beats `waf-theme.css` outright. One save
 * would have turned every signing page green.
 *
 * WHY SPREAD RATHER THAN RESTATE
 * ------------------------------
 * Only tokens that `waf-theme.css` actually redeclares are overridden here.
 * `card` and `popover` are absent because that file deliberately leaves them at
 * the upstream value; spreading keeps that decision in one place instead of
 * copying it. If upstream adds a token, it flows through untouched.
 *
 * VALUES ARE DERIVED, NOT INVENTED
 * --------------------------------
 * Each hex is `colord({ h, s, l }).toHex()` of the light-mode (`:root`) HSL in
 * `waf-theme.css` — the same derivation `./theme` documents for upstream. The
 * source HSL is in the trailing comment on every line so the two can be diffed
 * by eye.
 *
 * KEEP IN SYNC WITH `packages/ui/styles/waf-theme.css`. Nothing enforces this
 * link, exactly as `./theme` warns about its own. Change a colour there, change
 * it here.
 *
 * LIGHT MODE ONLY — this is deliberate. `brandingColors` holds a single palette
 * with no dark variant, and email has no meaningful dark mode. The dark ramp in
 * `waf-theme.css` has no counterpart here and does not need one.
 */
export const WAF_BRAND_COLORS = {
  ...DEFAULT_BRAND_COLORS,

  background: '#f8fafc', //              210 40% 98%
  foreground: '#213045', //              215 35% 20%
  muted: '#eaf0f5', //                   210 35% 94%
  mutedForeground: '#5c6f8a', //         215 20% 45%
  popoverForeground: '#213045', //       215 35% 20%
  cardBorder: '#d2dbe4', //              210 25% 86%
  cardForeground: '#213045', //          215 35% 20%
  fieldCard: '#daebfb', //               210 80% 92%
  fieldCardBorder: '#4d8ccb', //         210 55% 55%
  fieldCardForeground: '#213045', //     215 35% 20%
  widget: '#f1f5f8', //                  210 35% 96%
  widgetForeground: '#e3ebf2', //        210 35% 92%
  border: '#d2dbe4', //                  210 25% 86%
  input: '#d9e0e8', //                   210 25% 88%
  primary: '#4d8ccb', //                 210 55% 55%
  primaryForeground: '#ffffff', //       0 0% 100%
  secondary: '#e1ecf4', //               204 45% 92%
  secondaryForeground: '#293c56', //     215 35% 25%
  accent: '#d5ebf6', //                  200 65% 90%
  accentForeground: '#1f3047', //        215 40% 20%
  destructive: '#ef4343', //             0 84% 60%
  destructiveForeground: '#ffffff', //   0 0% 100%
  ring: '#4d8ccb', //                    210 55% 55%
  warning: '#f59f0a', //                 38 92% 50%
  envelopeEditorBackground: '#f0f5f9', //210 45% 96%
  // `satisfies Record<keyof ...>` and not `satisfies typeof DEFAULT_BRAND_COLORS`:
  // the latter is `as const`, so its property types are the literal Documenso
  // hexes (`'#a2e771'`), which nothing here could ever satisfy. Keying off it
  // still fails the build if upstream adds a token we don't cover.
} as const satisfies Record<keyof typeof DEFAULT_BRAND_COLORS, string>;
