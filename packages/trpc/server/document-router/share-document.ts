import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';

import { procedure } from '../trpc';
import { ZShareDocumentRequestSchema, ZShareDocumentResponseSchema } from './share-document.types';

/**
 * WAF eSign: disabled.
 *
 * Upstream this mints a public `/share/<slug>` URL whose OpenGraph card renders
 * the signer's signature image and their name (or, failing that, their email) —
 * see `apps/remix/app/routes/_share+/share.$slug.opengraph.tsx`. It backed
 * Documenso's "Share your signing experience" dialog, which offered to post
 * that URL to X. The dialog has been removed from all three of its call sites;
 * this closes the endpoint behind it.
 *
 * The upstream comment below was accurate and is the reason this matters more
 * than a disused button: the route is unauthenticated. Anyone holding a
 * recipient's signing token — which is simply the link in their signing email —
 * could mint a public URL exposing that person's signature.
 *
 * Rejecting here rather than unregistering the route in `router.ts`, because
 * `use-copy-share-link.ts` and `document-share-button.tsx` still reference
 * `trpc.document.share` for their types. Both are upstream files left
 * byte-identical so they do not conflict on merge; removing the procedure would
 * break their typecheck and force edits to them.
 *
 * Not touched: the `/share/<slug>` routes themselves. The signing certificate's
 * QR code resolves through them via the `qr_` slug branch, which is a separate
 * path that never reads `DocumentShareLink`.
 */
// Note: This is an unauthenticated route.
export const shareDocumentRoute = procedure
  .input(ZShareDocumentRequestSchema)
  .output(ZShareDocumentResponseSchema)
  .mutation(({ ctx }) => {
    ctx.logger.warn('Rejected a call to the disabled document.share route.');

    throw new AppError(AppErrorCode.FORBIDDEN, {
      message: 'Public document sharing is disabled.',
    });
  });
