import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

// pdf.js needs its fonts, character maps and image decoders at run time.
// They're served from /pdfjs/ (in dev straight from node_modules; in a build
// copied into the output).
const PDFJS_DIR = path.resolve('node_modules/pdfjs-dist')
const PDFJS_ASSETS = ['cmaps', 'standard_fonts', 'wasm']

function pdfjsAssets() {
  return {
    name: 'pdfjs-assets',
    configureServer(server) {
      server.middlewares.use('/pdfjs', (req, res, next) => {
        const rel = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '')
        const [dir] = rel.split('/')
        const file = path.join(PDFJS_DIR, rel)
        // Only files inside the three asset folders (no "../" out of them)
        const inside = PDFJS_ASSETS.includes(dir) && file.startsWith(path.join(PDFJS_DIR, dir) + path.sep)
        if (!inside || !fs.existsSync(file) || !fs.statSync(file).isFile()) return next()
        if (file.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm')
        fs.createReadStream(file).pipe(res)
      })
    },
    generateBundle() {
      for (const dir of PDFJS_ASSETS) {
        for (const name of fs.readdirSync(path.join(PDFJS_DIR, dir))) {
          if (name.startsWith('LICENSE')) continue
          this.emitFile({
            type: 'asset',
            fileName: `pdfjs/${dir}/${name}`,
            source: fs.readFileSync(path.join(PDFJS_DIR, dir, name)),
          })
        }
      }
    },
  }
}

// Reading words from pictures of text (the PDF editor, for emails whose
// header is pictures): Tesseract's worker, its engine (the LSTM builds; it
// picks the one the browser runs fastest) and its English data, served from
// /ocr/. Fetched only the first time a picture is read.
const OCR_FILES = {
  'worker.min.js': 'node_modules/tesseract.js/dist/worker.min.js',
  'tesseract-core-lstm.wasm.js': 'node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm.js': 'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-relaxedsimd-lstm.wasm.js': 'node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js',
  'eng.traineddata.gz': 'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
}

function ocrAssets() {
  return {
    name: 'ocr-assets',
    configureServer(server) {
      server.middlewares.use('/ocr', (req, res, next) => {
        const name = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '')
        const file = OCR_FILES[name]
        if (!file) return next()
        res.setHeader('Content-Type', name.endsWith('.gz') ? 'application/octet-stream' : 'text/javascript')
        fs.createReadStream(path.resolve(file)).pipe(res)
      })
    },
    generateBundle() {
      for (const [name, file] of Object.entries(OCR_FILES)) {
        this.emitFile({ type: 'asset', fileName: `ocr/${name}`, source: fs.readFileSync(path.resolve(file)) })
      }
    },
  }
}

// Offline support: writes sw.js with every built file in its keep list,
// named by this build's content (so a new build replaces the old cache).
// Character maps are left to be cached as they're used (there are ~170).
function serviceWorker() {
  return {
    name: 'service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle)
        // (character maps and the picture-reading files are big and rarely
        // needed: kept as they're used, not up front)
        .filter(f => !f.startsWith('pdfjs/cmaps/') && !f.startsWith('ocr/') && !f.endsWith('.map'))
        .map(f => `/${f}`)
      const publicFiles = fs.readdirSync('public').filter(f => f !== 'sw.js').map(f => `/${f}`)
      const precache = ['/', ...publicFiles, ...files]
      const version = crypto.createHash('sha256').update(Object.keys(bundle).sort().join('|')).digest('hex').slice(0, 12)
      const template = fs.readFileSync(path.resolve('sw.template.js'), 'utf8')
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template
          .replace('__CACHE_NAME__', `toolbox-${version}`)
          .replace('__PRECACHE__', JSON.stringify(precache, null, 2)),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), pdfjsAssets(), ocrAssets(), serviceWorker()],
})
