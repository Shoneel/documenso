import { NEXT_PUBLIC_WEBAPP_URL } from '../constants/app';
import { PASSKEY_TIMEOUT } from '../constants/auth';
import { WAF_BRAND } from '../constants/waf-brand';

/**
 * Extracts common fields to identify the RP (relying party)
 */
export const getAuthenticatorOptions = () => {
  const webAppBaseUrl = new URL(NEXT_PUBLIC_WEBAPP_URL());
  const rpId = webAppBaseUrl.hostname;

  return {
    // Display name only — shown in the OS passkey prompt. `rpId` is the
    // security-relevant field, so changing this does not invalidate existing
    // passkeys.
    rpName: WAF_BRAND.appName,
    rpId,
    origin: NEXT_PUBLIC_WEBAPP_URL(),
    timeout: PASSKEY_TIMEOUT,
  };
};
