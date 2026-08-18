// Frame capture + cheap change detection, all client-side.

const DIFF_W = 48;
const DIFF_H = 36;

/** Capture the current video frame as a JPEG data URL (max 1024px wide). */
export function captureFrame(video: HTMLVideoElement): string | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const scale = Math.min(1, 1024 / video.videoWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.7);
}

/** Downscaled grayscale fingerprint of the current video frame. */
export function fingerprint(video: HTMLVideoElement): Uint8Array | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const canvas = document.createElement("canvas");
  canvas.width = DIFF_W;
  canvas.height = DIFF_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, DIFF_W, DIFF_H);
  const { data } = ctx.getImageData(0, 0, DIFF_W, DIFF_H);
  const gray = new Uint8Array(DIFF_W * DIFF_H);
  for (let i = 0; i < gray.length; i++) {
    const o = i * 4;
    gray[i] = (data[o] * 299 + data[o + 1] * 587 + data[o + 2] * 114) / 1000;
  }
  return gray;
}

/** Mean absolute luminance difference between two fingerprints (0–255). */
export function diffScore(a: Uint8Array, b: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}
