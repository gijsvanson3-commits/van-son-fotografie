import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const php = process.env.FOTOSHOOT_PHP;
assert.ok(php, 'Set FOTOSHOOT_PHP');
const base = 'http://127.0.0.1:8766';
const mail = [];
const decodeMail = raw => Buffer.from(raw.replace(/=\r?\n/g, '').replace(/=([a-f0-9]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))), 'latin1').toString('utf8');
const smtp = createServer(socket => {
  socket.setEncoding('utf8');
  socket.write('220 localhost test mail capture\r\n');
  let buffer = '', data = false, message = '';
  socket.on('data', chunk => {
    buffer += chunk;
    while (buffer.includes('\n')) {
      const at = buffer.indexOf('\n');
      const line = buffer.slice(0, at).replace(/\r$/, '');
      buffer = buffer.slice(at + 1);
      if (data) {
        if (line === '.') { mail.push(decodeMail(message)); message = ''; data = false; socket.write('250 captured locally\r\n'); }
        else message += line + '\n';
      } else if (/^DATA/i.test(line)) { data = true; socket.write('354 send data\r\n'); }
      else if (/^QUIT/i.test(line)) { socket.end('221 bye\r\n'); }
      else socket.write('250 OK\r\n');
    }
  });
});
await new Promise(resolve => smtp.listen(1026, '127.0.0.1', resolve));
const rate = mkdtempSync(join(tmpdir(), 'vanson-test-rate-'));
const server = spawn(php, ['-d', 'SMTP=127.0.0.1', '-d', 'smtp_port=1026', '-d', 'sendmail_from=test@example.com', '-S', '127.0.0.1:8766', 'tools/preview-router.php'], { env: { ...process.env, FOTOSHOOT_MAIL_ENABLED: 'true', FOTOSHOOT_RATE_DIRECTORY: rate }, stdio: ['ignore', 'ignore', 'pipe'] });
let serverErrors = '';
server.stderr.on('data', chunk => { serverErrors += chunk; });
let browser;
const errors = [];
const checks = [];
const ok = label => { checks.push(label); console.log('PASS ' + label); };
const post = (context, payload, headers = {}) => context.request.post(`${base}/api/fotoshoot.php`, { data: payload, headers });
const contact = { name: 'Test Klant', email: 'test@example.com', phone: '', date: '2099-10-20', location: 'In overleg', comments: 'Een lokale test.' };
try {
  for (let count = 0; count < 50; count++) {
    try { if ((await fetch(base + '/fotoshoot')).ok) break; } catch {}
    await delay(100);
  }
  browser = await chromium.launch({ headless: true, channel: process.env.FOTOSHOOT_BROWSER || 'msedge' });
  const context = await browser.newContext({ viewport: { width: 1366, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/fotoshoot');
  await page.locator('#shoot-routes').waitFor({ state: 'visible' });
  mkdirSync('.local', { recursive: true });
  await page.screenshot({ path: '.local/fotoshoot-desktop.png', fullPage: true });
  await page.locator('[data-route="private"]').click();
  await page.getByRole('button', { name: 'Verder', exact: true }).click();
  await assert.equal(await page.locator('#shoot-errors').isVisible(), true);
  assert.equal(await page.locator('[name="photography"]').count(), 2);
  assert.equal(await page.locator('[data-panel="type"] img').count(), 0);
  ok('Required photography choice, portrait photo absent and automotive unavailable');
  await page.getByRole('radio', { name: /Portretfotografie/ }).check();
  await page.getByRole('button', { name: 'Verder', exact: true }).click();
  assert.equal(await page.locator('[name="package"]').count(), 2);
  assert.equal(await page.locator('.shoot-package-badge').innerText(), "Meer foto's");
  assert.match(await page.locator('.shoot-package-upgrade').innerText(), /€\s*24 extra.*5 extra/);
  assert.match(await page.locator('[data-panel="package"]').innerText(), /Complexe retouchering/);
  assert.equal(await page.locator('[data-panel="package"] > legend').innerText(), 'Kies jouw fotoshoot');
  assert.match(await page.locator('[data-panel="package"]').innerText(), /7 werkdagen na jouw fotokeuze/);
  assert.match(await page.locator('[data-panel="package"]').innerText(), /2 werkdagen na jouw fotokeuze/);
  for (const label of await page.locator('#shoot-package-choices .shoot-choice').allInnerTexts()) {
    assert.match(label, /persoonlijke online selectiegalerij/);
    assert.match(label, /nabewerkte foto's naar keuze/);
    assert.match(label, /Digitale oplevering in hoge resolutie/);
  }
  assert.equal(await page.getByText('Eventuele reiskosten buiten het standaard werkgebied spreken we vooraf af.', { exact: true }).filter({ visible: true }).count(), 1);
  assert.equal(await page.getByText('De totaalprijs en je boeking zijn pas definitief na mijn persoonlijke bevestiging.', { exact: true }).filter({ visible: true }).count(), 1);
  assert.match(await page.locator('#shoot-summary').innerText(), /Alle prijzen zijn totaalprijzen\./);
  await page.getByRole('radio', { name: /Mini Shoot/ }).check();
  await page.locator('#shoot-extraPhotos').fill('2');
  assert.match(await page.locator('#shoot-summary-price').innerText(), /€\s*89/);
  await page.getByRole('radio', { name: /Standaard/ }).check();
  assert.match(await page.locator('#shoot-summary-price').innerText(), /€\s*113/);
  assert.match(await page.locator('[data-panel="package"]').innerText(), /afhankelijk van beschikbaarheid/);
  await page.locator('#shoot-extraPhotos').fill('2');
  await page.locator('[name="rush"]').check();
  assert.match(await page.locator('#shoot-summary').innerText(), /€\s*148/);
  assert.match(await page.locator('#shoot-summary').innerText(), /reiskosten buiten het standaard werkgebied/);
  assert.match(await page.locator('#shoot-summary').innerText(), /persoonlijke bevestiging/);
  await page.locator('#shoot-prev').click();
  assert.equal(await page.locator('[name="photography"]:checked').inputValue(), 'portret');
  await page.locator('#shoot-next').click();
  assert.equal(await page.locator('[name="package"]:checked').inputValue(), 'standaard');
  assert.equal(await page.locator('#shoot-extraPhotos').inputValue(), '2');
  ok('Live price (€148) and back navigation preserve choices');
  await page.screenshot({ path: '.local/fotoshoot-desktop-package.png', fullPage: true });
  await page.locator('#shoot-next').click();
  await page.getByRole('button', { name: 'Open kalender voor Gewenste datum', exact: true }).click();
  const calendar = page.locator('#shoot-date-calendar');
  await calendar.getByLabel('Jaar', { exact: true }).selectOption('2099');
  await calendar.getByLabel('Maand', { exact: true }).selectOption('9');
  await page.screenshot({ path: '.local/fotoshoot-calendar-desktop.png', fullPage: true });
  await calendar.locator('[data-date="2099-10-20"]').click();
  assert.equal(await page.locator('#shoot-date').inputValue(), '20-10-2099');
  assert.equal(await calendar.isVisible(), false);
  await page.getByRole('button', { name: 'Open kalender voor Gewenste datum', exact: true }).click();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#shoot-date').inputValue(), '21-10-2099');
  await page.getByRole('button', { name: 'Open kalender voor Gewenste datum', exact: true }).click();
  await page.keyboard.press('Escape');
  assert.equal(await calendar.isVisible(), false);
  await page.locator('#shoot-date').fill('31-02-2099');
  await page.locator('#shoot-next').click();
  assert.match(await page.locator('#shoot-errors').innerText(), /geldige datum/);
  ok('Dutch calendar selection, keyboard navigation, Escape and invalid date validation');
  await page.locator('#shoot-name').fill(contact.name);
  await page.locator('#shoot-email').fill(contact.email);
  await page.locator('#shoot-date').fill(contact.date);
  await page.locator('#shoot-location').fill(contact.location);
  await page.locator('#shoot-comments').fill('<script>alert("test")</script>');
  await page.locator('#shoot-next').click();
  assert.match(await page.locator('#shoot-review').innerText(), /<script>/);
  assert.equal(await page.locator('#shoot-summary').isVisible(), false);
  assert.match(await page.locator('#shoot-review').innerText(), /2 werkdagen na jouw fotokeuze/);
  assert.match(await page.locator('#shoot-review').innerText(), /Alle prijzen zijn totaalprijzen\./);
  assert.equal(await page.getByText('Eventuele reiskosten buiten het standaard werkgebied spreken we vooraf af.', { exact: true }).filter({ visible: true }).count(), 1);
  assert.equal(await page.locator('#shoot-review script').count(), 0);
  let captured;
  page.on('request', request => { if (request.method() === 'POST') captured = request.postDataJSON(); });
  await page.locator('#shoot-next').click();
  await page.locator('#shoot-success').waitFor({ state: 'visible' });
  assert.equal(mail.length, 1);
  assert.match(mail[0], /Fotoshootaanvraag/);
  assert.match(mail[0], /Reply-To: test@example.com/i);
  assert.match(mail[0], /Standaard Shoot/);
  assert.match(mail[0], /Digitale oplevering in hoge resolutie/);
  assert.match(mail[0], /persoonlijke online selectiegalerij/);
  assert.match(mail[0], /10 naar keuze/);
  assert.match(mail[0], /2 werkdagen na jouw fotokeuze/);
  assert.match(mail[0], /Alle prijzen zijn totaalprijzen\./);
  assert.match(mail[0], /afhankelijk van beschikbaarheid/);
  assert.match(mail[0], /148/);
  assert.match(mail[0], /reiskosten buiten het standaard werkgebied/);
  const replay = await post(context, captured);
  assert.equal(replay.status(), 200);
  assert.equal(mail.length, 1);
  ok('Private submission, escaped review, full email and duplicate prevention');

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const mobile = await mobileContext.newPage();
  mobile.on('pageerror', error => errors.push(error.message));
  await mobile.goto(base + '/fotoshoot');
  await mobile.locator('#shoot-routes').waitFor({ state: 'visible' });
  await mobile.screenshot({ path: '.local/fotoshoot-mobile.png', fullPage: true });
  await mobile.locator('[data-route="business"]').click();
  await mobile.locator('#shoot-category').selectOption('evenement');
  const eventRadios = mobile.locator('[data-category="evenement"] input[type="radio"]');
  assert.equal(await eventRadios.count(), 3);
  const labels = await eventRadios.evaluateAll(inputs => inputs.map(input => input.closest('label').innerText));
  assert.deepEqual(labels, ['Sfeerbeelden van het evenement', "Groepsfoto's tijdens het evenement", "Beide: sfeerbeelden en groepsfoto's"]);
  await eventRadios.nth(2).check();
  await mobile.locator('#shoot-eventName').fill('Test verjaardagsfeest');
  await mobile.locator('#shoot-eventDate').fill('2099-10-20');
  await mobile.locator('#shoot-visitors').fill('80');
  await mobile.locator('#shoot-eventLocation').fill('Testlocatie');
  await mobile.locator('#shoot-startTime').fill('20:00');
  await mobile.locator('#shoot-endTime').fill('01:00');
  await mobile.locator('#shoot-endDate').fill('2099-10-21');
  await mobile.locator('#shoot-category').selectOption('horeca');
  await mobile.locator('[name="subjects"][value="0"]').check();
  await mobile.locator('#shoot-category').selectOption('evenement');
  assert.equal(await eventRadios.nth(2).isChecked(), true);
  assert.equal(await mobile.locator('#shoot-eventName').inputValue(), 'Test verjaardagsfeest');
  assert.equal(await mobile.locator('#shoot-summary').isVisible(), false);
  assert.equal(await mobile.locator('#shoot-workspace').innerText().then(text => text.includes('€')), false);
  ok('Exact event options, category state retained, no business prices');
  await mobile.screenshot({ path: '.local/fotoshoot-mobile-event.png', fullPage: true });
  await mobile.locator('#shoot-next').click();
  await mobile.locator('#shoot-name').fill(contact.name);
  await mobile.locator('#shoot-email').fill(contact.email);
  await mobile.locator('#shoot-next').click();
  assert.match(await mobile.locator('#shoot-review').innerText(), /2099-10-21 01:00/);
  await mobile.getByRole('button', { name: 'Verstuur mijn offerteaanvraag', exact: true }).click();
  await mobile.locator('#shoot-success').waitFor({ state: 'visible' });
  assert.equal(mail.length, 2);
  assert.ok(!mail[1].includes('Pakketprijs'));
  ok('Mobile event request spanning midnight and quote email');

  await page.goto(base + '/fotoshoot');
  await page.locator('[data-route="business"]').click();
  await page.locator('#shoot-category').selectOption('horeca');
  await page.locator('#shoot-next').click();
  assert.match(await page.locator('#shoot-errors').innerText(), /minimaal één onderwerp/);
  await page.locator('[name="subjects"][value="0"]').check();
  await page.locator('[name="subjects"][value="1"]').check();
  await page.locator('#shoot-subject').fill('Seizoensmenu en restaurant');
  await page.locator('#shoot-scope').fill('10 gerechten, 2 ruimtes');
  await page.locator('#shoot-period').fill('In overleg');
  await page.locator('#shoot-businessLocation').fill('Test restaurant');
  await page.locator('#shoot-usage').fill('Website en menukaart');
  await page.locator('#shoot-next').click();
  await page.locator('#shoot-name').fill(contact.name);
  await page.locator('#shoot-email').fill(contact.email);
  await page.locator('#shoot-company').fill('Test Restaurant');
  await page.locator('#shoot-next').click();
  await page.locator('#shoot-next').click();
  await page.locator('#shoot-success').waitFor({ state: 'visible' });
  assert.equal(mail.length, 3);
  assert.match(mail[2], /Interieur/);
  ok('Hospitality multiselect validation and full quote submission');

  const init = await (await context.request.get(base + '/api/fotoshoot.php')).json();
  const valid = { ...init, route: 'private', contact, selection: { photography: 'koppel', package: 'mini', extraPhotos: 0, rush: false }, expectedTotalCents: 6500, website: '' };
  delete valid.config;
  for (const [change, status] of [[{ csrfToken: 'wrong' }, 403], [{ expectedTotalCents: 1 }, 422], [{ configVersion: 'old' }, 409], [{ website: 'bot' }, 422]]) assert.equal((await post(context, { ...valid, ...change })).status(), status);
  assert.equal((await post(context, valid, { Origin: 'https://evil.example' })).status(), 403);
  assert.equal((await context.request.post(base + '/api/fotoshoot.php', { data: '{broken', headers: { 'Content-Type': 'application/json' } })).status(), 400);
  assert.equal((await context.request.post(base + '/api/fotoshoot.php', { data: 'a'.repeat(33000), headers: { 'Content-Type': 'application/json' } })).status(), 413);
  ok('HTTP CSRF, price tampering, stale config, honeypot, origin, malformed and oversized requests');
  assert.equal((await post(context, valid)).status(), 200);
  assert.equal(mail.length, 4);
  await new Promise(resolve => smtp.close(resolve));
  const failInit = await (await context.request.get(base + '/api/fotoshoot.php')).json();
  assert.equal((await post(context, { ...valid, csrfToken: failInit.csrfToken, requestId: failInit.requestId })).status(), 502);
  assert.equal((await post(context, { ...valid, csrfToken: failInit.csrfToken, requestId: failInit.requestId })).status(), 429);
  ok('Mail transport failure never reports success; IP rate limit enforced');
  const disabledContext = await browser.newContext();
  const disabledInit = await (await disabledContext.request.get('http://127.0.0.1:8765/api/fotoshoot.php')).json();
  const disabled = await disabledContext.request.post('http://127.0.0.1:8765/api/fotoshoot.php', { data: { ...valid, csrfToken: disabledInit.csrfToken, requestId: disabledInit.requestId } });
  assert.equal(disabled.status(), 503);
  ok('Unconfigured production mail stays disabled');

  for (const width of [320, 375, 390, 768, 1366]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + '/fotoshoot');
    await page.locator('#shoot-routes').waitFor({ state: 'visible' });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Landing overflows at ${width}px`);
    await page.locator('[data-route="private"]').click();
    await page.locator('[name="photography"][value="koppel"]').check();
    await page.locator('#shoot-next').click();
    await page.locator('[name="package"][value="standaard"]').check();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Packages overflow at ${width}px`);
    if (width === 390) await page.screenshot({ path: '.local/fotoshoot-mobile-package.png', fullPage: true });
    await page.locator('#shoot-next').click();
    await page.getByRole('button', { name: 'Open kalender voor Gewenste datum', exact: true }).click();
    const dateCalendar = page.locator('#shoot-date-calendar');
    assert.equal(await dateCalendar.isVisible(), true);
    assert.equal(await dateCalendar.locator('[data-date]:disabled').count() > 0, true);
    const box = await dateCalendar.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width, `Calendar overflows at ${width}px`);
    if (width === 390) await page.screenshot({ path: '.local/fotoshoot-calendar-mobile.png', fullPage: true });
    await page.keyboard.press('Escape');
    await page.locator('[data-route="business"]').click();
    await page.locator('#shoot-category').selectOption('evenement');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Event form overflows at ${width}px`);
  }
  ok('Landing, packages and event form fit 320, 375, 390, 768 and 1366px');
  await page.goto(base + '/fotoshoot');
  await page.locator('#shoot-routes').waitFor({ state: 'visible' });
  await page.locator('[data-route="private"]').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('[name="photography"][value="portret"]').evaluate(element => element === document.activeElement), true);
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.locator('[name="photography"][value="koppel"]').isChecked(), true);
  await page.locator('#shoot-next').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('[data-panel="package"] > legend').evaluate(element => element === document.activeElement), true);
  for (const pack of ['mini', 'standaard']) {
    await page.locator(`[name="package"][value="${pack}"]`).check();
    assert.equal(await page.locator('#shoot-summary-price').innerText(), await page.locator('#shoot-package-price').innerText());
  }
  await page.locator('#shoot-next').click();
  for (const phone of ['+31 (0)6 1234-5678', '0612345678', '']) {
    await page.locator('#shoot-phone').fill(phone);
    await page.locator('#shoot-next').click();
    assert.ok(!(await page.locator('#shoot-errors').innerText()).includes('Telefoonnummer:'), phone);
  }
  await page.locator('#shoot-phone').fill('abc');
  await page.locator('#shoot-next').click();
  assert.match(await page.locator('#shoot-errors').innerText(), /Telefoonnummer/);
  assert.equal(await page.locator('#shoot-errors').evaluate(element => element === document.activeElement), true);
  await page.locator('[data-route="business"]').click();
  for (const category of ['branding', 'zakelijk-portret', 'product', 'campagne', 'anders']) {
    await page.locator('#shoot-category').selectOption(category);
    assert.equal(await page.locator('[data-category="other"]').isVisible(), true);
    assert.equal(await page.locator('[data-category="evenement"]').isVisible(), false);
    assert.equal(await page.locator('[data-category="horeca"]').isVisible(), false);
  }
  await page.locator('[data-route="private"]').click();
  await page.locator('[name="photography"][value="koppel"]').check();
  await page.locator('#shoot-next').click();
  await page.locator('[name="package"][value="mini"]').check();
  assert.match(await page.locator('#shoot-summary-price').innerText(), /€\s*65/);
  await page.locator('#shoot-prev').click();
  await page.locator('[name="photography"][value="portret"]').check();
  await page.locator('#shoot-next').click();
  assert.equal(await page.locator('[name="package"]:checked').inputValue(), 'mini');
  ok('Keyboard navigation, focus, phone validation, photography changes and all business categories');
  for (const route of ['/', '/galerij', '/blogs', '/blogs/evenementen-fotografie', '/blogs/verjaardag-fotoshoot']) {
    const response = await page.goto(base + route);
    assert.equal(response.status(), 200, route);
    assert.equal(await page.locator('.topbar a[href="/fotoshoot"]').innerText(), 'Prijscalculator');
    if (route === '/') {
      await page.locator('#commercial .button').waitFor();
      assert.equal(await page.locator('[data-slider]').count(), 2);
      await page.locator('[data-slider]').first().locator('[data-direction="next"]').click();
    }
    if (route === '/galerij') { await page.locator('.gallery-card').first().waitFor(); await page.locator('[data-filter="kunst"]').click(); }
  }
  assert.deepEqual(errors, []);
  ok('All existing pages, sliders and gallery filter load without JS errors');
  console.log(`\n${checks.length} browser/integration groups passed; ${mail.length} emails captured locally.`);
} finally {
  await browser?.close();
  server.kill();
  smtp.close();
}

