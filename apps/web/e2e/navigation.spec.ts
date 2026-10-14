import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { createProject } from './support/create-project.js';

test('NFR-09: every page links back up through breadcrumbs, and the header title leads home', async ({
  page,
  baseURL,
}) => {
  const projectName = `nav-${randomUUID().slice(0, 8)}`;
  const token = await createProject(projectName);
  const res = await page.request.post(`${baseURL}/api/v1/reports?commit=${'c'.repeat(40)}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/xml' },
    data: '<testsuite name="x"><testcase classname="nav" name="goes back" /></testsuite>',
  });
  expect(res.status()).toBe(202);

  await page.goto('/');
  await page.getByRole('link', { name: projectName }).click();
  const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });

  // Test detail → its Project.
  await expect(async () => {
    await page.reload();
    await page.getByLabel('Search Tests').fill('goes back');
    await expect(page.getByRole('link', { name: 'goes back' })).toBeVisible();
  }).toPass({ timeout: 10_000 });
  await page.getByRole('link', { name: 'goes back' }).click();
  await expect(breadcrumb).toContainText('goes back');
  await breadcrumb.getByRole('link', { name: projectName }).click();
  await expect(page.getByRole('heading', { name: 'Flaky Tests' })).toBeVisible();

  // Reports → its Project → Projects.
  await page.getByRole('link', { name: 'View Reports' }).click();
  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
  await breadcrumb.getByRole('link', { name: projectName }).click();
  await expect(page.getByRole('heading', { name: 'Flaky Tests' })).toBeVisible();
  await breadcrumb.getByRole('link', { name: 'Projects' }).click();
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();

  // The header title leads home from anywhere.
  await page.getByRole('link', { name: projectName }).click();
  await page.getByRole('link', { name: 'Flaky Test Tracker' }).click();
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
});
