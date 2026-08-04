import { WAF_BRAND } from '@documenso/lib/constants/waf-brand';
import { Trans } from '@lingui/react/macro';

import { Link, Section, Text } from '../components';
import { useBranding } from '../providers/branding';

export type TemplateFooterProps = {
  isDocument?: boolean;
};

export const TemplateFooter = ({ isDocument = true }: TemplateFooterProps) => {
  const branding = useBranding();

  return (
    <Section>
      {isDocument && !branding.brandingHidePoweredBy && (
        <Text className="my-4 text-base text-slate-400">
          <Trans>
            This document was sent using{' '}
            <Link className="text-[#7AC455]" href="https://documen.so/mail-footer">
              Documenso
            </Link>
            .
          </Trans>
        </Text>
      )}

      {branding.brandingEnabled && branding.brandingCompanyDetails && (
        <Text className="my-8 text-slate-400 text-sm">
          {branding.brandingCompanyDetails.split('\n').map((line, idx) => {
            return (
              <>
                {idx > 0 && <br />}
                {line}
              </>
            );
          })}
        </Text>
      )}

      {/*
       * FORK CHANGE: the unbranded fallback is WAF, not Documenso, Inc.
       *
       * Branding is per-organisation, and Documenso creates a personal
       * organisation for every user — so an organisation that nobody has
       * explicitly branded is the common case, not the exception. Leaving
       * upstream's fallback here would put "Documenso, Inc., San Francisco"
       * in the footer of mail sent from every such organisation.
       *
       * Keep this as the platform default; per-organisation branding still
       * overrides it via the block above.
       */}
      {!branding.brandingEnabled && (
        <Text className="my-8 text-slate-400 text-sm">
          {WAF_BRAND.companyDetails.split('\n').map((line, idx) => {
            return (
              <>
                {idx > 0 && <br />}
                {line}
              </>
            );
          })}
        </Text>
      )}
    </Section>
  );
};

export default TemplateFooter;
