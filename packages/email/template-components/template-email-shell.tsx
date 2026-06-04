import type { ReactNode } from 'react';

import { Body, Container, Head, Html, Preview, Section } from '../components';
import { TemplateEmailHeader } from './template-email-header';
import { TemplateFooter } from './template-footer';

export type TemplateEmailShellProps = {
  assetBaseUrl: string;
  previewText: string;
  isDocument?: boolean;
  children: ReactNode;
};

export const TemplateEmailShell = ({
  assetBaseUrl,
  previewText,
  isDocument = true,
  children,
}: TemplateEmailShellProps) => {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>

      <Body className="bg-[#f9fafb] font-sans">
        <Section className="mx-auto w-full max-w-[600px]">
          <TemplateEmailHeader assetBaseUrl={assetBaseUrl} />

          <Container className="mx-auto w-full bg-white px-8 py-8">{children}</Container>

          <Section className="bg-[#f3f4f6] px-8 py-6">
            <TemplateFooter isDocument={isDocument} />
          </Section>
        </Section>
      </Body>
    </Html>
  );
};

export default TemplateEmailShell;
