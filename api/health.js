export default async function handler(req, res) {
  res.status(200).json({
    status: 'ok',
    service: 'Social Media Content Analyzer API',
    timestamp: new Date().toISOString(),
    env: {
      hasOcrKey: !!process.env.OCR_SPACE_API_KEY,
      nodeVersion: process.version
    }
  })
}
