import { test } from 'node:test';
import assert from 'node:assert/strict';

import { redactPii } from '../src/redact.ts';

test('redactPii redacts an email address and counts it', () => {
  const { text, count } = redactPii('Contact me at daivan.febri@example.com please');
  assert.equal(count, 1);
  assert.ok(!text.includes('daivan.febri@example.com'));
});

test('redactPii redacts an Indonesian +62 phone number and counts it', () => {
  const { text, count } = redactPii('Call +6281234567890 tomorrow morning');
  assert.equal(count, 1);
  assert.ok(!text.includes('+6281234567890'));
  assert.ok(!text.includes('81234567890'));
});

test('redactPii redacts a 16 digit NIK and counts it', () => {
  const { text, count } = redactPii('NIK 3201234567890001 is recorded in the file');
  assert.equal(count, 1);
  assert.ok(!text.includes('3201234567890001'));
});

test('redactPii counts every redaction in a combined text', () => {
  const input =
    'Email daivan.febri@example.com, phone +6281234567890, NIK 3201234567890001.';
  const { text, count } = redactPii(input);
  assert.equal(count, 3);
  assert.ok(!text.includes('daivan.febri@example.com'));
  assert.ok(!text.includes('+6281234567890'));
  assert.ok(!text.includes('3201234567890001'));
});

test('redactPii leaves clean text unchanged with a zero count', () => {
  const input = 'The patient exercises every morning and drinks enough water';
  const { text, count } = redactPii(input);
  assert.equal(text, input);
  assert.equal(count, 0);
});

test('W-04: redactPii redacts a space-grouped NIK completely, including the last group', () => {
  const { text, count } = redactPii('NIK saya 3201 1234 5678 9001 tolong dicatat.');
  assert.ok(count >= 1);
  assert.ok(text.includes('[national id removed]'));
  assert.ok(!text.includes('9001'));
  assert.ok(!text.includes('3201'));
});

test('W-04: redactPii redacts a hyphen-grouped NIK completely', () => {
  const { text } = redactPii('NIK 3201-1234-5678-9001 tercatat di berkas.');
  assert.ok(text.includes('[national id removed]'));
  assert.ok(!text.includes('9001'));
});

test('W-04: a grouped local phone is redacted as a phone, not partially as a NIK', () => {
  const { text, count } = redactPii('Call 0812 3456 7890 tomorrow');
  assert.equal(count, 1);
  assert.ok(text.includes('[phone number removed]'));
  assert.ok(!text.includes('[national id removed]'));
});

test('W-05: MR as magnetic resonance is not redacted', () => {
  const input = 'MR angiography showed a left MCA occlusion.';
  const { text, count } = redactPii(input);
  assert.equal(text, input);
  assert.equal(count, 0);
});

test('W-05: MR grade wording is not redacted', () => {
  const input = 'The MR grade 3 lesion was discussed in class.';
  const { text, count } = redactPii(input);
  assert.equal(text, input);
  assert.equal(count, 0);
});

test('W-05: the honorific Mr is not redacted', () => {
  const input = 'The patient, Mr Hartono, was discharged yesterday.';
  const { text, count } = redactPii(input);
  assert.equal(text, input);
  assert.equal(count, 0);
});

test('W-05: a labelled medical record number followed by digits is still redacted', () => {
  const en = redactPii('MR No. 123456 was recorded in the chart.');
  assert.equal(en.count, 1);
  assert.ok(en.text.includes('[medical record number removed]'));
  assert.ok(!en.text.includes('123456'));
  const id = redactPii('Nomor rekam medis: 00981234 sudah dibuat.');
  assert.equal(id.count, 1);
  assert.ok(!id.text.includes('00981234'));
});

test('W-05: the words rekam medis without a following number are not redacted', () => {
  const input = 'Berkas rekam medis pasien dibahas di kelas.';
  const { text, count } = redactPii(input);
  assert.equal(text, input);
  assert.equal(count, 0);
});

test('W-09: an Indonesian phone written as a bare 628 number is redacted', () => {
  const { text, count } = redactPii('Call my family at 6281234567890 if needed.');
  assert.equal(count, 1);
  assert.ok(text.includes('[phone number removed]'));
  assert.ok(!text.includes('6281234567890'));
});

test('W-10: an Indonesian birth date with the short label lahir is redacted', () => {
  const { text, count } = redactPii('Pasien lahir 12/03/1985 dan tinggal di Ngawi.');
  assert.equal(count, 1);
  assert.ok(text.includes('[date of birth removed]'));
  assert.ok(!text.includes('12/03/1985'));
});

test('W-10: tgl lahir label is redacted', () => {
  const { text, count } = redactPii('tgl lahir 03/12/1985, alamat Ngawi.');
  assert.equal(count, 1);
  assert.ok(!text.includes('03/12/1985'));
});

test('W-11: bare clinical ISO dates (onset, last known well) are left intact', () => {
  const input = 'Symptoms began 2026-10-18 and last known well was 2026-10-18 at 06:30.';
  const { text, count } = redactPii(input);
  assert.equal(text, input);
  assert.equal(count, 0);
});

test('W-11: a labelled ISO date of birth is still redacted', () => {
  const { text, count } = redactPii('DOB: 1985-03-12, admitted for observation.');
  assert.equal(count, 1);
  assert.ok(!text.includes('1985-03-12'));
});

test('control: clinical numbers and doses mentioned in passing are untouched', () => {
  const input = 'The class discussed aspirin 81 mg and a BP of 120/80, WBC 11.500, platelets 250.000.';
  const { text, count } = redactPii(input);
  assert.equal(text, input);
  assert.equal(count, 0);
});
