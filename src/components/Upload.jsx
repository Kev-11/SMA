import React, { useState, useRef, useEffect } from 'react'
import { extractPdfText, ocrImage, generatePagePreviews, extractPdfPages } from '../utils/extract'

export default function Upload() {
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(null)
  const [logs, setLogs] = useState([])
  const [useServerOCR, setUseServerOCR] = useState(true)
  const [text, setText] = useState('')
  const fileInputRef = useRef()
  const [fileName, setFileName] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [pdfPreviews, setPdfPreviews] = useState([])
  const [numPages, setNumPages] = useState(0)
  const [selectedPages, setSelectedPages] = useState([])
  const [currentFile, setCurrentFile] = useState(null)

  async function handleFiles(files) {
    setError(null)
    setText('')
    const file = files[0]
    if (!file) return
    setLoading(true)
    try {
      // clear previous preview
      setFileName(file.name)
      setCurrentFile(file)
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
      }
      if (file.type.startsWith('image/')) {
        setPreviewUrl(URL.createObjectURL(file))
      }
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        // generate previews for PDF
        try {
          setProgress({ status: 'generating-previews' })
          const { numPages: np, previews } = await generatePagePreviews(file, 0.7)
          setNumPages(np)
          setPdfPreviews(previews)
          setSelectedPages(previews.map(p => p.page))
          setLogs(s => [...s, JSON.stringify({ status: 'previews-generated', numPages: np })])
        } catch (e) {
          console.warn('preview generation failed', e)
        }
      }
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        if (useServerOCR) {
          // send file to server OCR endpoint (with graceful fallback to client-side OCR)
          setProgress({ status: 'server-ocr-start' })
          setLogs((s) => [...s, JSON.stringify({ status: 'server-ocr-start' })])
          const form = new FormData()
          form.append('file', file, file.name)
          try {
            const resp = await fetch('/api/ocr', { method: 'POST', body: form })
            let data
            try {
              data = await resp.json()
            } catch (e) {
              const textResp = await resp.text().catch(() => '')
              throw new Error(textResp || 'Server returned invalid JSON')
            }
            if (!resp.ok) throw new Error(data?.error || JSON.stringify(data) || 'Server OCR failed')
            setText(data.text || '')
            setProgress({ status: 'server-ocr-done' })
            setLogs((s) => [...s, JSON.stringify({ status: 'server-ocr-done' })])
          } catch (err) {
            console.warn('Server OCR failed, falling back to client OCR', err)
            setLogs((s) => [...s, JSON.stringify({ status: 'server-ocr-failed', error: String(err) })])
            // Fallback to client-side extraction
            try {
              const extracted = await extractPdfText(file, (p) => {
                setProgress(p)
                setLogs((s) => [...s, JSON.stringify(p)])
              })
              setText(extracted)
            } catch (e2) {
              throw e2
            }
          }
        } else {
          const extracted = await extractPdfText(file, (p) => {
            console.debug('pdf progress', p)
            setProgress(p)
            setLogs((s) => [...s, JSON.stringify(p)])
          })
          setText(extracted)
        }
      } else if (file.type.startsWith('image/') || /\.(png|jpe?g|bmp|tiff)$/i.test(file.name)) {
        if (useServerOCR) {
          setProgress({ status: 'server-ocr-start' })
          setLogs((s) => [...s, JSON.stringify({ status: 'server-ocr-start' })])
          const form = new FormData()
          form.append('file', file, file.name)
          try {
            const resp = await fetch('/api/ocr', { method: 'POST', body: form })
            let data
            try {
              data = await resp.json()
            } catch (e) {
              const textResp = await resp.text().catch(() => '')
              throw new Error(textResp || 'Server returned invalid JSON')
            }
            if (!resp.ok) throw new Error(data?.error || JSON.stringify(data) || 'Server OCR failed')
            setText(data.text || '')
            setProgress({ status: 'server-ocr-done' })
            setLogs((s) => [...s, JSON.stringify({ status: 'server-ocr-done' })])
          } catch (err) {
            console.warn('Server OCR failed, falling back to client OCR', err)
            setLogs((s) => [...s, JSON.stringify({ status: 'server-ocr-failed', error: String(err) })])
            // Fallback to client-side OCR for images
            try {
              const extracted = await ocrImage(file, (p) => {
                setProgress(p)
                setLogs((s) => [...s, JSON.stringify(p)])
              })
              setText(extracted)
            } catch (e2) {
              throw e2
            }
          }
        } else {
          setProgress({ status: 'ocr-start' })
          setLogs((s) => [...s, JSON.stringify({ status: 'ocr-start' })])
          const extracted = await ocrImage(file, (p) => {
            console.debug('ocr progress', p)
            setProgress(p)
            setLogs((s) => [...s, JSON.stringify(p)])
          })
          setText(extracted)
        }
      } else {
        setError('Unsupported file type. Upload PDF or an image.')
      }
    } catch (err) {
      console.error(err)
      setError('Failed to extract text: ' + (err.message || err))
    } finally {
      setLoading(false)
    }
  }

  async function ocrSelectedPages() {
    if (!currentFile || selectedPages.length === 0) return
    setLoading(true)
    try {
      const extracted = await extractPdfPages(currentFile, selectedPages, (p) => {
        setProgress(p)
        setLogs(s => [...s, JSON.stringify(p)])
      })
      setText(extracted)
    } catch (e) {
      setError('Failed to OCR selected pages: ' + (e.message || e))
    } finally {
      setLoading(false)
    }
  }

  function togglePageSelection(page) {
    setSelectedPages(prev => prev.includes(page) ? prev.filter(p => p !== page) : [...prev, page].sort((a,b)=>a-b))
  }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer.files
    handleFiles(files)
  }

  function onSelect(e) {
    const files = e.target.files
    handleFiles(files)
  }

  return (
    <div className="upload-root">
      <div
        className={`dropzone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/*"
          style={{ display: 'none' }}
          onChange={onSelect}
        />
        <p>Drag & drop a PDF or image here, or click to choose a file</p>
      </div>

      <div className="meta panel" style={{marginTop:12}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div>
            <strong>File:</strong> <span className="filename">{fileName || 'No file selected'}</span>
          </div>
          <div className="controls">
            <button className="btn secondary" onClick={() => { setLogs([]); setError(null); setText('')}}>Clear</button>
            <button className="btn copy-btn" onClick={() => { navigator.clipboard.writeText(text || ''); }} title="Copy extracted text">Copy text</button>
          </div>
        </div>
        {previewUrl && (
          <div className="preview" style={{marginTop:10}}>
            <img src={previewUrl} alt="preview" style={{maxWidth:'100%'}} />
          </div>
        )}
        {pdfPreviews.length > 0 && (
          <div style={{marginTop:10}}>
            <strong>Pages</strong>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>
              {pdfPreviews.map(p => (
                <div key={p.page} style={{width:90,textAlign:'center'}}>
                  <div style={{border:selectedPages.includes(p.page)?`2px solid var(--accent)`:'2px solid transparent',borderRadius:8,padding:4}}>
                    <img src={p.dataUrl} alt={`p${p.page}`} style={{width:'100%',borderRadius:6}} />
                  </div>
                  <div style={{marginTop:6,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                    <label style={{fontSize:12}}>
                      <input type="checkbox" checked={selectedPages.includes(p.page)} onChange={() => togglePageSelection(p.page)} />
                      {' '}P{p.page}
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <div style={{marginTop:8}}>
              <button className="btn" onClick={ocrSelectedPages}>OCR selected pages</button>
            </div>
          </div>
        )}
      </div>

      <div className="status">
        {loading && (
          <div className="loading">
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div className="spinner" />
              <div>Extracting text — please wait...</div>
            </div>
            {progress && progress.status && <div style={{marginTop:8}}>Status: {progress.status}</div>}
            {progress && progress.page && (
              <div style={{marginTop:6}}>
                Page: {progress.page}{progress.numPages ? ` / ${progress.numPages}` : ''}
              </div>
            )}
          </div>
        )}
        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 14 }}>
            <input type="checkbox" checked={useServerOCR} onChange={(e) => setUseServerOCR(e.target.checked)} />
            {' '}
            Use server OCR (recommended for scanned PDFs)
          </label>
        </div>
        {error && <div className="error">{error}</div>}
        {progress && !loading && (
          <div className="info">Last status: {progress.status}</div>
        )}
        <div className="progress-log">
          <h4>Progress Log</h4>
          <div className="log-box">
            {logs.length === 0 && <div className="muted">No events yet.</div>}
            {logs.map((l, i) => (
              <div key={i} className="log-line">{l}</div>
            ))}
          </div>
        </div>
      </div>

      <section className="result">
        <h2>Extracted Text</h2>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} />
      </section>

      <section className="suggestions">
        <h2>Suggestions</h2>
        <Suggestions text={text} />
      </section>
    </div>
  )
}

function Suggestions({ text }) {
  if (!text) return <div>No text yet. Upload a document to get suggestions.</div>

  function countSyllables(word) {
    word = word.toLowerCase().replace(/[^a-z]/g, '')
    if (word.length <= 3) return 1
    const syl = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '')
    const matches = syl.match(/[aeiouy]{1,2}/g)
    return matches ? matches.length : 1
  }

  function fleschReadingEase(text) {
    const sentences = Math.max(1, (text.match(/[.!?]+/g) || []).length)
    const wordsArr = text.split(/\s+/).filter(Boolean)
    const words = Math.max(1, wordsArr.length)
    const syllables = wordsArr.reduce((sum, w) => sum + countSyllables(w), 0)
    // Flesch Reading Ease: 206.835 - 1.015*(words/sentences) - 84.6*(syllables/words)
    const score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words)
    return Math.round(score)
  }

  function sentimentEstimate(text) {
    const positive = ['good','great','awesome','love','excellent','happy','win','success','improve','best']
    const negative = ['bad','sad','terrible','hate','worse','problem','fail','poor','issue']
    const words = text.toLowerCase().split(/[^a-z]+/).filter(Boolean)
    let score = 0
    for (const w of words) {
      if (positive.includes(w)) score++
      if (negative.includes(w)) score--
    }
    return score
  }

  const words = text.split(/\s+/).filter(Boolean).length
  const suggestions = []
  if (words < 10) suggestions.push('Caption is very short — add context or a hook.')
  if (words > 280) suggestions.push('Consider shortening — long captions reduce engagement.')
  if (!/\b(https?:\/\/|www\.)/.test(text)) suggestions.push('Add a link or CTA where appropriate.')
  if (!/[#@]/.test(text)) suggestions.push('Add relevant hashtags or mentions to increase reach.')

  const flesch = fleschReadingEase(text)
  const sentiment = sentimentEstimate(text)

  return (
    <div>
      <div style={{display:'flex',gap:12,alignItems:'center'}}>
        <div style={{background:'linear-gradient(90deg,var(--accent),var(--accent-2))',padding:'8px 12px',borderRadius:10,color:'#0b0b0b',fontWeight:700}}>Score {flesch}</div>
        <div style={{color: 'var(--muted)'}}>Flesch Reading Ease</div>
        <div style={{marginLeft:'auto',color: sentiment>0?'#16a34a': sentiment<0? 'var(--danger)':'#f59e0b', fontWeight:600}}>{sentiment>0? 'Positive':'Neutral'}</div>
      </div>

      <div style={{marginTop:12,display:'grid',gridTemplateColumns:'1fr',gap:10}}>
        {suggestions.map((s, i) => (
          <div key={i} className="panel" style={{padding:12,display:'flex',gap:10,alignItems:'center'}}>
            <div style={{width:10,height:36,background:'linear-gradient(180deg,var(--accent),var(--accent-2))',borderRadius:6}} />
            <div style={{fontWeight:600}}>{s}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
