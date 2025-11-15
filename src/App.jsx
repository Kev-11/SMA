import React from 'react'
import Upload from './components/Upload'
const logo = '/favicon.svg'

export default function App() {
  return (
    <div className="app">
      <header style={{display:'flex',alignItems:'center',gap:12}}>
        <img src={logo} alt="logo" style={{width:48,height:48}} />
        <div>
          <h1>Social Media Content Analyzer</h1>
          <p>Upload PDFs or images to extract text and get engagement suggestions.</p>
        </div>
      </header>
      <main>
        <Upload />
      </main>
    </div>
  )
}
