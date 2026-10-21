import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeReply, filterDosingPatterns } from '../src/sanitize.ts';

test('sanitizeReply turns a markdown link into its link text', () => {
  assert.equal(
    sanitizeReply('Read [the stroke guide](https://example.com/guide) today'),
    'Read the stroke guide today',
  );
});

test('sanitizeReply strips HTML tags but keeps the text', () => {
  assert.equal(
    sanitizeReply('<p>Hello <strong>stroke</strong> care</p>'),
    'Hello stroke care',
  );
});

test('sanitizeReply replaces a bare URL with [link omitted]', () => {
  assert.equal(
    sanitizeReply('More at https://example.com/page today'),
    'More at [link omitted] today',
  );
});

test('sanitizeReply replaces a www URL with [link omitted]', () => {
  assert.equal(
    sanitizeReply('More at www.example.com today'),
    'More at [link omitted] today',
  );
});

test('sanitizeReply leaves normal text untouched', () => {
  const input = 'Stroke is a medical emergency. Call 119 immediately.';
  assert.equal(sanitizeReply(input), input);
});

test('filterDosingPatterns leaves text without dosing patterns untouched', () => {
  const input = 'Rest well and drink enough water';
  assert.equal(filterDosingPatterns(input), input);
});

test('W-06: the canonical dosing instruction is still removed', () => {
  const out = filterDosingPatterns('Take 81 mg twice daily.');
  assert.ok(out.includes('[dosing detail removed]'));
  assert.ok(!out.includes('81 mg'));
});

test('W-06: a number word amount is removed', () => {
  const out = filterDosingPatterns('Take two 81 mg aspirin tablets each morning.');
  assert.ok(out.includes('[dosing detail removed]'));
  assert.ok(!out.includes('81 mg'));
});

test('W-06: a spelled-out amount and unit is removed', () => {
  const out = filterDosingPatterns('Take one hundred milligrams with water.');
  assert.ok(out.includes('[dosing detail removed]'));
  assert.ok(!out.includes('milligrams'));
});

test('W-06: a dual therapy duration regimen is removed', () => {
  const out = filterDosingPatterns('The usual regimen is aspirin 81 mg plus clopidogrel 75 mg for 21 days.');
  assert.ok(out.includes('[dosing detail removed]'));
  assert.ok(!out.includes('for 21 days'));
  assert.ok(!out.includes('75 mg'));
});

test('W-06: an Indonesian dosing instruction is removed', () => {
  const out = filterDosingPatterns('Minum aspirin 80 mg sekali sehari sesudah makan.');
  assert.ok(out.includes('[dosing detail removed]'));
  assert.ok(!out.includes('80 mg'));
});

test('W-06: a fully spelled-out unit with a schedule is removed', () => {
  const out = filterDosingPatterns('Start metformin 500 milligrams twice a day with food.');
  assert.ok(out.includes('[dosing detail removed]'));
  assert.ok(!out.includes('500 milligrams'));
});

test('W-06: weight-based dosing is removed', () => {
  const out = filterDosingPatterns(
    'Thrombolysis dosing is 0.9 mg per kilogram of body weight, capped at 90 mg total.',
  );
  assert.ok(out.includes('[dosing detail removed]'));
  assert.ok(!out.includes('per kilogram'));
});

test('W-06: the mg/kg slash form is removed', () => {
  const out = filterDosingPatterns('The infusion runs at 0.9 mg/kg over one hour.');
  assert.ok(out.includes('[dosing detail removed]'));
});

test('W-06: a loading and maintenance list format is removed', () => {
  const out = filterDosingPatterns('Aspirin: 300 mg loading, then 75 mg maintenance.');
  assert.ok(out.includes('[dosing detail removed]'));
  assert.ok(!out.includes('300 mg'));
  assert.ok(!out.includes('75 mg'));
});

test('W-06: conservative on education text that names a medicine without advice', () => {
  const input = 'Aspirin is discussed in secondary prevention guidelines';
  assert.equal(filterDosingPatterns(input), input);
});

test('W-06: conservative on a strength mentioned in passing without a schedule', () => {
  const input = 'The lesson mentions the 81 mg tablet strength used in many studies.';
  assert.equal(filterDosingPatterns(input), input);
});
