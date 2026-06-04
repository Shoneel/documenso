import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import { Body, Container, Head, Hr, Html, Link, Preview, Section, Text } from '../components';
import { TemplateEmailHeader } from '../template-components/template-email-header';
import { TemplateFooter } from '../template-components/template-footer';
import type { TemplateResetPasswordProps } from '../template-components/template-reset-password';
import { TemplateResetPassword } from '../template-components/template-reset-password';

export type ResetPasswordTemplateProps = Partial<TemplateResetPasswordProps>;

export const ResetPasswordTemplate = ({
  userName = 'Lucas Smith',
  userEmail = 'lucas@waf.com.fj',
  assetBaseUrl = 'http://localhost:3002',
}: ResetPasswordTemplateProps) => {
  const { _ } = useLingui();

  const previewText = msg`Password Reset Successful`;

  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  return (
    <Html>
      <Head />
      <Preview>{_(previewText)}</Preview>

      <Body className="bg-[#f9fafb] font-sans">
        <Section>
          <TemplateEmailHeader assetBaseUrl={assetBaseUrl} />

          <Container className="mx-auto w-full max-w-[600px] bg-white px-8 py-8">
            <Section>
              <TemplateResetPassword userName={userName} userEmail={userEmail} assetBaseUrl={assetBaseUrl} />
            </Section>
          </Container>

          <Container className="mx-auto mt-12 max-w-xl">
            <Section>
              <Text className="my-4 font-semibold text-base">
                <Trans>
                  Hi, {userName}{' '}
                  <Link className="font-normal text-slate-400" href={`mailto:${userEmail}`}>
                    ({userEmail})
                  </Link>
                </Trans>
              </Text>

              <Text className="mt-2 text-base text-slate-400">
                <Trans>We've changed your password as you asked. You can now sign in with your new password.</Trans>
              </Text>
              <Text className="mt-2 text-base text-slate-400">
                <Trans>
                  Didn't request a password change? We are here to help you secure your account, just{' '}
                  <Link className="font-normal text-[#1d4ed8]" href="mailto:hi@waf.com.fj">
                    contact us
                  </Link>
                  .
                </Trans>
              </Text>
            </Section>
          </Container>

          <Hr className="mx-auto mt-12 max-w-xl" />
          <Section className="bg-[#f3f4f6] px-8 py-6">
            <TemplateFooter />
          </Section>
        </Section>
      </Body>
    </Html>
  );
};

export default ResetPasswordTemplate;
