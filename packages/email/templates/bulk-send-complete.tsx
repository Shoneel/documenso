import { msg, Trans } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { Body, Container, Head, Html, Preview, Section, Text } from '../components';
import { TemplateEmailHeader } from '../template-components/template-email-header';
import { TemplateFooter } from '../template-components/template-footer';

export interface BulkSendCompleteEmailProps {
  userName: string;
  templateName: string;
  totalProcessed: number;
  successCount: number;
  failedCount: number;
  errors: string[];
  assetBaseUrl?: string;
}

export const BulkSendCompleteEmail = ({
  userName,
  templateName,
  totalProcessed,
  successCount,
  failedCount,
  errors,
  assetBaseUrl = 'http://localhost:3002',
}: BulkSendCompleteEmailProps) => {
  const { _ } = useLingui();

  return (
    <Html>
      <Head />
      <Preview>{_(msg`Bulk send operation complete for template "${templateName}"`)}</Preview>
      <Body className="bg-[#f9fafb] font-sans">
        <Section>
          <TemplateEmailHeader assetBaseUrl={assetBaseUrl} />

          <Container className="mx-auto w-full max-w-[600px] bg-white px-8 py-8">
            <Section>
              <Text className="text-sm">
                <Trans>Hi {userName},</Trans>
              </Text>

              <Text className="text-sm">
                <Trans>Your bulk send operation for template "{templateName}" has completed.</Trans>
              </Text>

              <Text className="font-semibold text-lg">
                <Trans>Summary:</Trans>
              </Text>

              <ul className="my-2 ml-4 list-inside list-disc">
                <li>
                  <Trans>Total rows processed: {totalProcessed}</Trans>
                </li>
                <li className="mt-1">
                  <Trans>Successfully created: {successCount}</Trans>
                </li>
                <li className="mt-1">
                  <Trans>Failed: {failedCount}</Trans>
                </li>
              </ul>

              {failedCount > 0 && (
                <Section className="mt-4">
                  <Text className="font-semibold text-lg">
                    <Trans>The following errors occurred:</Trans>
                  </Text>

                  <ul className="my-2 ml-4 list-inside list-disc">
                    {errors.map((error, index) => (
                      <li key={index} className="mt-1 text-destructive text-slate-400 text-sm">
                        {error}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              <Text className="text-sm">
                <Trans>
                  You can view the created documents in your dashboard under the "Documents created from template"
                  section.
                </Trans>
              </Text>
            </Section>
          </Container>
          <Section className="bg-[#f3f4f6] px-8 py-6">
            <TemplateFooter />
          </Section>
        </Section>
      </Body>
    </Html>
  );
};
