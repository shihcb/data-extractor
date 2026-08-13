import { createWorker } from 'tesseract.js';

/**
 * Runs OCR on an image file or blob to extract text content
 * @param {File|Blob|string} imageSource 
 * @param {Function} [onProgress]
 * @returns {Promise<string>} Extracted raw text
 */
export async function parseImageText(imageSource, onProgress) {
  let worker;
  try {
    worker = await createWorker('eng', 1, {
      logger: m => {
        if (onProgress && m.status === 'recognizing text') {
          onProgress(Math.round((m.progress || 0) * 100));
        }
      }
    });

    const { data: { text } } = await worker.recognize(imageSource);
    await worker.terminate();
    return text;
  } catch (error) {
    if (worker) {
      await worker.terminate().catch(() => {});
    }
    console.error('Image OCR error:', error);
    throw new Error('Failed to perform OCR on image: ' + (error.message || 'Unknown error'));
  }
}
