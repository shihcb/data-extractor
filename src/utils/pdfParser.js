import * as pdfjsLib from 'pdfjs-dist';

// Configure worker URL dynamically from CDN to match installed version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

/**
 * Extracts raw text content page by page from an uploaded PDF file Buffer or ArrayBuffer
 * @param {ArrayBuffer} arrayBuffer 
 * @returns {Promise<{ fullText: string, pageTexts: string[], numPages: number }>}
 */
export async function parsePdfText(arrayBuffer) {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDocument = await loadingTask.promise;
    const numPages = pdfDocument.numPages;
    const pageTexts = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Combine text items preserving approximate spacing
      const pageString = textContent.items
        .map(item => item.str)
        .join(' ');

      pageTexts.push(pageString);
    }

    const fullText = pageTexts.join('\n\n');
    return {
      fullText,
      pageTexts,
      numPages
    };
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Failed to parse PDF document: ' + (error.message || 'Unknown error'));
  }
}

/**
 * Renders the first page of a PDF to a base64 JPEG string
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<string|null>} base64 image data
 */
export async function renderPdfPageToImage(arrayBuffer) {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDocument = await loadingTask.promise;
    if (pdfDocument.numPages === 0) return null;
    
    const page = await pdfDocument.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    await page.render({ canvasContext: context, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    return dataUrl.split(',')[1];
  } catch (error) {
    console.warn('PDF page rendering failed:', error);
    return null;
  }
}
