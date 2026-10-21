// Local evidence card library for the Guideline Navigator.
//
// These cards are paraphrased summaries written in our own words from
// widely published stroke guidance. They are NOT the guideline text, they
// never replace the official document, and every card carries citation
// metadata plus the standing verification label below. Coverage is
// deliberately limited: a topic that has no card is answered with a
// refusal, never with an invented claim.

export const CARD_LABEL =
  'Educational summary. Verify against your local official guideline before acting.';

export const CORPUS_REVIEW_DATE = '2026-10-20';

export interface CardCitation {
  publisher: string;
  document: string;
  section: string;
  year: number;
}

export interface EvidenceCard {
  id: string;
  topicId: string;
  title: string;
  /** One paraphrased claim, in plain educational wording. */
  claim: string;
  citation: CardCitation;
  keywords: string[];
}

export interface GuidelineTopic {
  id: string;
  label: string;
  blurb: string;
}

export const GUIDELINE_TOPICS: GuidelineTopic[] = [
  {
    id: 'thrombolysis',
    label: 'Clot-busting treatment (thrombolysis)',
    blurb: 'Time windows and blood pressure limits for intravenous thrombolysis.',
  },
  {
    id: 'thrombectomy',
    label: 'Clot retrieval (thrombectomy)',
    blurb: 'Large vessel occlusion, imaging selection, and time windows.',
  },
  {
    id: 'blood-pressure',
    label: 'Blood pressure targets',
    blurb: 'Acute targets in ischemic and hemorrhagic stroke.',
  },
  {
    id: 'antiplatelet',
    label: 'Antiplatelet therapy',
    blurb: 'Aspirin timing and short dual therapy after minor stroke or TIA.',
  },
  {
    id: 'anticoagulation',
    label: 'Anticoagulation and atrial fibrillation',
    blurb: 'When blood thinners are started or restarted after stroke.',
  },
  {
    id: 'lipids',
    label: 'Cholesterol and statins',
    blurb: 'High-intensity statin therapy and LDL goals after ischemic stroke.',
  },
  {
    id: 'glucose',
    label: 'Blood sugar',
    blurb: 'Treating very low and very high glucose in acute stroke.',
  },
  {
    id: 'supportive-care',
    label: 'Supportive hospital care',
    blurb: 'Swallowing screening, clot prevention in the legs, and mobilization.',
  },
  {
    id: 'hemorrhage',
    label: 'Brain hemorrhage basics',
    blurb: 'Blood pressure lowering and reversing blood thinners in ICH.',
  },
  {
    id: 'tia',
    label: 'TIA workup',
    blurb: 'Why a transient ischemic attack needs urgent same-pathway assessment.',
  },
];

const AHA_ISCHEMIC: CardCitation = {
  publisher: 'American Heart Association / American Stroke Association',
  document: 'Guidelines for the Early Management of Acute Ischemic Stroke',
  section: 'Intravenous thrombolysis and blood pressure',
  year: 2019,
};

const AHA_SECONDARY: CardCitation = {
  publisher: 'American Heart Association / American Stroke Association',
  document: 'Guideline for the Prevention of Stroke in Patients With Stroke and TIA',
  section: 'Secondary prevention',
  year: 2021,
};

const ESO: CardCitation = {
  publisher: 'European Stroke Organisation',
  document: 'European Stroke Organisation guideline collection',
  section: 'Acute ischemic stroke and intracerebral hemorrhage modules',
  year: 2021,
};

export const EVIDENCE_CARDS: EvidenceCard[] = [
  {
    id: 'gn-iv-window',
    topicId: 'thrombolysis',
    title: 'Intravenous thrombolysis window',
    claim:
      'For eligible patients with acute ischemic stroke, intravenous alteplase is given within 3 hours of the time symptoms began (or were last known well). Selected patients may be treated between 3 and 4.5 hours when extra criteria are met, and tenecteplase is an accepted alternative in some protocols, especially before thrombectomy.',
    citation: AHA_ISCHEMIC,
    keywords: ['alteplase', 'tenecteplase', 'thrombolysis', 'window', 'hours', 'clot-busting', 'iv'],
  },
  {
    id: 'gn-iv-bp',
    topicId: 'thrombolysis',
    title: 'Blood pressure before and after thrombolysis',
    claim:
      'Before intravenous thrombolysis, blood pressure is lowered carefully to below 185/110 mmHg. After treatment it is kept below 180/105 mmHg for the first 24 hours, with frequent monitoring.',
    citation: AHA_ISCHEMIC,
    keywords: ['blood pressure', '185', '110', '180', '105', 'thrombolysis', 'before', 'mmhg'],
  },
  {
    id: 'gn-iv-imaging',
    topicId: 'thrombolysis',
    title: 'Imaging before thrombolysis',
    claim:
      'A non-contrast head CT is obtained before thrombolysis to exclude bleeding. Treatment should not be delayed for extensive extra testing when the patient is otherwise eligible, because benefit falls with every minute of delay.',
    citation: AHA_ISCHEMIC,
    keywords: ['ct', 'imaging', 'scan', 'before', 'delay', 'hemorrhage', 'exclude'],
  },
  {
    id: 'gn-evt-window',
    topicId: 'thrombectomy',
    title: 'Thrombectomy time windows',
    claim:
      'Mechanical thrombectomy is standard care for eligible large vessel occlusion in the anterior circulation within 6 hours of onset. Carefully selected patients with favorable imaging can benefit up to 24 hours after they were last known well.',
    citation: AHA_ISCHEMIC,
    keywords: ['thrombectomy', 'lvo', 'large vessel', 'occlusion', 'window', '24 hours', 'retrieval'],
  },
  {
    id: 'gn-evt-transfer',
    topicId: 'thrombectomy',
    title: 'Transfer for thrombectomy',
    claim:
      'Patients with suspected large vessel occlusion who arrive at a hospital without thrombectomy are assessed quickly and transferred to a thrombectomy-capable center. Intravenous thrombolysis is started first when the patient is eligible, without waiting for transfer.',
    citation: ESO,
    keywords: ['transfer', 'drip and ship', 'center', 'thrombectomy', 'referral'],
  },
  {
    id: 'gn-bp-permissive',
    topicId: 'blood-pressure',
    title: 'Blood pressure in acute ischemic stroke without thrombolysis',
    claim:
      'In acute ischemic stroke patients who are not receiving thrombolysis, blood pressure is usually not lowered in the first hours unless it is very high (above about 220/120 mmHg) or there is another emergency such as aortic dissection or acute heart failure. A modest reduction of about 15 percent in the first 24 hours is a common approach when treatment is needed.',
    citation: AHA_ISCHEMIC,
    keywords: ['permissive', 'hypertension', '220', '120', 'not lowered', 'acute', 'ischemic'],
  },
  {
    id: 'gn-bp-ich',
    topicId: 'blood-pressure',
    title: 'Blood pressure in intracerebral hemorrhage',
    claim:
      'For patients with mild to moderate intracerebral hemorrhage who present with systolic blood pressure between 150 and 220 mmHg, lowering systolic pressure toward about 140 mmHg is considered safe and is commonly started within the first hours, while avoiding large drops and variability.',
    citation: ESO,
    keywords: ['hemorrhage', 'ich', 'systolic', '140', 'lowering', 'bleeding'],
  },
  {
    id: 'gn-asa-early',
    topicId: 'antiplatelet',
    title: 'Early aspirin after ischemic stroke',
    claim:
      'Aspirin is started within 24 to 48 hours after acute ischemic stroke once bleeding has been excluded. Aspirin is not a substitute for thrombolysis and is usually delayed for 24 hours after thrombolysis treatment.',
    citation: AHA_SECONDARY,
    keywords: ['aspirin', 'antiplatelet', '24', '48 hours', 'start', 'early'],
  },
  {
    id: 'gn-dapt-minor',
    topicId: 'antiplatelet',
    title: 'Short dual antiplatelet therapy after minor stroke or high-risk TIA',
    claim:
      'After a minor ischemic stroke or high-risk TIA, short dual antiplatelet therapy with aspirin plus clopidogrel, started within 24 hours and continued for about 21 days (and not beyond 90 days), reduces early recurrence. After the dual period, a single antiplatelet drug is continued.',
    citation: AHA_SECONDARY,
    keywords: ['dapt', 'dual', 'clopidogrel', 'aspirin', 'minor', 'tia', '21 days', '90 days'],
  },
  {
    id: 'gn-af-timing',
    topicId: 'anticoagulation',
    title: 'Starting anticoagulation after stroke with atrial fibrillation',
    claim:
      'For patients whose ischemic stroke is related to atrial fibrillation, oral anticoagulation is started after a delay that depends on stroke severity and bleeding risk on imaging: earlier after mild strokes and later after large strokes. Trial evidence supports earlier starting than older practice in many patients, and the exact day is a clinical decision confirmed on repeat imaging when needed.',
    citation: ESO,
    keywords: ['atrial fibrillation', 'anticoagulant', 'doac', 'apixaban', 'start', 'restart', 'timing', 'af'],
  },
  {
    id: 'gn-af-choice',
    topicId: 'anticoagulation',
    title: 'Choice of anticoagulant for atrial fibrillation',
    claim:
      'A direct oral anticoagulant is preferred over warfarin for stroke prevention in atrial fibrillation when there is no mechanical heart valve and no moderate to severe rheumatic mitral stenosis. Antiplatelet drugs are not an adequate substitute for anticoagulation in atrial fibrillation.',
    citation: AHA_SECONDARY,
    keywords: ['warfarin', 'doac', 'valve', 'choice', 'anticoagulant', 'af'],
  },
  {
    id: 'gn-statin',
    topicId: 'lipids',
    title: 'Statin therapy after ischemic stroke',
    claim:
      'High-intensity statin therapy is started after ischemic stroke of atherosclerotic origin. A common treatment goal is an LDL cholesterol below 70 mg/dL; adding ezetimibe or a PCSK9 inhibitor is considered when the goal is not reached on a statin alone.',
    citation: AHA_SECONDARY,
    keywords: ['statin', 'ldl', 'cholesterol', '70', 'atorvastatin', 'ezetimibe', 'pcsk9'],
  },
  {
    id: 'gn-glucose',
    topicId: 'glucose',
    title: 'Glucose management in acute stroke',
    claim:
      'Low blood glucose (below 60 mg/dL) is corrected immediately because it can mimic stroke. High blood glucose in the first 24 hours after stroke is commonly treated to a target range of about 140 to 180 mg/dL, avoiding both hyperglycemia and hypoglycemia.',
    citation: AHA_ISCHEMIC,
    keywords: ['glucose', 'sugar', 'hypoglycemia', 'hyperglycemia', '60', '140', '180', 'insulin'],
  },
  {
    id: 'gn-swallow',
    topicId: 'supportive-care',
    title: 'Swallowing screening before eating or drinking',
    claim:
      'A swallowing screen is performed before a stroke patient eats, drinks, or takes oral medication. Patients who fail the screen are kept nil by mouth and assessed by a speech and swallowing specialist, because aspiration is a common cause of pneumonia after stroke.',
    citation: ESO,
    keywords: ['swallow', 'dysphagia', 'screen', 'aspiration', 'nil by mouth', 'eating', 'drinking'],
  },
  {
    id: 'gn-vte',
    topicId: 'supportive-care',
    title: 'Preventing leg vein clots in hospital',
    claim:
      'Intermittent pneumatic compression of the legs reduces deep vein thrombosis in immobile stroke patients. Early mobilization is encouraged once the patient is stable, and blood-thinning injections for clot prevention are dosed according to stroke type and bleeding risk.',
    citation: ESO,
    keywords: ['dvt', 'compression', 'pneumatic', 'legs', 'mobilization', 'heparin', 'prophylaxis'],
  },
  {
    id: 'gn-ich-reversal',
    topicId: 'hemorrhage',
    title: 'Reversing blood thinners in brain hemorrhage',
    claim:
      'In intracerebral hemorrhage, anticoagulant effects are reversed as quickly as possible with the specific reversal agent or concentrate for the drug involved (for example vitamin K and prothrombin complex concentrate for warfarin, idarucizumab for dabigatran). Blood pressure control and neurosurgical assessment proceed in parallel.',
    citation: ESO,
    keywords: ['reversal', 'warfarin', 'idarucizumab', 'vitamin k', 'pcc', 'hemorrhage', 'anticoagulant'],
  },
  {
    id: 'gn-tia-urgent',
    topicId: 'tia',
    title: 'TIA needs urgent assessment',
    claim:
      'A transient ischemic attack is assessed urgently, ideally the same day, with brain and vessel imaging, heart rhythm checks, and rapid starting of secondary prevention. Risk scores such as ABCD2 must not be used to delay assessment or to send a patient home without a workup plan.',
    citation: AHA_SECONDARY,
    keywords: ['tia', 'transient', 'abcd2', 'urgent', 'workup', 'same day', 'assessment'],
  },
];

export function cardsForTopic(topicId: string): EvidenceCard[] {
  return EVIDENCE_CARDS.filter((card) => card.topicId === topicId);
}

export function getCard(cardId: string): EvidenceCard | undefined {
  return EVIDENCE_CARDS.find((card) => card.id === cardId);
}
