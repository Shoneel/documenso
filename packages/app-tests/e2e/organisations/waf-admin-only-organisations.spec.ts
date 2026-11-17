import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';

import { apiSignin } from '../fixtures/authentication';

// WAF eSign: only administrators may create organisations. See README.waf.md.

const createOrganisationFromPage = async (page: import('@playwright/test').Page, name: string) =>
  page.evaluate(async (organisationName) => {
    const response = await fetch('/api/trpc/organisation.create?batch=1', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ 0: { json: { name: organisationName } } }),
    });

    return { status: response.status, body: await response.text() };
  }, name);

test('[WAF ORGANISATIONS]: a non-admin cannot create an organisation', async ({ page }) => {
  const { user } = await seedUser({ isPersonalOrganisation: true });

  const ownedBefore = await prisma.organisation.count({ where: { ownerUserId: user.id } });

  await apiSignin({ page, email: user.email, redirectPath: '/settings/organisations' });

  await expect(page.getByRole('heading', { name: 'Organizations' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create organization' })).toHaveCount(0);

  // The button is only cosmetic; the server must refuse a direct request too.
  const result = await createOrganisationFromPage(page, 'Should not exist');

  expect(result.status).toBe(401);
  expect(result.body).toContain('Only administrators can create organisations');
  expect(await prisma.organisation.count({ where: { ownerUserId: user.id } })).toBe(ownedBefore);
});

test('[WAF ORGANISATIONS]: an admin can create an organisation', async ({ page }) => {
  const { user } = await seedUser({ isPersonalOrganisation: true, isAdmin: true });

  await apiSignin({ page, email: user.email, redirectPath: '/settings/organisations' });

  await expect(page.getByRole('button', { name: 'Create organization' })).toBeVisible();

  const result = await createOrganisationFromPage(page, 'Admin created organisation');

  expect(result.status).toBe(200);
  expect(await prisma.organisation.count({ where: { ownerUserId: user.id, name: 'Admin created organisation' } })).toBe(
    1,
  );
});
