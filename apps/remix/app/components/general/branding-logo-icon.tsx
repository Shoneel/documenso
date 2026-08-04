import { WAF_BRAND } from '@documenso/lib/constants/waf-brand';
import type { ImgHTMLAttributes } from 'react';

export type LogoProps = ImgHTMLAttributes<HTMLImageElement>;

/**
 * Compact square mark, used where the full wordmark will not fit (the mobile
 * signing header). Upstream ships the Documenso glyph as inline SVG; this
 * renders the WAF favicon asset, the only square WAF mark available.
 *
 * See `branding-logo.tsx` for why these became `<img>` elements.
 */
export const BrandingLogoIcon = ({ alt, ...props }: LogoProps) => {
  return <img src={WAF_BRAND.iconPath} alt={alt ?? WAF_BRAND.appName} {...props} />;
};
