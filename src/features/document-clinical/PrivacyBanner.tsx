// Prominent privacy banner shared by both document labs. A real discharge
// paper or clinical note is a medical record; the banner says so up front,
// before any input box, and the extraction warning stays visible at all
// times (a hard requirement in PLANNING.md section 6.6).

export default function PrivacyBanner({ noun }: { noun: string }) {
  return (
    <section className="dc-privacy" aria-labelledby="dc-privacy-title">
      <h2 id="dc-privacy-title" className="section-title">
        Privacy first: never paste real patient information
      </h2>
      <p>
        This is an educational demonstration that runs on synthetic samples. A real {noun} is a
        medical record. Do not paste, type, or upload text about a real patient here or into any
        online tool. Use only the built-in synthetic samples, or text you have fully de-identified
        and are allowed to use for learning.
      </p>
      <p className="dc-privacy-warning">
        <strong>Extraction can be wrong. Always check against the original paper.</strong> If a
        fact cannot be verified against its source line, this tool marks it unverified instead of
        hiding the problem.
      </p>
    </section>
  );
}
