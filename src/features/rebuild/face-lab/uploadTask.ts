// Which vision task an uploaded file maps to in Face Lab.
//
// The Worker allowlists task names, so the choice is made here, in
// one place, from the file's MIME kind only: a still image is the
// single-photo exercise, a video is the frame-sequence exercise.
// Anything that is not a video is treated as a photo; the upload
// panel has already rejected files that are neither before this is
// consulted.

import type { VisionTask } from '../../../ai/visionClient';

export function visionTaskForFile(file: File): Extract<VisionTask, 'face-photo' | 'face-video'> {
  return file.type.startsWith('video/') ? 'face-video' : 'face-photo';
}
