import { formatTeamUrl } from '@documenso/lib/utils/teams';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import { Body, Button, Container, Head, Hr, Html, Link, Preview, Section, Text } from '../components';
import { TemplateEmailHeader } from '../template-components/template-email-header';
import { TemplateFooter } from '../template-components/template-footer';
import TemplateImage from '../template-components/template-image';

export type ConfirmTeamEmailProps = {
  assetBaseUrl: string;
  baseUrl: string;
  teamName: string;
  teamUrl: string;
  token: string;
};

export const ConfirmTeamEmailTemplate = ({
  assetBaseUrl = 'http://localhost:3002',
  baseUrl = 'https://documenso.com',
  teamName = 'Team Name',
  teamUrl = 'demo',
  token = '',
}: ConfirmTeamEmailProps) => {
  const { _ } = useLingui();

  const previewText = msg`Accept team email request for ${teamName} on WAF eSign`;

  return (
    <Html>
      <Head />
      <Preview>{_(previewText)}</Preview>

      <Body className="bg-[#f9fafb] font-sans">
        <Section className="bg-white">
          <TemplateEmailHeader assetBaseUrl={assetBaseUrl} />

          <Container className="mx-auto w-full max-w-[600px] bg-white px-8 py-8">
            <Section>
              <TemplateImage className="mx-auto" assetBaseUrl={assetBaseUrl} staticAsset="mail-open.png" />
            </Section>

            <Section className="p-2 text-slate-500">
              <Text className="text-center font-medium text-black text-lg">
                <Trans>Verify your team email address</Trans>
              </Text>

              <Text className="text-center text-base">
                <Trans>
                  <span className="font-bold">{teamName}</span> has requested to use your email address for their team
                  on WAF eSign.
                </Trans>
              </Text>

              <div className="mx-auto mt-6 w-fit rounded-lg bg-gray-50 px-4 py-2 font-medium text-base text-slate-600">
                {formatTeamUrl(teamUrl, baseUrl)}
              </div>

              <Section className="mt-6">
                <Text className="my-0 text-sm">
                  <Trans>
                    By accepting this request, you will be granting <strong>{teamName}</strong> access to:
                  </Trans>
                </Text>

                <ul className="mt-2 mb-0">
                  <li className="text-sm">
                    <Trans>View all documents sent to and from this email address</Trans>
                  </li>
                  <li className="mt-1 text-sm">
                    <Trans>Allow document recipients to reply directly to this email address</Trans>
                  </li>
                  <li className="mt-1 text-sm">
                    <Trans>Send documents on behalf of the team using the email address</Trans>
                  </li>
                </ul>

                <Text className="mt-2 text-sm">
                  <Trans>
                    You can revoke access at any time in your team settings on WAF eSign{' '}
                    <Link href={`${baseUrl}/settings/teams`}>here</Link>.
                  </Trans>
                </Text>
              </Section>

              <Section className="mt-8 mb-6 text-center">
                <Button
                  className="inline-flex items-center justify-center rounded-md bg-[#3b82f6] px-8 py-3 text-center font-semibold text-white no-underline"
                  href={`${baseUrl}/team/verify/email/${token}`}
                >
                  <Trans>Accept</Trans>
                </Button>
              </Section>
            </Section>

            <Text className="text-center text-slate-500 text-xs">
              <Trans>Link expires in 1 hour.</Trans>
            </Text>
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

export default ConfirmTeamEmailTemplate;
