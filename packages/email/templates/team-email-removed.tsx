import { formatTeamUrl } from '@documenso/lib/utils/teams';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import { Body, Container, Head, Hr, Html, Preview, Section, Text } from '../components';
import { TemplateEmailHeader } from '../template-components/template-email-header';
import { TemplateFooter } from '../template-components/template-footer';
import TemplateImage from '../template-components/template-image';

export type TeamEmailRemovedTemplateProps = {
  assetBaseUrl: string;
  baseUrl: string;
  teamEmail: string;
  teamName: string;
  teamUrl: string;
};

export const TeamEmailRemovedTemplate = ({
  assetBaseUrl = 'http://localhost:3002',
  baseUrl = 'https://documenso.com',
  teamEmail = 'example@waf.com.fj',
  teamName = 'Team Name',
  teamUrl = 'demo',
}: TeamEmailRemovedTemplateProps) => {
  const { _ } = useLingui();

  const previewText = msg`Team email removed for ${teamName} on WAF eSign`;

  return (
    <Html>
      <Head />
      <Preview>{_(previewText)}</Preview>

      <Body className="bg-[#f9fafb] font-sans">
        <Section className="bg-white text-slate-500">
          <TemplateEmailHeader assetBaseUrl={assetBaseUrl} />

          <Container className="mx-auto w-full max-w-[600px] bg-white px-8 py-8">
            <Section>
              <TemplateImage className="mx-auto" assetBaseUrl={assetBaseUrl} staticAsset="mail-open-alert.png" />
            </Section>

            <Section className="p-2 text-slate-500">
              <Text className="text-center font-medium text-black text-lg">
                <Trans>Team email removed</Trans>
              </Text>

              <Text className="my-1 text-center text-base">
                <Trans>
                  The team email <span className="font-bold">{teamEmail}</span> has been removed from the following team
                </Trans>
              </Text>

              <div className="mx-auto mt-2 mb-6 w-fit rounded-lg bg-gray-50 px-4 py-2 font-medium text-base text-slate-600">
                {formatTeamUrl(teamUrl, baseUrl)}
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

export default TeamEmailRemovedTemplate;
