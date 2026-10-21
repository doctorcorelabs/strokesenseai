// Face Symmetry Analyzer v2: "measure geometry, never diagnose".
//
// Three modes: a synthetic lab (default) with procedural faces whose
// ground truth is known, an opt-in photo upload, and an opt-in camera
// snapshot. Real images are processed on this device only: landmarks are
// placed by hand because this build bundles no machine learning model,
// and the photo can be deleted at any time. A strict quality gate runs
// before any number is shown; when it fails, the lab reports "cannot
// analyze" with the specific reason instead of inventing a result.

import { useEffect, useMemo, useRef, useState } from 'react';
import { CannotAnalyzePanel, UncertaintyNote } from '../../components/ui';
import {
  LANDMARK_KEYS,
  LANDMARK_LABELS,
  SYNTHETIC_PRESETS,
  analyzeFace,
  jitterLandmarks,
  summarizeCaptures,
  syntheticFace,
} from './geometry';
import type { AnalysisResult, FaceLandmarks, FaceMetrics, LandmarkKey } from './geometry';
import { CameraCapture, FaceSketch, LandmarkPicker, computeImageStats, readFileAsDataUrl } from './capture';
import type { ImageStats } from './capture';
import './vision-face.css';

type Mode = 'synthetic' | 'upload' | 'camera';

function formatSigned(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
}

function QualityChecks({ result }: { result: AnalysisResult }) {
  return (
    <ul className="vf-check-list">
      {result.report.checks.map((check) => (
        <li key={check.id} className="vf-check">
          <span
            className={`vf-check-mark ${
              check.level === 'pass' ? 'vf-check-pass' : check.level === 'low' ? 'vf-check-low' : 'vf-check-fail'
            }`}
          >
            {check.level === 'pass' ? 'Pass' : check.level === 'low' ? 'Low' : 'Fail'}
          </span>
          <span>
            <strong>{check.label}.</strong> {check.detail}
          </span>
        </li>
      ))}
    </ul>
  );
}

const METRIC_EXPLAINERS: {
  key: 'mouthCornerDelta' | 'eyeApertureRatio' | 'browHeightDelta';
  title: string;
  unit: string;
  explain: string;
}[] = [
  {
    key: 'mouthCornerDelta',
    title: 'Mouth corner height offset',
    unit: 'in units of the distance between the eyes',
    explain:
      'This describes the height difference between the two mouth corners in the image. A positive value means the corner on the right of the image sits lower. Ordinary faces are naturally a little uneven, and this number moves with expression, head tilt, and camera angle. It is a description of the picture, not a score, and this lab sets no normal cutoff for it.',
  },
  {
    key: 'eyeApertureRatio',
    title: 'Eye opening ratio',
    unit: 'right eye opening divided by left eye opening, as seen in the image',
    explain:
      'This compares how open the two eyes are in the image. 1.00 means the openings look equal. Blinking, squinting at light, and camera angle all change it from moment to moment.',
  },
  {
    key: 'browHeightDelta',
    title: 'Brow height difference',
    unit: 'in units of the distance between the eyes',
    explain:
      'This describes the difference in height between the two brows above their eyes. Raised brows during an expression change it on purpose; that is why the lab reports geometry only and never interprets it.',
  },
];

function MetricsView({ captures }: { captures: FaceMetrics[] }) {
  const ranges = summarizeCaptures(captures);
  if (captures.length === 0) return null;
  return (
    <div>
      <div className="vf-metric-grid">
        {METRIC_EXPLAINERS.map((metric) => {
          const range = ranges[metric.key];
          if (!range) return null;
          return (
            <article key={metric.key} className="vf-metric">
              <h3>{metric.title}</h3>
              <p className="vf-metric-value">{formatSigned(range.mean)}</p>
              <p className="muted">
                {range.count === 1
                  ? `Single capture. Unit: ${metric.unit}.`
                  : `Mean of ${range.count} captures, observed range ${formatSigned(range.min)} to ${formatSigned(range.max)} (plus or minus ${range.spread.toFixed(2)}). Unit: ${metric.unit}.`}
              </p>
              <p>{metric.explain}</p>
            </article>
          );
        })}
      </div>
      <UncertaintyNote>
        Repeated captures of the same face give slightly different numbers. That spread is part of
        the result: it shows how much of a single reading is measurement noise from placement,
        expression, and camera angle.
      </UncertaintyNote>
    </div>
  );
}

function failedReasons(result: AnalysisResult): { reason: string; guidance: string } {
  const failed = result.report.checks.filter((check) => check.level === 'fail');
  const reason =
    failed.map((check) => `${check.label}: ${check.detail}`).join(' ') || 'The quality gate failed.';
  return {
    reason,
    guidance:
      'Fix the listed problem and try again: face the camera straight on, keep the head level, use even light on both sides of the face, and make sure the face fills more of the frame. This lab would rather refuse than guess.',
  };
}

export default function FaceAnalyzerLab() {
  const [mode, setMode] = useState<Mode>('synthetic');
  const [presetId, setPresetId] = useState(SYNTHETIC_PRESETS[0]?.id ?? 'neutral');
  const [extraCaptures, setExtraCaptures] = useState<FaceMetrics[]>([]);
  const captureSeed = useRef(100);

  const preset = SYNTHETIC_PRESETS.find((entry) => entry.id === presetId) ?? SYNTHETIC_PRESETS[0];
  if (!preset) return null;

  return (
    <div className="page-stack">
      <section className="panel" aria-labelledby="fa-about">
        <h2 className="section-title" id="fa-about">
          What this lab measures
        </h2>
        <p>
          This is an educational geometry simulation. It measures distances and ratios between
          facial landmarks in an image: mouth corner offset, eye opening ratio, and brow height
          difference. It reports those numbers with their measurement spread.
        </p>
        <p>
          <strong>What it never does:</strong> it does not diagnose anything, it does not classify
          face patterns, it does not locate lesions, and it never calls a face normal or abnormal.
          Ordinary faces are naturally asymmetric. A measurement here describes a picture, not a
          person&apos;s health.
        </p>
        <p className="muted">
          Real photos are processed on this device only. This build includes no machine learning
          landmark model, so landmarks on a real photo are placed by hand, one click at a time.
          Nothing is uploaded and nothing is stored.
        </p>
      </section>

      <div className="vf-tabs" role="tablist" aria-label="Analyzer mode">
        {(
          [
            ['synthetic', 'Synthetic lab (default)'],
            ['upload', 'Upload a photo'],
            ['camera', 'Camera snapshot'],
          ] as [Mode, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            className="vf-tab"
            onClick={() => setMode(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'synthetic' ? (
        <SyntheticMode
          presetId={presetId}
          onPresetChange={(id) => {
            setPresetId(id);
            setExtraCaptures([]);
          }}
          extraCaptures={extraCaptures}
          onAddCapture={(metrics) => setExtraCaptures((prev) => [...prev, metrics])}
          nextSeed={() => {
            captureSeed.current += 1;
            return captureSeed.current;
          }}
        />
      ) : (
        <PhotoMode mode={mode} />
      )}
    </div>
  );
}

function SyntheticMode({
  presetId,
  onPresetChange,
  extraCaptures,
  onAddCapture,
  nextSeed,
}: {
  presetId: string;
  onPresetChange: (id: string) => void;
  extraCaptures: FaceMetrics[];
  onAddCapture: (metrics: FaceMetrics) => void;
  nextSeed: () => number;
}) {
  const preset = SYNTHETIC_PRESETS.find((entry) => entry.id === presetId) ?? SYNTHETIC_PRESETS[0];
  const landmarks = useMemo(() => (preset ? syntheticFace(preset.spec) : null), [preset]);
  const analysis = useMemo<AnalysisResult | null>(() => {
    if (!preset || !landmarks) return null;
    return analyzeFace({
      faceCount: 1,
      landmarks,
      sharpness: preset.sharpness,
      lightingBalance: preset.lightingBalance,
    });
  }, [preset, landmarks]);

  if (!preset || !landmarks || !analysis) return null;
  const captures = analysis.status !== 'cannot' ? [analysis.metrics, ...extraCaptures] : [];

  const addCapture = () => {
    const jittered = jitterLandmarks(landmarks, nextSeed());
    const result = analyzeFace({
      faceCount: 1,
      landmarks: jittered,
      sharpness: preset.sharpness,
      lightingBalance: preset.lightingBalance,
    });
    if (result.status !== 'cannot') onAddCapture(result.metrics);
  };

  return (
    <section className="panel" aria-labelledby="fa-synthetic">
      <h2 className="section-title" id="fa-synthetic">
        Synthetic lab
      </h2>
      <p className="muted">
        These faces are generated by code, so what the measurement should find is known in advance.
        Use them to learn how pose, light, and face size change the numbers, and when the quality
        gate refuses to measure at all.
      </p>
      <div className="vf-tabs" role="group" aria-label="Synthetic face presets">
        {SYNTHETIC_PRESETS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className="vf-tab"
            aria-pressed={entry.id === presetId}
            onClick={() => onPresetChange(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div className="vf-grid">
        <div>
          <FaceSketch landmarks={landmarks} label={`Synthetic face: ${preset.label}`} />
          <p className="muted">{preset.description}</p>
          <p>
            <strong>{preset.groundTruth}</strong>
          </p>
        </div>
        <div>
          <h3>Quality gate</h3>
          <QualityChecks result={analysis} />
          {analysis.status === 'cannot' ? (
            <CannotAnalyzePanel role="alert" {...failedReasons(analysis)} />
          ) : (
            <>
              <p className="muted">
                Gate status: {analysis.status === 'good' ? 'good' : 'low confidence'}.{' '}
                {analysis.status === 'low'
                  ? 'Borderline checks are marked Low above; treat the numbers as rough.'
                  : 'All checks passed.'}
              </p>
              <div className="vf-actions">
                <button type="button" className="btn btn-primary" onClick={addCapture}>
                  Add another capture of this face
                </button>
              </div>
              <p className="muted">
                Each added capture re-places the landmarks with a small random offset, like a
                person clicking slightly differently. Watch the reported range grow honestly
                instead of pretending one reading is exact.
              </p>
            </>
          )}
        </div>
      </div>
      {captures.length > 0 && (
        <>
          <h3>Measurements</h3>
          <MetricsView captures={captures} />
        </>
      )}
    </section>
  );
}

function PhotoMode({ mode }: { mode: 'upload' | 'camera' }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [placed, setPlaced] = useState<Partial<Record<LandmarkKey, { x: number; y: number }>>>({});
  const [stats, setStats] = useState<ImageStats | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    if (!photoUrl) {
      setStats(null);
      return;
    }
    let live = true;
    void computeImageStats(photoUrl).then((result) => {
      if (live) setStats(result);
    });
    return () => {
      live = false;
    };
  }, [photoUrl]);

  const activeKey = LANDMARK_KEYS.find((key) => !placed[key]) ?? null;
  const complete = activeKey === null;

  const landmarks = useMemo<FaceLandmarks | null>(() => {
    if (!complete) return null;
    const out = {} as FaceLandmarks;
    for (const key of LANDMARK_KEYS) {
      const point = placed[key];
      if (!point) return null;
      out[key] = point;
    }
    return out;
  }, [complete, placed]);

  const analysis = useMemo<AnalysisResult | null>(() => {
    if (!landmarks) return null;
    return analyzeFace({
      faceCount: 1,
      landmarks,
      sharpness: stats?.sharpness,
      lightingBalance: stats?.lightingBalance,
    });
  }, [landmarks, stats]);

  const reset = () => {
    setPhotoUrl(null);
    setPlaced({});
    setStats(null);
    setFileError(null);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const url = await readFileAsDataUrl(file);
      setPhotoUrl(url);
      setPlaced({});
      setFileError(null);
    } catch (caught) {
      setFileError(caught instanceof Error ? caught.message : 'The file could not be read.');
    }
  };

  const undoLast = () => {
    const placedKeys = LANDMARK_KEYS.filter((key) => placed[key]);
    const last = placedKeys[placedKeys.length - 1];
    if (!last) return;
    setPlaced((prev) => {
      const next = { ...prev };
      delete next[last];
      return next;
    });
  };

  return (
    <section className="panel" aria-labelledby="fa-photo">
      <h2 className="section-title" id="fa-photo">
        {mode === 'upload' ? 'Photo mode: upload' : 'Photo mode: camera snapshot'}
      </h2>
      <p className="muted">
        The photo never leaves this device. Because this build has no landmark model, you place the
        16 landmarks yourself; that is slower, and it is honest about it. Your placements decide the
        numbers, so place each point as carefully as you can.
      </p>

      {mode === 'upload' ? (
        <div>
          <label>
            Choose a front-facing photo
            <input
              className="vf-file-input"
              type="file"
              accept="image/*"
              onChange={(event) => void onFile(event.target.files?.[0])}
            />
          </label>
          {fileError && (
            <p className="vf-note" role="alert">
              {fileError}
            </p>
          )}
        </div>
      ) : (
        <CameraCapture
          onSnapshot={(url) => {
            setPhotoUrl(url);
            setPlaced({});
          }}
        />
      )}

      {photoUrl && (
        <>
          <div className="vf-grid">
            <div>
              <LandmarkPicker
                imageUrl={photoUrl}
                placed={placed}
                activeKey={activeKey}
                onPlace={(key, point) => setPlaced((prev) => ({ ...prev, [key]: point }))}
              />
              <div className="vf-actions">
                <button type="button" className="btn btn-ghost" onClick={undoLast}>
                  Undo last point
                </button>
                <button type="button" className="btn btn-ghost" onClick={reset}>
                  Delete photo and results
                </button>
              </div>
            </div>
            <div>
              <h3>Place the landmarks</h3>
              {activeKey ? (
                <p>
                  Next point ({LANDMARK_KEYS.indexOf(activeKey) + 1} of {LANDMARK_KEYS.length}):{' '}
                  <strong>{LANDMARK_LABELS[activeKey]}</strong>. Click that spot on the photo.
                </p>
              ) : (
                <p>All landmarks are placed. The quality gate ran on your placements.</p>
              )}
              <ol className="vf-place-list">
                {LANDMARK_KEYS.map((key) => (
                  <li key={key}>
                    {placed[key] ? 'Placed: ' : 'Waiting: '}
                    {LANDMARK_LABELS[key]}
                  </li>
                ))}
              </ol>
              {stats === null && (
                <p className="muted">
                  Sharpness and lighting checks are unavailable for this image in this browser, so
                  the gate runs on placement and pose only. The lab says so rather than inventing
                  the missing checks.
                </p>
              )}
            </div>
          </div>

          {analysis && (
            <div>
              <h3>Quality gate</h3>
              <QualityChecks result={analysis} />
              {analysis.status === 'cannot' ? (
                <CannotAnalyzePanel role="alert" {...failedReasons(analysis)} />
              ) : (
                <>
                  <h3>Measurements</h3>
                  <MetricsView captures={[analysis.metrics]} />
                </>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
