import formidable from 'formidable'
import fs from 'fs'
import FormData from 'form-data'
import axios from 'axios'

const OCR_SPACE_URL = 'https://api.ocr.space/parse/image'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const form = new formidable.IncomingForm({ multiples: false })

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('form parse error', err)
      return res.status(400).json({ error: 'Invalid form data' })
    }

    const file = files?.file
    if (!file) return res.status(400).json({ error: 'No file uploaded' })

    try {
      const filePath = file.filepath || file.path
      const stream = fs.createReadStream(filePath)

      // Allow passing an API key in the form (useful for testing) or via
      // environment variable `OCR_SPACE_API_KEY`. Fall back to demo key.
      const OCR_KEY = (fields && (fields.apikey || fields.APIKEY)) || process.env.OCR_SPACE_API_KEY || process.env.OCR_KEY || 'helloworld'
      if (!OCR_KEY || OCR_KEY === 'helloworld') {
        console.warn('Using demo OCR.space key (helloworld). For production set OCR_SPACE_API_KEY env var.')
      }

      const formData = new FormData()
      formData.append('apikey', OCR_KEY)
      formData.append('language', 'eng')
      formData.append('isOverlayRequired', 'false')
      formData.append('detectOrientation', 'true')
      formData.append('file', stream, { filename: file.originalFilename || file.newFilename || 'upload' })

      const headers = formData.getHeaders()
      const response = await axios.post(OCR_SPACE_URL, formData, { headers, maxContentLength: Infinity, maxBodyLength: Infinity, timeout: 120000 })
      const data = response.data
      const parsed = (data.ParsedResults && data.ParsedResults[0] && data.ParsedResults[0].ParsedText) || ''
      return res.status(200).json({ text: parsed, raw: data })
    } catch (e) {
      console.error('OCR proxy error', e?.response?.status, e?.response?.data || e.message || e)
      const details = e?.response?.data || e.message || String(e)
      return res.status(502).json({ error: 'OCR provider request failed', details: typeof details === 'string' ? details : JSON.stringify(details) })
    }
  })
}
