import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

import { Body, Container, Head, Hr, Html, Preview, Section } from '../components';
import {
  TemplateDocumentDelete,
  type TemplateDocumentDeleteProps,
} from '../template-components/template-document-super-delete';
import { TemplateEmailHeader } from '../template-components/template-email-header';
import { TemplateFooter } from '../template-components/template-footer';

export type DocumentDeleteEmailTemplateProps = Partial<TemplateDocumentDeleteProps>;

export const DocumentSuperDeleteEmailTemplate = ({
  documentName = 'Open Source Pledge.pdf',
  assetBaseUrl = 'http://localhost:3002',
  reason = 'Unknown',
}: DocumentDeleteEmailTemplateProps) => {
  const { _ } = useLingui();

  const previewText = msg`An admin has deleted your document "${documentName}".`;

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
              <TemplateDocumentDelete reason={reason} documentName={documentName} assetBaseUrl={assetBaseUrl} />
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

export default DocumentSuperDeleteEmailTemplate;
