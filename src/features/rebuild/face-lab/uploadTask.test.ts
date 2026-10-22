import { describe, expect, it } from 'vitest';
import { visionTaskForFile } from './uploadTask';

function file(type: string): File {
  return new File(['x'], 'upload', { type });
}

describe('visionTaskForFile', () => {
  it('maps still images to the photo task', () => {
    expect(visionTaskForFile(file('image/jpeg'))).toBe('face-photo');
    expect(visionTaskForFile(file('image/png'))).toBe('face-photo');
  });

  it('maps videos to the frame-sequence task', () => {
    expect(visionTaskForFile(file('video/mp4'))).toBe('face-video');
    expect(visionTaskForFile(file('video/webm'))).toBe('face-video');
  });
});
