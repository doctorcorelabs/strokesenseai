import { describe, expect, it } from 'vitest';
import { laplacianVariance, lightingBalance, toGrayscale } from './imageStats';
import type { GrayImage } from './imageStats';

function grayImage(width: number, height: number, fill: (x: number, y: number) => number): GrayImage {
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      data[y * width + x] = fill(x, y);
    }
  }
  return { data, width, height };
}

describe('toGrayscale', () => {
  it('converts pure red with the standard luminance weights', () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255]);
    const gray = toGrayscale(rgba, 1, 1);
    expect(gray.data[0]).toBeCloseTo(76.245, 2);
  });
});

describe('laplacianVariance', () => {
  it('scores a flat image as zero sharpness', () => {
    const image = grayImage(12, 12, () => 128);
    expect(laplacianVariance(image)).toBe(0);
  });

  it('scores a crisp checkerboard as very sharp', () => {
    const image = grayImage(12, 12, (x, y) => ((x + y) % 2 === 0 ? 0 : 255));
    expect(laplacianVariance(image)).toBeGreaterThan(100_000);
  });

  it('returns zero for images too small to evaluate', () => {
    expect(laplacianVariance(grayImage(2, 2, () => 200))).toBe(0);
  });
});

describe('lightingBalance', () => {
  const whole = { x: 0, y: 0, width: 1, height: 1 };

  it('reports perfectly even lighting as 1', () => {
    expect(lightingBalance(grayImage(10, 10, () => 120), whole)).toBeCloseTo(1, 6);
  });

  it('reports a dark left half against a bright right half', () => {
    const image = grayImage(10, 10, (x) => (x < 5 ? 50 : 200));
    expect(lightingBalance(image, whole)).toBeCloseTo(0.25, 6);
  });

  it('is symmetric: a dark right half gives the same ratio', () => {
    const image = grayImage(10, 10, (x) => (x < 5 ? 200 : 50));
    expect(lightingBalance(image, whole)).toBeCloseTo(0.25, 6);
  });
});
