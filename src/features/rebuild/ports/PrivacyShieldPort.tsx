import { getFeature } from '../../../../shared/registry';
import { LabShell } from '../../../shell';
import PrivacyShield from '../../research-platform/PrivacyShield';
import { maskPii } from '../../research-platform/pii';
import './ports.css';

// The same fully synthetic sample the workspace itself offers, so the
// example step and the try step tell one consistent story. Every
// identifier in it is invented.
const EXAMPLE_TEXT =
  'Patient: Budi Hartono, DOB: 14/02/1960. No. RM: 00-7781. ' +
  'His daughter can be reached at 0812-9000-1111 or keluarga.contoh@example.com. ' +
  'Dr. Maya Chen reviewed the head CT from 2026-01-05 and noted a left MCA infarct. ' +
  'NIK on file: 3171-0101-0101-0001. Ibu Sari will bring the discharge papers tomorrow.';

/**
 * Step 1 content: the finished before-and-after pair for the sample,
 * produced by the same local maskPii patterns the workspace runs.
 * Nothing is typed and nothing leaves the device on this step.
 */
function PrivacyExample() {
  const result = maskPii(EXAMPLE_TEXT);
  return (
    <>
      <h2 className="section-title">See a finished example</h2>
      <p>
        This synthetic note was scanned by the same pattern matcher the tool itself uses. The
        identifiers it found are replaced in the masked copy on the right.
      </p>
      <p className="port-example-label">Example result</p>
      <div className="rp-grid">
        <div className="rp-pane">
          <h3>Before: original text</h3>
          <p className="rp-pane-text">{EXAMPLE_TEXT}</p>
        </div>
        <div className="rp-pane">
          <h3>After: masked copy</h3>
          <p className="rp-pane-text">{result.text}</p>
        </div>
      </div>
      <p className="muted" style={{ marginTop: '0.9rem' }}>
        {result.total} likely identifier{result.total === 1 ? '' : 's'} masked in this example.
        In the try step you can paste your own draft, or load this same sample and compare.
      </p>
    </>
  );
}

/**
 * Rebuild port for Privacy Shield: the existing workspace, unchanged,
 * mounted inside the shared Example, Try, Understand shell. The
 * workspace renders its own before-and-after result inline, so this
 * port passes no separate result sheet.
 */
export default function PrivacyShieldPort() {
  const feature = getFeature('privacy-shield');
  if (!feature) return null;
  return (
    <LabShell feature={feature} example={<PrivacyExample />} tryIt={<PrivacyShield />} />
  );
}
