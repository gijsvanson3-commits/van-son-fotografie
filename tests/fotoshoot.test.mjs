import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { calculatePrice, formatMoney, getPackages, getPackageUpgrade } from '../fotoshoot-model.js';
import { parseDate, formatDate, validateDateInput } from '../fotoshoot-calendar.js';
const config = JSON.parse(readFileSync(new URL('../assets/config/fotoshoot.json', import.meta.url)));
test('Client and PHP server agree for every type, package and extras combination', () => {
  assert.ok(process.env.FOTOSHOOT_PHP, 'Set FOTOSHOOT_PHP to php executable');
  const result = spawnSync(process.env.FOTOSHOOT_PHP, ['tests/fotoshoot.test.php', '--matrix'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const matrix = JSON.parse(result.stdout);
  assert.equal(matrix.length, config.photography.length * config.packages.length * 3 * 2 + 1);
  for (const { selection, totalCents, config: custom } of matrix) assert.equal(calculatePrice(custom || config, selection).totalCents, totalCents);
});
test('Invalid selections cannot produce a price', () => {
  const selection = { photography: 'portret', package: 'mini', extraPhotos: 0, rush: false };
  for (const change of [{ extraPhotos: -1 }, { extraPhotos: 101 }, { extraPhotos: 1.5 }, { extraPhotos: NaN }, { extraPhotos: '2' }, { rush: 'false' }, { package: 'fake' }, { photography: 'evenement' }, { package: 'premium' }, { photography: 'automotive' }]) assert.equal(calculatePrice(config, { ...selection, ...change }), null);
});
test('Dutch money formatting and total photos', () => {
  assert.equal(formatMoney(6500), '€ 65');
  assert.equal(formatMoney(1250), '€ 12,50');
  assert.equal(calculatePrice(config, { photography: 'koppel', package: 'standaard', extraPhotos: 2, rush: true }).totalPhotos, 12);
});

test('Dutch calendar dates, leap years, ISO payload and minimum date', () => {
  for (const value of ['29-02-2028', '29/02/2028', '29.02.2028', '2028-02-29']) assert.equal(parseDate(value), '2028-02-29');
  assert.equal(parseDate('1-3-2028'), '2028-03-01');
  for (const value of ['29-02-2027', '31-04-2028', '2028-13-01', 'not a date', '']) assert.equal(parseDate(value), '');
  assert.equal(formatDate('2099-10-20'), '20-10-2099');
  let message = '';
  const input = { value: '19-10-2099', dataset: { dateMin: '2099-10-20' }, setCustomValidity: value => { message = value; } };
  validateDateInput(input, '2099-10-18');
  assert.match(message, /20-10-2099/);
  input.value = '32-10-2099';
  validateDateInput(input, '2099-10-18');
  assert.match(message, /geldige datum/);
});

test('Requested examples and accurate package comparison', () => {
  for (const photography of ['portret', 'koppel']) {
    assert.equal(calculatePrice(config, { photography, package: 'mini', extraPhotos: 2, rush: false }).totalCents, 8900);
    assert.equal(calculatePrice(config, { photography, package: 'standaard', extraPhotos: 2, rush: false }).totalCents, 11300);
    assert.equal(calculatePrice(config, { photography, package: 'standaard', extraPhotos: 2, rush: true }).totalCents, 14800);
  }
  const packages = getPackages(config, 'portret');
  assert.deepEqual(getPackageUpgrade(packages, packages[1]), { extraCents: 2400, extraPhotos: 5 });
  assert.equal(getPackageUpgrade(packages, { ...packages[1], minutes: 60 }), null);
  const custom = structuredClone(config);
  custom.photography[0].packageIds = ['mini'];
  custom.photography[0].packageOverrides = { mini: { priceCents: 7900 } };
  assert.equal(getPackages(custom, 'portret')[0].priceCents, 7900);
  assert.equal(calculatePrice(custom, { photography: 'portret', package: 'standaard', extraPhotos: 0, rush: false }), null);
  assert.equal(calculatePrice(custom, { photography: 'koppel', package: 'standaard', extraPhotos: 0, rush: false }).totalCents, 8900);
});
