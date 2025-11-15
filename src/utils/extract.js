async function ensurePdfWorker(pdfjsLibParam) {
  const pdfjsLib = pdfjsLibParam || (await import('pdfjs-dist/legacy/build/pdf'))
  try {
    if (pdfjsLib.GlobalWorkerOptions && pdfjsLib.GlobalWorkerOptions.workerSrc) return
    // Try bundler-friendly entry first
    try {
      const workerModule = await import('pdfjs-dist/build/pdf.worker.entry')
      const workerVal = workerModule && (workerModule.default || workerModule)
      if (typeof workerVal === 'string') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerVal
      } else {
        // If bundler provides a blob/url or function, try toString as fallback
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerVal.toString()
      }
      return
    } catch (e) {
      // fallback to resolving a relative worker path
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.js', import.meta.url).toString()
        return
      } catch (err) {
        console.warn('pdfjs worker resolution failed', err)
      }
    }
  } catch (err) {
    console.warn('Could not set pdfjs workerSrc automatically:', err)
  }
}

export async function extractPdfText(file, onProgress = () => {}) {
  // dynamic import to keep initial bundle small
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf')
  await ensurePdfWorker()
  const arrayBuffer = await file.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  onProgress({ status: 'loaded-document', numPages: doc.numPages })
  let fullText = ''

  for (let i = 1; i <= doc.numPages; i++) {
    onProgress({ status: 'processing-page', page: i, numPages: doc.numPages })
    const page = await doc.getPage(i)
    // normalizeWhitespace helps preserve readable spacing
    let content
    try {
      content = await page.getTextContent({ normalizeWhitespace: true })
    } catch (err) {
      console.warn('getTextContent failed for page', i, err)
      onProgress({ status: 'getTextContent-failed', page: i, error: String(err) })
      content = { items: [] }
    }
    // items may expose text in `str` or `unicode` depending on PDF; be defensive
    const strings = content.items.map((item) => item.str || item.unicode || '').filter(Boolean)
    let pageText = strings.join(' ')

    // If no selectable text (likely a scanned page), render to canvas and OCR the page
    if (!pageText.trim()) {
      try {
        // Use a modest scale to avoid huge canvas sizes that can hang the browser
        const viewport = page.getViewport({ scale: 1 })
        const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
        if (canvas) {
          onProgress({ status: 'rendering-page', page: i })
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          const ctx = canvas.getContext('2d')
          await page.render({ canvasContext: ctx, viewport }).promise
          // toBlob can sometimes return null on very large canvases; fallback to toDataURL
          let blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
          if (!blob) {
            try {
              const dataUrl = canvas.toDataURL('image/png')
              const res = await fetch(dataUrl)
              blob = await res.blob()
            } catch (e) {
              console.warn('canvas toBlob and toDataURL both failed', e)
            }
          }
          if (blob) {
            onProgress({ status: 'ocr-page', page: i })
            const ocrResult = await ocrImage(blob, onProgress)
            pageText = (ocrResult || '').trim()
          }
        }
      } catch (err) {
        console.warn('Page OCR fallback failed for page', i, err)
        onProgress({ status: 'ocr-failed', page: i, error: String(err) })
      }
    }

    fullText += (pageText || '') + '\n\n'
    onProgress({ status: 'page-done', page: i })
  }

  onProgress({ status: 'done', length: fullText.length })
  return fullText.trim()
}

export async function generatePagePreviews(file, scale = 0.5) {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf')
  await ensurePdfWorker()
  const arrayBuffer = await file.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const previews = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const viewport = page.getViewport({ scale })
    const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
    if (!canvas) break
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const ctx = canvas.getContext('2d')
    await page.render({ canvasContext: ctx, viewport }).promise
    const dataUrl = canvas.toDataURL('image/png')
    previews.push({ page: i, dataUrl })
  }
  return { numPages: doc.numPages, previews }
}

export async function extractPdfPages(file, pageNumbers = [], onProgress = () => {}) {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf')
  await ensurePdfWorker()
  const arrayBuffer = await file.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  let fullText = ''
  for (const i of pageNumbers) {
    onProgress({ status: 'processing-page', page: i, numPages: doc.numPages })
    const page = await doc.getPage(i)
    let content
    try {
      content = await page.getTextContent({ normalizeWhitespace: true })
    } catch (err) {
      content = { items: [] }
    }
    const strings = content.items.map((item) => item.str || item.unicode || '').filter(Boolean)
    let pageText = strings.join(' ')
    if (!pageText.trim()) {
      // render and OCR page image
      const viewport = page.getViewport({ scale: 1 })
      const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
      if (canvas) {
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        const ctx = canvas.getContext('2d')
        await page.render({ canvasContext: ctx, viewport }).promise
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
        if (blob) {
          onProgress({ status: 'ocr-page', page: i })
          const ocrResult = await ocrImage(blob, onProgress)
          pageText = (ocrResult || '').trim()
        }
      }
    }
    fullText += (pageText || '') + '\n\n'
    onProgress({ status: 'page-done', page: i })
  }
  onProgress({ status: 'done', length: fullText.length })
  return fullText.trim()
}

export async function ocrImage(file, onProgress = () => {}) {
  const mod = await import('tesseract.js')
  const createWorker = mod.createWorker || (mod.default && mod.default.createWorker)
  const OCR_TIMEOUT_MS = 60_000 // 60s timeout for long OCR tasks

  // If createWorker is available, use the worker API (recommended). Otherwise,
  // fallback to any available recognize function on the module.
  if (createWorker) {
    const worker = createWorker({ logger: (m) => onProgress(m) })
    try {
      onProgress({ status: 'worker-load' })
      if (typeof worker.load === 'function') await worker.load()
      onProgress({ status: 'language-load' })
      if (typeof worker.loadLanguage === 'function') await worker.loadLanguage('eng')
      onProgress({ status: 'initialize' })
      if (typeof worker.initialize === 'function') await worker.initialize('eng')

      onProgress({ status: 'recognize-start' })
      // Some bundling shapes may not expose `recognize` on the worker instance
      // immediately; double-check and fall back to module-level recognize when needed.
      let recognizePromise
      if (typeof worker.recognize === 'function') {
        try {
          recognizePromise = worker.recognize(file)
        } catch (e) {
          // If calling recognize throws synchronously, fallback later
          recognizePromise = Promise.reject(e)
        }
      } else {
        recognizePromise = Promise.reject(new Error('worker.recognize not available'))
      }
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('OCR timeout')), OCR_TIMEOUT_MS)
      )
      let result
      try {
        result = await Promise.race([recognizePromise, timeoutPromise])
      } catch (err) {
        // If worker.recognize wasn't available or failed, try module-level fallback
        onProgress({ status: 'recognize-failed', error: String(err) })
        const modFallback = mod.recognize || (mod.default && mod.default.recognize)
        if (typeof modFallback === 'function') {
          try {
            onProgress({ status: 'recognize-start-fallback-module' })
            const fallbackResult = await Promise.race([modFallback(file), timeoutPromise])
            result = fallbackResult
          } catch (e) {
            try {
              if (typeof worker.terminate === 'function') await worker.terminate()
            } catch (e2) {
              console.warn('Failed to terminate worker after fallback failure', e2)
            }
            onProgress({ status: 'recognize-failed-fallback', error: String(e) })
            throw e
          }
        } else {
          try {
            if (typeof worker.terminate === 'function') await worker.terminate()
          } catch (e2) {
            console.warn('Failed to terminate worker after error', e2)
          }
          throw err
        }
      }

      onProgress({ status: 'recognize-done' })
      const { data } = result || {}
      return data?.text || ''
    } finally {
      try {
        if (typeof worker.terminate === 'function') await worker.terminate()
      } catch (e) {
        console.warn('worker termination failed', e)
      }
    }
  }

  // Fallback: module-level recognize (some builds expose a direct recognize function)
  const recognizeFn = mod.recognize || (mod.default && mod.default.recognize)
  if (recognizeFn) {
    onProgress({ status: 'recognize-start-fallback' })
    const recognizePromise = recognizeFn(file)
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('OCR timeout')), OCR_TIMEOUT_MS)
    )
    const result = await Promise.race([recognizePromise, timeoutPromise])
    onProgress({ status: 'recognize-done-fallback' })
    const { data } = result || {}
    return data?.text || ''
  }

  throw new Error('No usable tesseract API found in module')
}
