import { Section, Text } from '../components';

export type TemplateFooterProps = {
  isDocument?: boolean;
};

export const TemplateFooter = ({ isDocument = true }: TemplateFooterProps) => {
  return (
    <Section>
      <Text className="m-0 text-center text-[#6b7280] text-[12px] leading-5">
        © 2026 Water Authority of Fiji. All Rights Reserved.&nbsp;&nbsp;•&nbsp;&nbsp;Developed by WAF ICT
        &nbsp;&nbsp;•&nbsp;&nbsp;Development Build v1.1.0
      </Text>
    </Section>
  );
};

export default TemplateFooter;
