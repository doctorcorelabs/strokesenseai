// The last lab activity in this browser session, kept only so Ask the
// Lab can offer context chips and attach a short context note to a
// question.
//
// HARD PRIVACY RULE: an activity record holds a feature label and a
// counts-only detail written by the feature itself (for example label
// "Face Lab", detail "3 expression missions completed"). It must never
// contain raw user text, typed answers, document content, transcripts,
// or anything a person entered. Features call setLastActivity with a
// label and a summary they composed from counts; nothing here accepts
// free-form user input. The record lives in sessionStorage only and
// dies with the tab, like the session consent record.

const LAST_ACTIVITY_KEY = 'ssai.lastActivity.v1';
const LABEL_MAX_CHARS = 80;
const DETAIL_MAX_CHARS = 160;

export interface LastActivity {
  /** Feature display label, for example "Face Lab". */
  label: string;
  /** Counts-only summary, for example "3 expression missions completed". */
  detail: string;
}

function activityStorage(): Storage | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
}

/**
 * Record the feature the person just used. Both arguments are composed
 * by the calling feature from labels and counts only; they are length
 * capped here as a second line of defense.
 */
export function setLastActivity(label: string, detail: string): void {
  const store = activityStorage();
  if (!store) return;
  const record: LastActivity = {
    label: label.trim().slice(0, LABEL_MAX_CHARS),
    detail: detail.trim().slice(0, DETAIL_MAX_CHARS),
  };
  if (!record.label) return;
  try {
    store.setItem(LAST_ACTIVITY_KEY, JSON.stringify(record));
  } catch {
    // Storage full or blocked: Ask the Lab simply offers no context chip.
  }
}

/** The recorded activity, or null when nothing valid is stored. */
export function getLastActivity(): LastActivity | null {
  const store = activityStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(LAST_ACTIVITY_KEY);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    const record = data as { label?: unknown; detail?: unknown };
    if (typeof record.label !== 'string' || !record.label.trim()) return null;
    if (typeof record.detail !== 'string') return null;
    return {
      label: record.label.slice(0, LABEL_MAX_CHARS),
      detail: record.detail.slice(0, DETAIL_MAX_CHARS),
    };
  } catch {
    return null;
  }
}
