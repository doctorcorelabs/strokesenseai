// Scan Explainer (feature id: scan-explainer, route: #lab/scan-explainer).
//
// A curated library of synthetic teaching schematics with curator written
// annotations as the only source of truth. Layers can be toggled, markers
// opened, structures quizzed, and a core and penumbra concept calculator
// shows the arithmetic behind perfusion summaries. A local image can be
// loaded as a marker practice board: it never leaves the device and is
// never interpreted. There is no reading of any real scan here.

import { useEffect, useMemo, useRef, useState } from 'react';
import { getFeature } from '../../../shared/registry';
import {
  EmergencyBanner,
  MaturityBadge,
  ModeBadge,
  UncertaintyNote,
} from '../../components/ui';
import ToolCoach from '../../ai/ToolCoach';
import { offlineGuideFor } from '../../ai/offline';
import {
  SCAN_CASES,
  buildQuiz,
  caseBrief,
  computeMismatch,
  scoreQuiz,
} from './scan';
import type { ScanAnnotation, ScanCase } from './scan';

interface PracticePin {
  x: number;
  y: number;
  note: string;
}

function ScanSvg({
  scanCase,
  showRegions,
  showMarkers,
  selectedId,
  onMarker,
}: {
  scanCase: ScanCase;
  showRegions: boolean;
  showMarkers: boolean;
  selectedId: string | null;
  onMarker: (annotation: ScanAnnotation) => void;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      style={{ width: '100%', maxWidth: 520, background: '#05070a', borderRadius: 12, display: 'block' }}
      role="img"
      aria-label={`Synthetic teaching schematic: ${scanCase.title}`}
    >
      <ellipse cx={50} cy={50} rx={47} ry={48} fill="#c8ccd1" />
      <ellipse cx={50} cy={50} rx={43} ry={44} fill="#5b636e" />
      <ellipse cx={43} cy={38} rx={6} ry={3.4} fill="#23282e" transform="rotate(-18 43 38)" />
      <ellipse cx={57} cy={38} rx={6} ry={3.4} fill="#23282e" transform="rotate(18 57 38)" />
      <ellipse cx={50} cy={62} rx={9} ry={5} fill="#4a5158" />
      <line x1={50} y1={8} x2={50} y2={92} stroke="#394048" strokeWidth={0.5} strokeDasharray="2 2" />
      {showRegions &&
        scanCase.annotations
          .filter((annotation) => annotation.region)
          .map((annotation) => (
            <ellipse
              key={`region-${annotation.id}`}
              cx={annotation.region!.cx}
              cy={annotation.region!.cy}
              rx={annotation.region!.rx}
              ry={annotation.region!.ry}
              fill={
                annotation.id === selectedId
                  ? 'rgba(255, 209, 102, 0.5)'
                  : 'rgba(123, 216, 138, 0.28)'
              }
              stroke={annotation.id === selectedId ? '#ffd166' : '#7bd88a'}
              strokeWidth={0.6}
            />
          ))}
      {showMarkers &&
        scanCase.annotations.map((annotation, index) => (
          <g
            key={annotation.id}
            onClick={() => onMarker(annotation)}
            style={{ cursor: 'pointer' }}
            role="button"
            aria-label={`Annotation: ${annotation.label}`}
          >
            <circle
              cx={annotation.x}
              cy={annotation.y}
              r={3.1}
              fill={annotation.id === selectedId ? '#ffd166' : '#f2e7cb'}
              stroke="#10151c"
              strokeWidth={0.7}
            />
            <text
              x={annotation.x}
              y={annotation.y + 1.2}
              textAnchor="middle"
              fontSize={3.4}
              fontWeight={700}
              fill="#10151c"
            >
              {index + 1}
            </text>
          </g>
        ))}
    </svg>
  );
}

export default function ScanExplainer() {
  const feature = getFeature('scan-explainer');
  const apiConfigured = Boolean(import.meta.env.VITE_API_BASE_URL?.trim());

  const [caseId, setCaseId] = useState(SCAN_CASES[0].id);
  const scanCase = useMemo(
    () => SCAN_CASES.find((entry) => entry.id === caseId) ?? SCAN_CASES[0],
    [caseId],
  );
  const [showRegions, setShowRegions] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [selected, setSelected] = useState<ScanAnnotation | null>(null);

  // Structure quiz state.
  const questions = useMemo(() => buildQuiz(scanCase), [scanCase]);
  const [quizActive, setQuizActive] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const quizScore = useMemo(
    () => (answers.size >= questions.length ? scoreQuiz(questions, answers) : null),
    [answers, questions],
  );

  // Core and penumbra calculator state.
  const [coreMl, setCoreMl] = useState(15);
  const [penumbraMl, setPenumbraMl] = useState(45);
  const mismatch = useMemo(() => computeMismatch(coreMl, penumbraMl), [coreMl, penumbraMl]);

  // Own image practice board state (local only, never uploaded).
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pins, setPins] = useState<PracticePin[]>([]);
  const boardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  function chooseCase(id: string) {
    setCaseId(id);
    setSelected(null);
    setQuizActive(false);
    setQuizIndex(0);
    setAnswers(new Map());
  }

  function handleMarker(annotation: ScanAnnotation) {
    if (quizActive && quizIndex < questions.length) {
      const question = questions[quizIndex];
      const next = new Map(answers);
      next.set(question.annotationId, annotation.id);
      setAnswers(next);
      setQuizIndex(quizIndex + 1);
      return;
    }
    setSelected(annotation);
  }

  function handleImageFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageUrl(URL.createObjectURL(file));
    setPins([]);
  }

  function handleBoardClick(event: React.MouseEvent<HTMLDivElement>) {
    const el = boardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    setPins((prev) => [...prev, { x, y, note: '' }]);
  }

  return (
    <div className="page-stack">
      <header className="page-heading">
        <p className="eyebrow">Vision AI</p>
        <h1>Scan Explainer</h1>
        <p className="muted">{feature?.tagline}</p>
        <div className="badge-row">
          <MaturityBadge maturity="lab" />
          <ModeBadge mode={apiConfigured ? 'live' : 'offline'} />
        </div>
      </header>

      <EmergencyBanner />

      <section className="panel" aria-labelledby="scan-about">
        <h2 className="section-title" id="scan-about">
          A teaching library, not a reading service
        </h2>
        <p>{feature?.summary}</p>
        <p className="muted">
          {feature?.limitations} Every image in the library is a synthetic schematic drawn in
          code, labeled with its source and license. Curator annotations are the source of
          truth, and the AI coach may only explain what those annotations say.
        </p>
        <div className="badge-row" role="group" aria-label="Teaching case">
          {SCAN_CASES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={entry.id === caseId ? 'btn btn-primary' : 'btn'}
              onClick={() => chooseCase(entry.id)}
            >
              {entry.title}
            </button>
          ))}
        </div>
      </section>

      <section className="panel" aria-labelledby="scan-viewer">
        <h2 className="section-title" id="scan-viewer">
          {scanCase.title}
        </h2>
        <p className="muted">
          {scanCase.modality}. Source: {scanCase.source}. License: {scanCase.license}.
        </p>
        <p>{scanCase.description}</p>
        <div className="badge-row" role="group" aria-label="Layers">
          <button
            type="button"
            className={showRegions ? 'btn btn-primary' : 'btn'}
            onClick={() => setShowRegions((prev) => !prev)}
            aria-pressed={showRegions}
          >
            Highlighted regions
          </button>
          <button
            type="button"
            className={showMarkers ? 'btn btn-primary' : 'btn'}
            onClick={() => setShowMarkers((prev) => !prev)}
            aria-pressed={showMarkers}
          >
            Numbered markers
          </button>
          <button
            type="button"
            className={quizActive ? 'btn btn-primary' : 'btn'}
            onClick={() => {
              setQuizActive((prev) => !prev);
              setQuizIndex(0);
              setAnswers(new Map());
            }}
            aria-pressed={quizActive}
          >
            Structure quiz
          </button>
        </div>

        <ScanSvg
          scanCase={scanCase}
          showRegions={showRegions}
          showMarkers={showMarkers}
          selectedId={selected?.id ?? null}
          onMarker={handleMarker}
        />

        {quizActive && quizIndex < questions.length && (
          <p role="status">
            <strong>Quiz:</strong> {questions[quizIndex].prompt} (question {quizIndex + 1} of{' '}
            {questions.length})
          </p>
        )}
        {quizActive && quizScore && (
          <p role="status">
            <strong>Quiz result:</strong> {quizScore.correct} of {quizScore.total} structures
            found. This score grades the tapping exercise only; reading real scans takes
            supervised training.
          </p>
        )}

        {!quizActive && selected && (
          <div aria-live="polite">
            <h3>{selected.label}</h3>
            <p>{selected.explanation}</p>
          </div>
        )}
        {!quizActive && !selected && (
          <p className="muted">Select a numbered marker on the schematic to read its annotation.</p>
        )}

        <h3>All annotations in this case</h3>
        <ol>
          {scanCase.annotations.map((annotation) => (
            <li key={annotation.id}>
              <button type="button" className="btn" onClick={() => handleMarker(annotation)}>
                {annotation.label}
              </button>
            </li>
          ))}
        </ol>
        <details>
          <summary>Built in case brief (prewritten, works offline)</summary>
          <p>{caseBrief(scanCase)}</p>
        </details>
      </section>

      <section className="panel" aria-labelledby="scan-calculator">
        <h2 className="section-title" id="scan-calculator">
          Core, penumbra, and mismatch concept calculator
        </h2>
        <p>
          Perfusion software summarizes a scan with two volumes: the core, tissue modeled as
          already infarcted, and the penumbra, tissue modeled as at risk. The mismatch is the
          gap between them. Move the sliders and watch the arithmetic, then read why the same
          scan can produce different numbers in different products.
        </p>
        <label>
          Core volume: {coreMl} ml
          <input
            type="range"
            min={0}
            max={100}
            value={coreMl}
            onChange={(event) => setCoreMl(Number(event.target.value))}
            style={{ width: '100%' }}
          />
        </label>
        <label>
          Penumbra volume: {penumbraMl} ml
          <input
            type="range"
            min={0}
            max={150}
            value={penumbraMl}
            onChange={(event) => setPenumbraMl(Number(event.target.value))}
            style={{ width: '100%' }}
          />
        </label>
        <p aria-live="polite">
          Total hypoperfused volume {mismatch.totalHypoperfusedMl} ml. Mismatch volume{' '}
          {mismatch.mismatchVolumeMl} ml. Mismatch ratio{' '}
          {mismatch.mismatchRatio !== null ? mismatch.mismatchRatio.toFixed(2) : 'undefined'} (
          {mismatch.band}).
        </p>
        <p>{mismatch.bandText}</p>
        <UncertaintyNote>
          Commercial products such as e-ASPECTS and rapid perfusion platforms threshold and
          segment scans with proprietary methods and different definitions. Their outputs are
          not interchangeable with each other or with this calculator, and none of them is a
          treatment decision on its own.
        </UncertaintyNote>
      </section>

      <section className="panel" aria-labelledby="scan-board">
        <h2 className="section-title" id="scan-board">
          Marker practice board for your own teaching image
        </h2>
        <p>
          You may load an image from this device, for example a textbook figure you are studying,
          and drop your own numbered pins with your own notes on it. The image is displayed
          locally only: it is never uploaded, never sent to the AI coach, and nothing on this
          page interprets it. Explanations in this lab apply to the curated cases above only.
        </p>
        <label>
          Choose an image from this device
          <input type="file" accept="image/*" onChange={handleImageFile} />
        </label>
        {imageUrl && (
          <>
            <div
              ref={boardRef}
              onClick={handleBoardClick}
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: 520,
                marginTop: 10,
                cursor: 'crosshair',
              }}
              role="img"
              aria-label="Your loaded teaching image. Click to add a pin."
            >
              <img
                src={imageUrl}
                alt="Your teaching image, shown locally only"
                style={{ width: '100%', display: 'block', borderRadius: 12 }}
              />
              {pins.map((pin, index) => (
                <span
                  key={index}
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: `${pin.x * 100}%`,
                    top: `${pin.y * 100}%`,
                    transform: 'translate(-50%, -50%)',
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: '#ffd166',
                    color: '#10151c',
                    fontWeight: 700,
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid #10151c',
                  }}
                >
                  {index + 1}
                </span>
              ))}
            </div>
            <ol>
              {pins.map((pin, index) => (
                <li key={index}>
                  <label>
                    Pin {index + 1} note
                    <input
                      type="text"
                      value={pin.note}
                      placeholder="Your own label for this spot"
                      onChange={(event) => {
                        const next = [...pins];
                        next[index] = { ...pin, note: event.target.value };
                        setPins(next);
                      }}
                    />
                  </label>{' '}
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setPins(pins.filter((_, i) => i !== index))}
                  >
                    Remove pin {index + 1}
                  </button>
                </li>
              ))}
            </ol>
            <button type="button" className="btn" onClick={() => setPins([])}>
              Clear all pins
            </button>
          </>
        )}
      </section>

      <ToolCoach
        tool="scan"
        moduleId="scan-explainer"
        context={`Scan Explainer case: ${scanCase.title}. ${selected ? `Selected annotation: ${selected.label}. ` : ''}Explanations may only restate the curator annotations of this curated teaching case.`}
        fallback={offlineGuideFor('scan-explainer')}
      />
    </div>
  );
}
