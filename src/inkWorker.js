// A scan made plain black on white for reading (OCR), off the page's own
// thread (a whole page is millions of pixels). Each pixel is compared with
// the average around it (31px across), so uneven light, a shadow over a
// photographed page or faded thermal print all come out as clear ink:
// on a scanned receipt this read noticeably more of it right. The averages
// come from running sums (a column's, then along the row), so it needs
// little more memory than the picture itself.
self.onmessage = (e) => {
  const { id, width: W, height: H, data } = e.data;
  const R = 15;
  const g = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) g[i] = (77 * data[i * 4] + 150 * data[i * 4 + 1] + 29 * data[i * 4 + 2]) >> 8;
  const col = new Uint32Array(W); // each column's sum over rows y - R .. y + R
  for (let y = 0; y <= Math.min(R, H - 1); y++) for (let x = 0; x < W; x++) col[x] += g[y * W + x];
  for (let y = 0; y < H; y++) {
    const rows = Math.min(H, y + R + 1) - Math.max(0, y - R);
    let sum = 0;
    for (let x = 0; x <= Math.min(R, W - 1); x++) sum += col[x];
    for (let x = 0; x < W; x++) {
      const cols = Math.min(W, x + R + 1) - Math.max(0, x - R);
      const mean = sum / (rows * cols);
      const k = (y * W + x) * 4;
      const v = g[y * W + x] < mean - 10 ? 0 : 255;
      data[k] = data[k + 1] = data[k + 2] = v;
      data[k + 3] = 255;
      // Slide along the row
      if (x + R + 1 < W) sum += col[x + R + 1];
      if (x - R >= 0) sum -= col[x - R];
    }
    // Slide the columns down a row
    if (y + R + 1 < H) for (let x = 0; x < W; x++) col[x] += g[(y + R + 1) * W + x];
    if (y - R >= 0) for (let x = 0; x < W; x++) col[x] -= g[(y - R) * W + x];
  }
  self.postMessage({ id, data }, [data.buffer]);
};
