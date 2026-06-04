import { Img, Link, Section, Text } from '../components';

export type TemplateEmailHeaderProps = {
  assetBaseUrl: string;
};

export const TemplateEmailHeader = ({ assetBaseUrl }: TemplateEmailHeaderProps) => {
  return (
    <Section className="bg-[#0d1117] px-8 py-4">
      <Section className="flex items-center gap-3">
        <Link href={assetBaseUrl} className="flex items-center gap-3 no-underline">
          <Img
            src={new URL('/static/logo.png', assetBaseUrl).toString()}
            alt="WAF eSign"
            width={140}
            style={{ display: 'block', objectFit: 'contain' }}
          />
          <Text className="m-0 whitespace-nowrap border-white/20 border-l pl-3 font-semibold text-[0.95rem] text-white">
            WAF eSign Platform
          </Text>
        </Link>
      </Section>
    </Section>
  );
};

export default TemplateEmailHeader;
