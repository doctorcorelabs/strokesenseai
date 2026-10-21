import { describe, expect, it } from 'vitest';
import { detectPii, maskPii } from './pii';

describe('maskPii', () => {
  it('masks an email address and reports it', () => {
    const result = maskPii('Send the summary to budi.santoso@example.com tomorrow.');
    expect(result.text).toBe('Send the summary to [email removed] tomorrow.');
    expect(result.counts).toEqual({ email: 1 });
    expect(result.matches[0]?.original).toBe('budi.santoso@example.com');
  });

  it('masks Indonesian and international phone numbers', () => {
    expect(maskPii('Call 0812-3456-7890 after rounds.').text).toBe(
      'Call [phone number removed] after rounds.',
    );
    expect(maskPii('Call +62 812 3456 7890 after rounds.').text).toBe(
      'Call [phone number removed] after rounds.',
    );
    expect(maskPii('Reachable on 6281234567890.').counts.phone).toBe(1);
  });

  it('masks labelled medical record numbers in English and Indonesian', () => {
    expect(maskPii('MRN: 00-4521, left MCA infarct.').text).toBe(
      '[medical record number removed], left MCA infarct.',
    );
    expect(maskPii('No. RM: 123456, kontrol ulang.').text).toBe(
      '[medical record number removed], kontrol ulang.',
    );
    expect(maskPii('Nomor rekam medis 88-2210 terlampir.').counts['medical-record']).toBe(1);
  });

  it('does not treat clinical uses of MR or the honorific Mr as record numbers', () => {
    const text = 'MR angiography showed an M1 occlusion, MR grade 3.';
    const result = maskPii(text);
    expect(result.text).toBe(text);
    expect(result.total).toBe(0);
  });

  it('masks a 16 digit national id, contiguous and grouped', () => {
    expect(maskPii('NIK 3201234567890001 on file.').text).toBe(
      'NIK [national id removed] on file.',
    );
    expect(maskPii('NIK 3201-2345-6789-0001 on file.').counts['national-id']).toBe(1);
  });

  it('masks a labelled date of birth as one span, not as a bare date too', () => {
    const result = maskPii('DOB: 12/03/1985, admitted with aphasia.');
    expect(result.text).toBe('[date of birth removed], admitted with aphasia.');
    expect(result.counts).toEqual({ 'date-of-birth': 1 });
  });

  it('masks an Indonesian labelled birth date in written form', () => {
    const result = maskPii('Tanggal lahir: 3 Maret 1985. Keluhan sejak pagi.');
    expect(result.text).toBe('[date of birth removed]. Keluhan sejak pagi.');
  });

  it('masks bare dates in numeric, ISO, and written forms', () => {
    expect(maskPii('Onset on 2026-01-05 at dawn.').text).toBe('Onset on [date removed] at dawn.');
    expect(maskPii('Reviewed 05/02/2026 in clinic.').text).toBe('Reviewed [date removed] in clinic.');
    expect(maskPii('Seen on March 3, 2026 for review.').text).toBe(
      'Seen on [date removed] for review.',
    );
    expect(maskPii('Kontrol tanggal 14 Februari 2026.').text).toBe('Kontrol tanggal [date removed].');
  });

  it('masks names after English and Indonesian honorifics', () => {
    expect(maskPii('Dr. Jane Smith reviewed the scan.').text).toBe('[name removed] reviewed the scan.');
    expect(maskPii('Bapak Joko Santoso tiba pukul tujuh.').text).toBe('[name removed] tiba pukul tujuh.');
    expect(maskPii('Ibu Ratna menunggu di luar.').text).toBe('[name removed] menunggu di luar.');
    expect(maskPii('Tn. Ahmad hadir.').counts.name).toBe(1);
  });

  it('masks a labelled name but keeps the label readable', () => {
    expect(maskPii('Nama: Siti Aminah, usia 60 tahun.').text).toBe(
      'Nama: [name removed], usia 60 tahun.',
    );
    expect(maskPii('Patient: John Doe, admitted.').text).toBe('Patient: [name removed], admitted.');
  });

  it('does not mask "Ibu Kota" as a name', () => {
    const result = maskPii('Ibu Kota provinsi itu ramai.');
    expect(result.total).toBe(0);
  });

  it('leaves identifier-free clinical text untouched', () => {
    const text =
      'The patient presents with a left MCA syndrome, global aphasia, and an NIHSS of 12. ' +
      'Thrombolysis evaluation started immediately.';
    const result = maskPii(text);
    expect(result.text).toBe(text);
    expect(result.total).toBe(0);
  });

  it('handles a combined paragraph and counts every category once', () => {
    const text =
      'Nama: Siti Aminah. DOB: 12/03/1985. No. RM: 123456. ' +
      'Hubungi 0812-3456-7890 atau siti@example.com.';
    const result = maskPii(text);
    expect(result.text).toBe(
      'Nama: [name removed]. [date of birth removed]. [medical record number removed]. ' +
        'Hubungi [phone number removed] atau [email removed].',
    );
    expect(result.total).toBe(5);
    expect(result.counts).toEqual({
      name: 1,
      'date-of-birth': 1,
      'medical-record': 1,
      phone: 1,
      email: 1,
    });
  });

  it('keeps match spans aligned with the original text', () => {
    const text = 'Email siti@example.com dan telepon 0812-3456-7890.';
    const matches = detectPii(text);
    expect(matches).toHaveLength(2);
    for (const match of matches) {
      expect(text.slice(match.start, match.end)).toBe(match.original);
    }
    expect(matches[0]?.start).toBeLessThan(matches[1]?.start ?? 0);
  });

  it('masking an already masked text finds nothing new', () => {
    const once = maskPii('Nama: Siti Aminah, email siti@example.com, DOB: 12/03/1985.');
    const twice = maskPii(once.text);
    expect(twice.total).toBe(0);
    expect(twice.text).toBe(once.text);
  });

  it('returns empty results for empty input', () => {
    expect(maskPii('')).toEqual({ text: '', matches: [], counts: {}, total: 0 });
  });
});
