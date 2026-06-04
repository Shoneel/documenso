import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import { Body, Button, Container, Head, Hr, Html, Preview, Section, Text } from '../components';
import { TemplateEmailHeader } from '../template-components/template-email-header';
import { TemplateFooter } from '../template-components/template-footer';
import TemplateImage from '../template-components/template-image';

export type OrganisationInviteEmailProps = {
  assetBaseUrl: string;
  baseUrl: string;
  senderName: string;
  organisationName: string;
  token: string;
};

export const OrganisationInviteEmailTemplate = ({
  assetBaseUrl = 'http://localhost:3002',
  baseUrl = 'https://documenso.com',
  senderName = 'John Doe',
  organisationName = 'Organisation Name',
  token = '',
}: OrganisationInviteEmailProps) => {
  const { _ } = useLingui();

  const previewText = msg`Accept invitation to join an organisation on WAF eSign`;

  return (
    <Html>
      <Head />
      <Preview>{_(previewText)}</Preview>

      <Body className="bg-[#f9fafb] font-sans">
        <Section className="bg-white text-slate-500">
          <TemplateEmailHeader assetBaseUrl={assetBaseUrl} />

          <Container className="mx-auto w-full max-w-[600px] bg-white px-8 py-8">
            <Section>
              <TemplateImage className="mx-auto" assetBaseUrl={assetBaseUrl} staticAsset="add-user.png" />
            </Section>

            <Section className="p-2 text-slate-500">
              <Text className="text-center font-medium text-black text-lg">
                <Trans>Join {organisationName} on WAF eSign</Trans>
              </Text>

              <Text className="my-1 text-center text-base">
                <Trans>You have been invited to join the following organisation</Trans>
              </Text>

              <div className="mx-auto my-2 w-fit rounded-lg bg-gray-50 px-4 py-2 font-medium text-base text-slate-600">
                {organisationName}
              </div>

              <Text className="my-1 text-center text-base">
                <Trans>
                  by <span className="text-slate-900">{senderName}</span>
                </Trans>
              </Text>

              <Section className="mt-6 mb-6 text-center">
                <Button
                  className="inline-flex items-center justify-center rounded-md bg-[#3b82f6] px-8 py-3 text-center font-semibold text-white no-underline"
                  href={`${baseUrl}/organisation/invite/${token}`}
                >
                  <Trans>Accept</Trans>
                </Button>
                <Button
                  className="ml-4 inline-flex items-center justify-center rounded-lg bg-gray-50 px-6 py-3 text-center font-medium text-slate-600 text-sm no-underline"
                  href={`${baseUrl}/organisation/decline/${token}`}
                >
                  <Trans>Decline</Trans>
                </Button>
              </Section>
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

export default OrganisationInviteEmailTemplate;
