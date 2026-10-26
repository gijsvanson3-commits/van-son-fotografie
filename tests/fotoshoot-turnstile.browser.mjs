import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
const { chromium } = createRequire(import.meta.url)('playwright');
assert.ok(process.env.FOTOSHOOT_PHP, 'Set FOTOSHOOT_PHP');
const base = 'http://127.0.0.1:8767';
const server = spawn(process.env.FOTOSHOOT_PHP, ['-d', 'SMTP=127.0.0.1', '-d', 'smtp_port=1027', '-S', '127.0.0.1:8767', 'tools/preview-router.php'], {
  env: { ...process.env, FOTOSHOOT_MAIL_ENABLED: 'true', FOTOSHOOT_RATE_DIRECTORY: mkdtempSync(join(tmpdir(), 'vanson-bot-test-')), FOTOSHOOT_TURNSTILE_SITE_KEY: 'registered-key-fixture', FOTOSHOOT_TURNSTILE_SECRET_KEY: 'private-secret-fixture' },
  stdio: 'ignore',
});
let browser;
const errors = [];
// Provider-UI en positieve POST-antwoorden zijn fixtures; PHP-verificatie heeft aparte tests.
const provider = `window.__bot = { renders: [], removed: [] };
window.turnstile = {
  render(root, options) {
    window.__bot.renders.push(options);
    window.__bot.current = options;
    const frame = document.createElement('div');
    frame.textContent = 'Testwidget — geen echte Cloudflare-controle';
    frame.style.width = options.size === 'compact' ? '150px' : '300px';
    root.append(frame);
    return String(window.__bot.renders.length);
  },
  remove(id) { window.__bot.removed.push(id); }
};`;
async function privateReview(page) {
  await page.goto(base + '/fotoshoot');
  await page.locator('#shoot-routes').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#shoot-bot-check').isVisible(), false);
  await page.getByRole('radio', { name: /Portretfotografie/ }).check();
  await page.locator('#shoot-next').click();
  await page.getByRole('radio', { name: /Mini Shoot/ }).check();
  await page.locator('#shoot-next').click();
  await page.locator('#shoot-name').fill('Test Klant');
  await page.locator('#shoot-email').fill('test@example.com');
  await page.locator('#shoot-date').fill('20-10-2099');
  await page.locator('#shoot-location').fill('In overleg');
  await page.locator('#shoot-next').click();
  await page.locator('#shoot-bot-check').waitFor({ state: 'visible' });
}
try {
  for (let attempt = 0; attempt < 50; attempt++) {
    try { if ((await fetch(base + '/api/fotoshoot.php')).ok) break; } catch {}
    await delay(100);
  }
  browser = await chromium.launch({ headless: true, channel: process.env.FOTOSHOOT_BROWSER || 'msedge' });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  let scripts = 0;
  await context.route('https://challenges.cloudflare.com/turnstile/v0/api.js*', route => {
    scripts++;
    return route.fulfill({ contentType: 'application/javascript', body: provider });
  });
  await page.goto(base + '/fotoshoot');
  await page.locator('#shoot-routes').waitFor({ state: 'visible' });
  assert.equal(scripts, 0, 'No third-party script on first steps');
  const init = await (await context.request.get(base + '/api/fotoshoot.php')).json();
  assert.deepEqual(init.captcha, { siteKey: 'registered-key-fixture', action: 'fotoshoot_request' });
  assert.equal(JSON.stringify(init).includes('private-secret-fixture'), false);
  const valid = { route: 'private', contact: { name: 'Test', email: 'test@example.com', date: '2099-10-20', location: 'In overleg' }, selection: { photography: 'portret', package: 'mini', extraPhotos: 0, rush: false }, expectedTotalCents: 6500, configVersion: init.configVersion, csrfToken: init.csrfToken, requestId: init.requestId, website: '' };
  for (const token of [undefined, '', [], 'bad token', 'x'.repeat(2049)]) {
    const response = await context.request.post(base + '/api/fotoshoot.php', { data: { ...valid, turnstileToken: token } });
    assert.equal(response.status(), 422);
    assert.equal((await response.json()).code, 'captcha');
  }
  assert.equal((await context.request.get(base + '/api/fotoshoot-turnstile.php')).status(), 403);
  console.log('PASS API requires tokens; secret and internal PHP file inaccessible');

  await privateReview(page);
  await page.waitForFunction(() => window.__bot?.current);
  assert.equal(scripts, 1);
  assert.equal(await page.locator('#shoot-next').isDisabled(), true);
  assert.equal(await page.evaluate(() => window.__bot.current.language), 'nl');
  assert.equal(await page.evaluate(() => window.__bot.current.action), 'fotoshoot_request');
  assert.equal(await page.evaluate(() => window.__bot.current['response-field']), false);
  await page.evaluate(() => window.__bot.current.callback('first-token'));
  assert.equal(await page.locator('#shoot-next').isEnabled(), true);
  await page.evaluate(() => window.__bot.current['expired-callback']());
  assert.equal(await page.locator('#shoot-next').isDisabled(), true);
  await page.locator('[data-bot-retry]').click();
  await page.waitForFunction(() => window.__bot.renders.length === 2);
  await page.evaluate(() => window.__bot.current['error-callback']());
  assert.equal(await page.locator('[data-bot-retry]').isVisible(), true);
  await page.locator('#shoot-prev').click();
  assert.equal(await page.locator('#shoot-bot-check').isVisible(), false);
  assert.equal(await page.locator('#shoot-name').inputValue(), 'Test Klant');
  await page.locator('#shoot-next').click();
  await page.waitForFunction(() => window.__bot.renders.length === 3);
  await page.evaluate(() => window.__bot.renders[0].callback('stale-token'));
  assert.equal(await page.locator('#shoot-next').isDisabled(), true, 'Removed widget cannot unlock sending');
  console.log('PASS Expiry, provider errors, back navigation and stale callbacks');

  const posts = [];
  await context.route('**/api/fotoshoot.php', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    posts.push(route.request().postDataJSON());
    return route.fulfill({ status: posts.length === 1 ? 502 : 200, contentType: 'application/json', body: JSON.stringify(posts.length === 1 ? { message: 'Test: mailtransport tijdelijk niet beschikbaar.' } : { success: true, reference: 'LOCAL-UI-TEST' }) });
  });
  await page.evaluate(() => window.__bot.current.callback('retry-token-1'));
  await page.locator('#shoot-next').click();
  await page.locator('#shoot-errors').waitFor({ state: 'visible' });
  await page.waitForFunction(() => window.__bot.renders.length === 4);
  assert.equal(await page.locator('#shoot-next').isDisabled(), true);
  assert.equal(await page.locator('#shoot-name').inputValue(), 'Test Klant');
  await page.evaluate(() => window.__bot.current.callback('retry-token-2'));
  await page.locator('#shoot-next').click();
  await page.locator('#shoot-success').waitFor({ state: 'visible' });
  assert.equal(posts[0].turnstileToken, 'retry-token-1');
  assert.equal(posts[1].turnstileToken, 'retry-token-2');
  assert.equal(posts[0].requestId, posts[1].requestId, 'Stable request prevents duplicate mail after an unknown outcome');
  assert.equal(await page.locator('#shoot-bot-check').isVisible(), false);
  console.log('PASS Submission retry needs new token, retains values and request reference');

  const mobile = await context.newPage();
  mobile.on('pageerror', error => errors.push(error.message));
  await mobile.setViewportSize({ width: 320, height: 780 });
  await privateReview(mobile);
  await mobile.waitForFunction(() => window.__bot?.current);
  assert.equal(await mobile.evaluate(() => window.__bot.current.size), 'compact');
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await mobile.locator('[data-route="business"]').click();
  assert.equal(await mobile.locator('#shoot-bot-check').isVisible(), false);
  await mobile.locator('#shoot-category').selectOption('anders');
  await mobile.locator('#shoot-subject').fill('Zakelijke reportage');
  await mobile.locator('#shoot-scope').fill('10 beelden');
  await mobile.locator('#shoot-period').fill('In overleg');
  await mobile.locator('#shoot-businessLocation').fill('In overleg');
  await mobile.locator('#shoot-usage').fill('Website');
  await mobile.locator('#shoot-next').click();
  await mobile.locator('#shoot-next').click();
  await mobile.locator('#shoot-bot-check').waitFor({ state: 'visible' });
  assert.equal(await mobile.locator('#shoot-next').isDisabled(), true);
  console.log('PASS 320px mobile layout and business route also require verification');

  const offline = await browser.newContext();
  await offline.route('https://challenges.cloudflare.com/**', route => route.abort());
  const blocked = await offline.newPage();
  blocked.on('pageerror', error => errors.push(error.message));
  await privateReview(blocked);
  await blocked.locator('[data-bot-retry]').waitFor({ state: 'visible' });
  assert.equal(await blocked.locator('#shoot-next').isDisabled(), true);
  await offline.unroute('https://challenges.cloudflare.com/**');
  await offline.route('https://challenges.cloudflare.com/turnstile/v0/api.js*', route => route.fulfill({ contentType: 'application/javascript', body: provider }));
  await blocked.locator('[data-bot-retry]').click();
  await blocked.waitForFunction(() => window.__bot?.current);
  await blocked.evaluate(() => window.__bot.current.callback('recovered-token'));
  assert.equal(await blocked.locator('#shoot-next').isEnabled(), true);
  assert.deepEqual(errors, []);
  console.log('PASS Blocked provider script can recover without losing the form');
  console.log('6 Turnstile browser/API groups passed (provider fixtures; no external mail).');
} finally {
  await browser?.close();
  server.kill();
}
