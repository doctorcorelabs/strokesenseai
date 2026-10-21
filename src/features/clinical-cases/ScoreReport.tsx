import type { ScoreSummary } from './engine';

/** Shared score table used by all three clinical case labs. */
export default function ScoreReport({ summary, title }: { summary: ScoreSummary; title: string }) {
  return (
    <div>
      <div className="badge-row" aria-label="Total score">
        <span className="badge badge-lab">
          {title}: {summary.earned} of {summary.max} ({summary.percent}%)
        </span>
        <span className="badge badge-mode">{summary.band}</span>
      </div>
      <table className="table-simple">
        <thead>
          <tr>
            <th scope="col">Component</th>
            <th scope="col">Points</th>
            <th scope="col">Feedback</th>
          </tr>
        </thead>
        <tbody>
          {summary.parts.map((part) => (
            <tr key={part.id}>
              <td>{part.label}</td>
              <td>
                {part.earned} / {part.max}
              </td>
              <td>{part.note ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
