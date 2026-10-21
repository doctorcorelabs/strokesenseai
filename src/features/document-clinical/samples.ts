// Synthetic sample inputs for the document labs. Every sample is fictional,
// written for this demo, and deliberately free of personal data: no names,
// no identity numbers, no phone numbers, no birth dates. They exist so the
// tools can be explored without anyone pasting a real medical document.

export interface DocumentSample {
  id: string;
  title: string;
  /** Optional one-line explanation shown under the title on the sample button. */
  note?: string;
  text: string;
}

export const DISCHARGE_SAMPLES: DocumentSample[] = [
  {
    id: 'discharge-synthetic-1',
    title: 'Synthetic sample 1: structured discharge summary',
    text: [
      'DISCHARGE SUMMARY (SYNTHETIC SAMPLE)',
      'Diagnosis: Acute ischemic stroke, left middle cerebral artery territory',
      'Secondary diagnoses: Hypertension, type 2 diabetes mellitus, dyslipidemia',
      'Medications:',
      '- Aspirin 100 mg, one tablet once daily after breakfast',
      '- Clopidogrel 75 mg, one tablet once daily',
      '- Atorvastatin 40 mg, one tablet at night',
      '- Amlodipine 5 mg, one tablet once daily',
      'Follow-up:',
      '- Return to the stroke clinic in two weeks for review',
      '- Blood pressure check at the community clinic next week',
      '- Bring this summary and all medicine packets to every visit',
      'Warning signs - return to the emergency department at once if you notice:',
      '- Sudden weakness of the face, arm, or leg',
      '- Slurred speech or trouble understanding words',
      '- Bleeding that does not stop, or black stools',
      'Activity and diet:',
      '- Walk a short distance every day as tolerated',
      '- Low salt diet, avoid fried food',
      '- No smoking and no alcohol',
    ].join('\n'),
  },
  {
    id: 'discharge-synthetic-2',
    title: 'Synthetic sample 2: short note with an unreadable line',
    text: [
      'Discharge note (synthetic sample 2)',
      'Diagnosis: Hemorrhagic stroke, recovering well',
      'Medicine: Metformin 500 mg twice daily',
      'Medicine: Citicoline, take as directed on the packet',
      '[illegible line - handwriting could not be read]',
      'Control again in one month at the neurology clinic',
      'If fever above 38 degrees or a severe headache starts, go to the emergency department',
    ].join('\n'),
  },
];

export const RISK_SAMPLES: DocumentSample[] = [
  {
    id: 'risk-fictional-1',
    title: 'Fictional history 1: several stated factors',
    text: 'Fictional example. A 68-year-old who has had high blood pressure for ten years and takes amlodipine. He smokes about ten cigarettes a day. He has no history of diabetes. His father had a stroke at the age of 70. He rarely exercises and mostly sits at home. Blood tests last year showed high cholesterol.',
  },
  {
    id: 'risk-fictional-2',
    title: 'Fictional history 2: mostly stated absent',
    text: 'Fictional example. She does not smoke and has never used alcohol. No atrial fibrillation was found on repeated ECG checks. She walks 30 minutes every morning. There is no family history of stroke. Her blood pressure has always been in the normal range, and blood tests show no diabetes.',
  },
  {
    id: 'risk-fictional-3',
    title: 'Fictional sample 3: history written in Indonesian',
    note: 'The sample text itself is in Indonesian, to show that the parser accepts Indonesian input too.',
    text: 'Contoh fiktif. Pasien memiliki riwayat hipertensi dan diabetes sejak lima tahun lalu. Ia berhenti merokok tiga tahun lalu setelah merokok selama 20 tahun. Kolesterol tinggi diketahui dari pemeriksaan tahun lalu. Ibu pasien pernah mengalami stroke.',
  },
];
