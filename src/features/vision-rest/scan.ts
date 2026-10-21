// Teaching case library and pure logic for the Scan Explainer.
//
// Every case here is a synthetic schematic drawn in code, clearly a diagram
// and not a real patient scan. Curator annotations are the only source of
// truth for explanations. There is no diagnostic content in this module:
// annotations name anatomical structures and describe what a teaching
// diagram shows.

export interface ScanAnnotation {
  id: string;
  label: string;
  /** Marker position in the 0 to 100 viewBox coordinate space. */
  x: number;
  y: number;
  /** Optional highlighted region drawn as an ellipse in viewBox units. */
  region?: { cx: number; cy: number; rx: number; ry: number };
  explanation: string;
}

export interface ScanCase {
  id: string;
  title: string;
  modality: string;
  source: string;
  license: string;
  description: string;
  annotations: ScanAnnotation[];
}

export const SCAN_CASES: ScanCase[] = [
  {
    id: 'normal-axial-schematic',
    title: 'Axial brain schematic at the basal ganglia level',
    modality: 'Synthetic CT style schematic',
    source: 'Drawn in code for StrokeSense AI Lab (procedural teaching diagram)',
    license: 'CC BY 4.0, StrokeSense AI Lab',
    description:
      'A simplified axial slice used to practice orientation: front of the head at the top, the patient right side on the viewer left, and the deep structures that sit at this level.',
    annotations: [
      {
        id: 'frontal-lobe',
        label: 'Frontal lobe',
        x: 50,
        y: 16,
        explanation:
          'The front of the brain, shown at the top of this axial view. Orientation is the first reading skill: in axial imaging the top of the image is the front of the head.',
      },
      {
        id: 'lateral-ventricles',
        label: 'Lateral ventricles (frontal horns)',
        x: 44,
        y: 34,
        region: { cx: 50, cy: 36, rx: 13, ry: 6 },
        explanation:
          'Fluid filled spaces shown darker in CT style images. Their paired, roughly symmetric shape makes them a useful landmark for judging whether a slice looks level.',
      },
      {
        id: 'insular-region',
        label: 'Insular region and external capsule area',
        x: 26,
        y: 48,
        region: { cx: 27, cy: 48, rx: 7, ry: 10 },
        explanation:
          'A deep fold of cortex buried under the frontal and temporal lobes. It sits inside the territory supplied by the middle cerebral artery, which is why teaching cases return to this level so often.',
      },
      {
        id: 'internal-capsule',
        label: 'Internal capsule (posterior limb)',
        x: 42,
        y: 52,
        region: { cx: 43, cy: 52, rx: 5, ry: 8 },
        explanation:
          'A compact bundle of projection fibers. Because so many motor and sensory fibers pass through a small area, teaching diagrams use it to explain why a small deep lesion can cause a large deficit.',
      },
      {
        id: 'thalamus',
        label: 'Thalamus',
        x: 52,
        y: 60,
        region: { cx: 52, cy: 60, rx: 8, ry: 6 },
        explanation:
          'A relay station for sensory pathways on each side of the midline. In this schematic it is the oval structure just behind the internal capsule.',
      },
      {
        id: 'occipital-lobe',
        label: 'Occipital lobe',
        x: 50,
        y: 86,
        explanation:
          'The back of the brain, at the bottom of the axial image, where visual processing begins. Damage here is a classic teaching example of vision loss without eye disease.',
      },
    ],
  },
  {
    id: 'mca-territory-schematic',
    title: 'Middle cerebral artery territory, teaching overlay',
    modality: 'Synthetic schematic with territory overlay',
    source: 'Drawn in code for StrokeSense AI Lab (procedural teaching diagram)',
    license: 'CC BY 4.0, StrokeSense AI Lab',
    description:
      'The same axial level with one vascular territory outlined. The lesson is geographic: a territory is a map of what one artery supplies, and symptoms follow the structures inside it.',
    annotations: [
      {
        id: 'mca-territory',
        label: 'Middle cerebral artery territory (schematic)',
        x: 30,
        y: 44,
        region: { cx: 32, cy: 46, rx: 20, ry: 26 },
        explanation:
          'The outlined region is a simplified map of the middle cerebral artery territory on one side. Real territories vary between people, and product maps from imaging software are estimates, not borders drawn by nature.',
      },
      {
        id: 'motor-strip',
        label: 'Motor cortex region within the territory',
        x: 24,
        y: 30,
        explanation:
          'Part of the frontal lobe that plans and triggers movement, including the face and arm areas. Its position inside this territory is why face and arm weakness is a classic teaching pattern for this artery.',
      },
      {
        id: 'language-area',
        label: 'Language cortex region (dominant side)',
        x: 20,
        y: 58,
        explanation:
          'On the dominant side, usually the left, this territory also covers cortex used for language. The same artery can therefore produce weakness, language problems, or both, depending on which branches are involved.',
      },
      {
        id: 'sparing-note',
        label: 'Territory that belongs to other arteries',
        x: 62,
        y: 50,
        explanation:
          'The unshaded side and the midline regions belong to other arteries in this simplified map. Comparing shaded and unshaded areas is the core skill behind localization teaching.',
      },
    ],
  },
  {
    id: 'density-contrast-schematic',
    title: 'Density contrast: bright and dark regions on CT style images',
    modality: 'Synthetic CT style schematic',
    source: 'Drawn in code for StrokeSense AI Lab (procedural teaching diagram)',
    license: 'CC BY 4.0, StrokeSense AI Lab',
    description:
      'A teaching diagram about shades, not findings: on CT style images, fresh blood is typically shown bright (hyperdense) and fluid or older change is typically shown dark (hypodense). Timing matters, and this diagram deliberately shows both shades side by side for comparison only.',
    annotations: [
      {
        id: 'bright-region',
        label: 'Bright region (hyperdense in CT terms)',
        x: 34,
        y: 40,
        region: { cx: 34, cy: 40, rx: 9, ry: 7 },
        explanation:
          'In CT vocabulary, hyperdense means brighter than the surrounding brain. Fresh blood is the classic example used in teaching. Brightness alone is never a diagnosis; calcification and contrast material can also appear bright.',
      },
      {
        id: 'dark-region',
        label: 'Dark region (hypodense in CT terms)',
        x: 66,
        y: 62,
        region: { cx: 66, cy: 62, rx: 10, ry: 8 },
        explanation:
          'Hypodense means darker than the surrounding brain. Fluid filled spaces are naturally dark, and tissue change over time can also darken. A dark area on one teaching diagram cannot be matched to any real person.',
      },
      {
        id: 'midline',
        label: 'Midline structures',
        x: 50,
        y: 50,
        explanation:
          'Readers compare the two halves against the midline as a symmetry reference. This schematic is drawn level on purpose; real scans can be tilted, which is one reason image quality checks come before interpretation.',
      },
    ],
  },
];

/** Find a case by id, or undefined. */
export function getScanCase(id: string): ScanCase | undefined {
  return SCAN_CASES.find((scanCase) => scanCase.id === id);
}

export interface MismatchResult {
  /** Total hypoperfused volume in the simplified model, in millilitres. */
  totalHypoperfusedMl: number;
  /** Tissue at risk in the simplified model: the penumbra volume itself. */
  mismatchVolumeMl: number;
  /** Total divided by core, or null when the core volume is zero. */
  mismatchRatio: number | null;
  /** Teaching band for the ratio, in words. */
  band: 'no core entered' | 'small' | 'moderate' | 'large';
  bandText: string;
}

/**
 * Core, penumbra, and mismatch concept calculator.
 * This teaches the arithmetic behind perfusion summaries only. Real
 * products threshold and segment scans with proprietary methods, so their
 * numbers are not interchangeable with this calculator or with each other.
 */
export function computeMismatch(coreMl: number, penumbraMl: number): MismatchResult {
  const core = Math.max(0, coreMl);
  const penumbra = Math.max(0, penumbraMl);
  const total = core + penumbra;
  if (core === 0) {
    return {
      totalHypoperfusedMl: total,
      mismatchVolumeMl: penumbra,
      mismatchRatio: null,
      band: 'no core entered',
      bandText:
        'With a core of zero the ratio is undefined, because it divides by the core. Products handle this edge case in different ways, which is one reason their outputs differ.',
    };
  }
  const ratio = total / core;
  if (ratio < 1.2) {
    return {
      totalHypoperfusedMl: total,
      mismatchVolumeMl: penumbra,
      mismatchRatio: ratio,
      band: 'small',
      bandText:
        'A ratio near 1 means most of the hypoperfused tissue is already core in this model, so the mismatch, the tissue that differs between the two maps, is small.',
    };
  }
  if (ratio < 1.8) {
    return {
      totalHypoperfusedMl: total,
      mismatchVolumeMl: penumbra,
      mismatchRatio: ratio,
      band: 'moderate',
      bandText:
        'A ratio between 1.2 and 1.8 is a moderate mismatch in teaching terms: the at risk region is a meaningful fraction of the total, but smaller than the core.',
    };
  }
  return {
    totalHypoperfusedMl: total,
    mismatchVolumeMl: penumbra,
    mismatchRatio: ratio,
    band: 'large',
    bandText:
      'A ratio at or above 1.8 is the classic large mismatch pattern used in teaching examples: a small core inside a much larger at risk region. Trial definitions vary, and this band is an educational summary, not a treatment rule.',
  };
}

export interface QuizQuestion {
  annotationId: string;
  prompt: string;
}

/** Build quiz questions from a case: tap the named structure. */
export function buildQuiz(scanCase: ScanCase): QuizQuestion[] {
  return scanCase.annotations.map((annotation) => ({
    annotationId: annotation.id,
    prompt: `Tap the marker for: ${annotation.label}`,
  }));
}

/** Score quiz answers: map of annotationId to the annotationId the user tapped. */
export function scoreQuiz(
  questions: QuizQuestion[],
  answers: ReadonlyMap<string, string>,
): { correct: number; total: number; perQuestion: { annotationId: string; correct: boolean }[] } {
  const perQuestion = questions.map((question) => ({
    annotationId: question.annotationId,
    correct: answers.get(question.annotationId) === question.annotationId,
  }));
  return {
    correct: perQuestion.filter((entry) => entry.correct).length,
    total: questions.length,
    perQuestion,
  };
}

/**
 * The offline educational brief for a case, shown when no live AI is
 * available or the user has not consented. It only restates the curator
 * annotations, which are the source of truth for this feature.
 */
export function caseBrief(scanCase: ScanCase): string {
  const parts = scanCase.annotations.map(
    (annotation) => `${annotation.label}: ${annotation.explanation}`,
  );
  return `${scanCase.title}. ${scanCase.description} ${parts.join(' ')}`;
}
