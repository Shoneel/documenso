import { Trans } from '@lingui/react/macro';

import { Button, Link, Section, Text } from '../components';
import { TemplateDocumentImage } from './template-document-image';

export type TemplateAdminUserCreatedProps = {
  resetPasswordLink: string;
  assetBaseUrl: string;
};

export const TemplateAdminUserCreated = ({ resetPasswordLink, assetBaseUrl }: TemplateAdminUserCreatedProps) => {
  return (
    <>
      <TemplateDocumentImage className="mt-6" assetBaseUrl={assetBaseUrl} />

      <Section className="flex-row items-center justify-center">
        <Text className="mx-auto mb-0 max-w-[80%] text-center font-semibold text-lg text-primary">
          <Trans>Welcome to WAF eSign!</Trans>
        </Text>

        <Text className="my-1 text-center text-base text-slate-400">
          <Trans>An administrator has created a WAF eSign account for you.</Trans>
        </Text>

        <Text className="my-1 text-center text-base text-slate-400">
          <Trans>To get started, please set your password by clicking the button below:</Trans>
        </Text>

        <Section className="mt-8 mb-6 text-center">
          <Button
            className="inline-flex items-center justify-center rounded-md bg-[#3b82f6] px-8 py-3 text-center font-semibold text-white no-underline"
            href={resetPasswordLink}
          >
            <Trans>Set Password</Trans>
          </Button>
          <Text className="mt-8 text-center text-slate-400 text-sm italic">
            <Trans>
              You can also copy and paste this link into your browser: {resetPasswordLink} (link expires in 24 hours)
            </Trans>
          </Text>
        </Section>

        <Section className="mt-8">
          <Text className="text-center text-slate-400 text-sm">
            <Trans>
              If you didn't expect this account or have any questions, please{' '}
              <Link href="mailto:support@waf.com.fj" className="text-[#1d4ed8]">
                contact support
              </Link>
              .
            </Trans>
          </Text>
        </Section>
      </Section>
    </>
  );
};
