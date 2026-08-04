import backgroundPattern from '@documenso/assets/images/background-pattern.png';
import { authClient } from '@documenso/auth/client';
import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import {
  IS_GOOGLE_SSO_ENABLED,
  IS_MICROSOFT_SSO_ENABLED,
  IS_OIDC_AUTO_REDIRECT_DISABLED,
  IS_OIDC_SSO_ENABLED,
  isSigninEnabledForProvider,
  isSignupEnabledForProvider,
  OIDC_PROVIDER_LABEL,
} from '@documenso/lib/constants/auth';
import { WAF_BRAND } from '@documenso/lib/constants/waf-brand';
import { isValidReturnTo, normalizeReturnTo } from '@documenso/lib/utils/is-valid-return-to';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Loader2Icon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, redirect, useSearchParams } from 'react-router';

import { SignInForm } from '~/components/forms/signin';
import { SIGNUP_ERROR_MESSAGES } from '~/components/forms/signup';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/signin';

export function meta() {
  return appMetaTags(msg`Sign In`);
}

export async function loader({ request }: Route.LoaderArgs) {
  const { isAuthenticated } = await getOptionalSession(request);

  // SSR env variables.
  const isEmailPasswordSigninEnabled = isSigninEnabledForProvider('email');
  const isGoogleSSOEnabled = IS_GOOGLE_SSO_ENABLED && isSigninEnabledForProvider('google');
  const isMicrosoftSSOEnabled = IS_MICROSOFT_SSO_ENABLED && isSigninEnabledForProvider('microsoft');
  const isOIDCSSOEnabled = IS_OIDC_SSO_ENABLED && isSigninEnabledForProvider('oidc');

  // Automatically redirect to OIDC when it is the only enabled signin transport,
  // unless the redirect has been explicitly disabled via env.
  const isOIDCOnlyTransport =
    isOIDCSSOEnabled && !isEmailPasswordSigninEnabled && !isGoogleSSOEnabled && !isMicrosoftSSOEnabled;

  const shouldAutoRedirectToOIDC = isOIDCOnlyTransport && !IS_OIDC_AUTO_REDIRECT_DISABLED;

  const oidcProviderLabel = OIDC_PROVIDER_LABEL;

  const isSignupEnabled =
    isSignupEnabledForProvider('email') ||
    (IS_GOOGLE_SSO_ENABLED && isSignupEnabledForProvider('google')) ||
    (IS_MICROSOFT_SSO_ENABLED && isSignupEnabledForProvider('microsoft')) ||
    (IS_OIDC_SSO_ENABLED && isSignupEnabledForProvider('oidc'));

  let returnTo = new URL(request.url).searchParams.get('returnTo') ?? undefined;

  returnTo = isValidReturnTo(returnTo) ? normalizeReturnTo(returnTo) : undefined;

  if (isAuthenticated) {
    throw redirect(returnTo || '/');
  }

  return {
    isEmailPasswordSigninEnabled,
    isGoogleSSOEnabled,
    isMicrosoftSSOEnabled,
    isOIDCSSOEnabled,
    isSignupEnabled,
    oidcProviderLabel,
    returnTo,
    shouldAutoRedirectToOIDC,
  };
}

export default function SignIn({ loaderData }: Route.ComponentProps) {
  const {
    isEmailPasswordSigninEnabled,
    isGoogleSSOEnabled,
    isMicrosoftSSOEnabled,
    isOIDCSSOEnabled,
    isSignupEnabled,
    oidcProviderLabel,
    returnTo,
    shouldAutoRedirectToOIDC,
  } = loaderData;

  const { _ } = useLingui();

  const [searchParams] = useSearchParams();
  const [isEmbeddedRedirect, setIsEmbeddedRedirect] = useState(false);

  const errorParam = searchParams.get('error');
  const signupError = errorParam ? SIGNUP_ERROR_MESSAGES[errorParam] : undefined;

  useEffect(() => {
    const hash = window.location.hash.slice(1);

    const params = new URLSearchParams(hash);

    setIsEmbeddedRedirect(params.get('embedded') === 'true');
  }, []);

  useEffect(() => {
    if (!shouldAutoRedirectToOIDC) {
      return;
    }

    void authClient.oidc.signIn({ redirectPath: returnTo ?? '/' });
  }, [shouldAutoRedirectToOIDC, returnTo]);

  if (shouldAutoRedirectToOIDC) {
    return (
      <div className="w-screen max-w-lg px-4">
        <div className="flex flex-col items-center justify-center gap-y-4 py-12">
          <Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground text-sm">
            <Trans>Redirecting to {oidcProviderLabel || 'OIDC'}...</Trans>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-screen overflow-hidden">
      <div className="relative grid h-screen w-full md:grid-cols-2">
        <section className="relative hidden h-full items-center justify-center overflow-hidden bg-[#0d1117] px-6 md:flex">
          <div className="flex max-w-[360px] flex-col items-center text-center">
            <img src="/static/logo.png" alt="WAF eSign" width={280} height="auto" style={{ objectFit: 'contain' }} />

            <h1 className="mt-6 font-bold text-[2.5rem] text-white leading-none">
              <Trans>WAF eSign</Trans>
            </h1>

            <p className="mt-4 max-w-[360px] text-[#6b7280] text-[0.95rem] leading-[1.6]">
              <Trans>
                A secure and scalable platform for digital signatures, document approvals, and enterprise workflow
                automation, designed for modern organizations.
              </Trans>
            </p>
          </div>

          <footer
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '12px 24px',
              textAlign: 'center',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              fontSize: '0.68rem',
              color: 'rgba(255,255,255,0.3)',
              letterSpacing: '0.03em',
              whiteSpace: 'nowrap',
            }}
          >
            {WAF_BRAND.companyDetails.split('\n').join('  •  ')}
          </footer>
        </section>

        <section className="relative flex h-full items-center justify-center overflow-hidden bg-[#131c2e] px-6">
          <div className="absolute inset-0">
            <img
              src={backgroundPattern}
              alt="background pattern"
              className="h-full w-full object-cover opacity-35 dark:brightness-95 dark:contrast-[70%] dark:invert dark:sepia"
              style={{
                mask: 'radial-gradient(rgba(255, 255, 255, 1) 0%, transparent 80%)',
                WebkitMask: 'radial-gradient(rgba(255, 255, 255, 1) 0%, transparent 80%)',
              }}
            />
          </div>

          <div className="relative z-10 w-full max-w-[420px]">
            <div className="z-10 rounded-xl border border-border bg-neutral-100 p-6 dark:bg-background">
              {signupError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{_(signupError)}</AlertDescription>
                </Alert>
              )}

              <h1 className="font-semibold text-2xl">
                <Trans>Sign in to your account</Trans>
              </h1>

              <p className="mt-2 text-muted-foreground text-sm">
                <Trans>Welcome back, we are lucky to have you.</Trans>
              </p>

              <hr className="-mx-6 my-4" />

              <SignInForm
                isEmailPasswordSigninEnabled={isEmailPasswordSigninEnabled}
                isGoogleSSOEnabled={isGoogleSSOEnabled}
                isMicrosoftSSOEnabled={isMicrosoftSSOEnabled}
                isOIDCSSOEnabled={isOIDCSSOEnabled}
                oidcProviderLabel={oidcProviderLabel}
                returnTo={returnTo}
              />

              {!isEmbeddedRedirect && isSignupEnabled && (
                <p className="mt-6 text-center text-muted-foreground text-sm">
                  <Trans>
                    Don't have an account?{' '}
                    <Link
                      to={returnTo ? `/signup?returnTo=${encodeURIComponent(returnTo)}` : '/signup'}
                      className="text-documenso-700 duration-200 hover:opacity-70"
                    >
                      Sign up
                    </Link>
                  </Trans>
                </p>
              )}
            </div>
          </div>
        </section>

        <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-px -translate-x-px bg-slate-800/70 md:block" />
      </div>
    </div>
  );
}
