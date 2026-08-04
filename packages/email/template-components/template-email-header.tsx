import { WAF_BRAND } from '@documenso/lib/constants/waf-brand';

import { Img, Link, Section, Text } from '../components';
import { useBranding } from '../providers/branding';

export type TemplateEmailHeaderProps = {
  assetBaseUrl: string;
};

/**
 * Branded header lockup for transactional email.
 *
 * Reads the organisation's runtime branding (`useBranding()`) so an
 * administrator can change the logo and link target from organisation
 * settings without a deploy. Falls back to the bundled logo and the
 * `WAF_BRAND` constants when branding has not been configured.
 *
 * Every email is rendered inside `BrandingProvider` (see `render.tsx`), so
 * `useBranding()` is always safe to call from here.
 *
 * When a custom logo IS configured the wordmark text is suppressed: an
 * uploaded logo already carries the organisation's name, and rendering both
 * produces a duplicated lockup.
 */
export const TemplateEmailHeader = ({ assetBaseUrl }: TemplateEmailHeaderProps) => {
  const branding = useBranding();

  const hasCustomLogo = branding.brandingEnabled && Boolean(branding.brandingLogo);

  const logoSrc = hasCustomLogo ? branding.brandingLogo : new URL(WAF_BRAND.logoPath, assetBaseUrl).toString();

  const href = (branding.brandingEnabled && branding.brandingUrl) || WAF_BRAND.url || assetBaseUrl;

  return (
    <Section className="bg-[#0d1117] px-8 py-4">
      <Section className="flex items-center gap-3">
        <Link href={href} className="flex items-center gap-3 no-underline">
          <Img src={logoSrc} alt={WAF_BRAND.appName} width={140} style={{ display: 'block', objectFit: 'contain' }} />

          {!hasCustomLogo && (
            <Text className="m-0 whitespace-nowrap border-white/20 border-l pl-3 font-semibold text-[0.95rem] text-white">
              {WAF_BRAND.platformName}
            </Text>
          )}
        </Link>
      </Section>
    </Section>
  );
};

export default TemplateEmailHeader;
