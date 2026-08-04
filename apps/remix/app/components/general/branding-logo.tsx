import { WAF_BRAND } from '@documenso/lib/constants/waf-brand';
import type { ImgHTMLAttributes } from 'react';

export type LogoProps = ImgHTMLAttributes<HTMLImageElement>;

/**
 * The application wordmark.
 *
 * Upstream ships this as an inline SVG of the Documenso wordmark. There is no
 * SVG of the WAF mark, so this renders the bundled raster asset instead — the
 * same file the signing certificate and email headers use, which keeps every
 * surface on one image.
 *
 * The prop type changed from `SVGAttributes<SVGSVGElement>` to
 * `ImgHTMLAttributes<HTMLImageElement>` accordingly. Call sites pass only
 * `className`, so they are unaffected.
 */
export const BrandingLogo = ({ alt, ...props }: LogoProps) => {
  return <img src={WAF_BRAND.logoPath} alt={alt ?? WAF_BRAND.appName} {...props} />;
};
