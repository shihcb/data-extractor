// Works out what an image comes out as (its size in bytes), off the page's
// own thread: encoding a big image on it froze the screen for a moment, so
// anything moving at the time (the quality slider opening, a row sliding
// in) stuttered.
self.onmessage = async (e) => {
  const { id, bitmap, width, height, mime, quality, opaque } = e.data;
  try {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (opaque) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await canvas.convertToBlob({ type: mime, quality });
    self.postMessage({ id, size: blob.size, type: blob.type });
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
