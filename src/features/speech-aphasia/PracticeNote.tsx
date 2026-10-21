/**
 * Visible practice disclaimer shared by the three labs in this folder.
 * Framing is deliberate: these are education and practice exercises, never
 * therapy, assessment, or diagnosis.
 */
export default function PracticeNote({ children }: { children: string }) {
  return (
    <p className="muted" role="note">
      <strong>Practice only.</strong> {children} This exercise is for education and practice. It
      is not therapy, assessment, or diagnosis, and its results are observations from this
      session only. If you or someone near you has sudden new symptoms such as face drooping, arm
      weakness, or speech difficulty, call <strong>119</strong> in Indonesia now instead of using
      this page.
    </p>
  );
}
