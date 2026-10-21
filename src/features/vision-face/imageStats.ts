// Pixel statistics for the photo quality gate.
//
// These functions work on plain grayscale pixel arrays so they can be
// tested without a canvas. The component layer is responsible for drawing
// an uploaded photo or camera snapshot to a canvas and handing the pixels
// over; nothing here touches the DOM and nothing leaves the device.

export interface GrayImage {
  /** Row-major luminance values, 0..255. */
  data: Float32Array | Uint8Array | number[];
  width: number;
  height: number;
}

/** Convert RGBA bytes (ImageData layout) to a grayscale image. */
export function toGrayscale(rgba: Uint8ClampedArray | number[], width: number, height: number): GrayImage {
  const data = new Float32Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4;
    const r = rgba[offset] ?? 0;
    const g = rgba[offset + 1] ?? 0;
    const b = rgba[offset + 2] ?? 0;
    data[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return { data, width, height };
}

/**
 * Variance of the Laplacian: a standard sharpness proxy. Flat or blurry
 * regions score near 0; crisp edges score in the hundreds. This describes
 * the image only; a low score means "too blurry to measure", never a
 * statement about the person in it.
 */
export function laplacianVariance(image: GrayImage): number {
  const { data, width, height } = image;
  if (width < 3 || height < 3) return 0;
  let count = 0;
  let sum = 0;
  let sumSq = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const value =
        (data[i - width] ?? 0) + (data[i + width] ?? 0) + (data[i - 1] ?? 0) + (data[i + 1] ?? 0) - 4 * (data[i] ?? 0);
      sum += value;
      sumSq += value * value;
      count += 1;
    }
  }
  if (count === 0) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

/**
 * Mean luminance of the left and right halves of a region, returned as a
 * balance ratio min/max in 0..1. 1 means perfectly even lighting.
 * The region is given in normalized image coordinates.
 */
export function lightingBalance(
  image: GrayImage,
  region: { x: number; y: number; width: number; height: number },
): number {
  const x0 = Math.max(0, Math.floor(region.x * image.width));
  const x1 = Math.min(image.width, Math.ceil((region.x + region.width) * image.width));
  const y0 = Math.max(0, Math.floor(region.y * image.height));
  const y1 = Math.min(image.height, Math.ceil((region.y + region.height) * image.height));
  if (x1 - x0 < 2 || y1 - y0 < 1) return 1;
  const midX = Math.floor((x0 + x1) / 2);
  let leftSum = 0;
  let leftCount = 0;
  let rightSum = 0;
  let rightCount = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const value = image.data[y * image.width + x] ?? 0;
      if (x < midX) {
        leftSum += value;
        leftCount += 1;
      } else {
        rightSum += value;
        rightCount += 1;
      }
    }
  }
  if (leftCount === 0 || rightCount === 0) return 1;
  const leftMean = leftSum / leftCount;
  const rightMean = rightSum / rightCount;
  const brighter = Math.max(leftMean, rightMean);
  if (brighter <= 0) return 1;
  return Math.min(leftMean, rightMean) / brighter;
}
