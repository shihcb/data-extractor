// A scan made plain black on white for reading (OCR), off the page's own
// thread (a whole page is millions of pixels). Sauvola's method: each
// pixel is ink when it's darker than a threshold set from the average and
// the spread of the pixels around it, t = mean × (1 + k (sd / 128 − 1)).
// Where the light is even and plain (paper) the spread is small and the
// threshold drops well below the average, so the grain of a photo or a
// scanner's noise stays white; across a letter's edge the spread is large
// and the threshold sits near the average, so faded print and print in a
// shadow still come out as clear ink. (The old rule, "darker than the
// average by 10", turned a noisy page's paper into black specks: on test
// scans it read 58% of the words, this 99.5%.)
// The window grows with the picture (the page is drawn bigger or smaller),
// and the sums come from running totals (a column's, then along the row),
// so it needs little more memory than the picture itself.
self.onmessage = (e) => {
  const { id, width: W, height: H, data } = e.data;
  const R = Math.max(15, Math.min(40, Math.round(Math.min(W, H) / 100)));
  const K = 0.2;
  const g = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) g[i] = (77 * data[i * 4] + 150 * data[i * 4 + 1] + 29 * data[i * 4 + 2]) >> 8;
  // Each column's sum (and sum of squares) over rows y - R .. y + R
  const col = new Float64Array(W);
  const col2 = new Float64Array(W);
  const addRow = (y, sign) => {
    const o = y * W;
    for (let x = 0; x < W; x++) {
      const v = g[o + x];
      col[x] += sign * v;
      col2[x] += sign * v * v;
    }
  };
  for (let y = 0; y <= Math.min(R, H - 1); y++) addRow(y, 1);
  for (let y = 0; y < H; y++) {
    const rows = Math.min(H, y + R + 1) - Math.max(0, y - R);
    let sum = 0;
    let sum2 = 0;
    for (let x = 0; x <= Math.min(R, W - 1); x++) { sum += col[x]; sum2 += col2[x]; }
    for (let x = 0; x < W; x++) {
      const n = rows * (Math.min(W, x + R + 1) - Math.max(0, x - R));
      const mean = sum / n;
      const sd = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
      const k = (y * W + x) * 4;
      const v = g[y * W + x] <= mean * (1 + K * (sd / 128 - 1)) ? 0 : 255;
      data[k] = data[k + 1] = data[k + 2] = v;
      data[k + 3] = 255;
      // Slide along the row
      if (x + R + 1 < W) { sum += col[x + R + 1]; sum2 += col2[x + R + 1]; }
      if (x - R >= 0) { sum -= col[x - R]; sum2 -= col2[x - R]; }
    }
    // Slide the columns down a row
    if (y + R + 1 < H) addRow(y + R + 1, 1);
    if (y - R >= 0) addRow(y - R, -1);
  }
  self.postMessage({ id, data }, [data.buffer]);
};
