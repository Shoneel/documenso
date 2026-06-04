import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import { Body, Container, Head, Hr, Html, Preview, Section, Text } from '../components';
import { TemplateEmailHeader } from '../template-components/template-email-header';
import { TemplateFooter } from '../template-components/template-footer';
import TemplateImage from '../template-components/template-image';

export type OrganisationJoinEmailProps = {
  assetBaseUrl: string;
  baseUrl: string;
  memberName: string;
  memberEmail: string;
  organisationName: string;
  organisationUrl: string;
};

export const OrganisationJoinEmailTemplate = ({
  assetBaseUrl = 'http://localhost:3002',
  baseUrl = 'https://documenso.com',
  memberName = 'John Doe',
  memberEmail = 'johndoe@waf.com.fj',
  organisationName = 'Organisation Name',
  organisationUrl = 'demo',
}: OrganisationJoinEmailProps) => {
  const { _ } = useLingui();

  const previewText = msg`A member has joined your organisation on WAF eSign`;

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
                <Trans>A new member has joined your organisation {organisationName}</Trans>
              </Text>

              <div className="mx-auto my-2 w-fit rounded-lg bg-gray-50 px-4 py-2 font-medium text-base text-slate-600">
                {memberName || memberEmail}
              </div>
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

export default OrganisationJoinEmailTemplate;
