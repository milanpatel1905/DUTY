'use client'
import { useState, useRef } from 'react'

export default function IngestPanel({ onIngested }: { onIngested: ()=>void }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [results, setResults] = useState<{filename: string, duties: number}[]>([])
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const upload = async (fd: FormData) => {
    setBusy(true); setMsg(''); setResults([])
    const res = await fetch('/api/ingest', { method: 'POST', body: fd })
    const j = await res.json()
    setMsg(`Processed ${j.filesProcessed} files, found ${j.dutiesFound} duties for Milan Patel / MDP.`)
    if (j.files) setResults(j.files)
    setBusy(false)
    onIngested()
  }

  const handlePdfFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const fd = new FormData()
    Array.from(files).forEach(f => {
      if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
        fd.append('pdfs', f, f.name)
      }
    })
    if (Array.from(fd.keys()).length > 0) upload(fd)
    if (pdfInputRef.current) pdfInputRef.current.value = ''
  }

  return (
    <div className="card space-y-4">
      <h2 className="text-lg font-semibold">Ingest WhatsApp</h2>
      <div>
        <label className="text-sm text-zinc-600">Upload WhatsApp Export ZIP</label>
        <input type="file" accept=".zip"
          disabled={busy}
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) { const fd = new FormData(); fd.append('zip', f); upload(fd) }
          }}
        />
        <p className="text-xs text-zinc-500 mt-1">Export from WhatsApp: Group Info → Export Chat → Include Media</p>
      </div>

      {/* Multi-PDF Uploader */}
      <div>
        <label className="text-sm text-zinc-600 font-medium">Upload PDF rosters (multiple)</label>
        <div 
          onDragOver={e => { e.preventDefault(); setDragOver(true)}}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault(); setDragOver(false)
            handlePdfFiles(e.dataTransfer.files)
          }}
          className={`mt-2 border-2 border-dashed rounded-xl p-4 text-center transition cursor-pointer ${dragOver ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-300 hover:border-zinc-400'}`}
          onClick={() => pdfInputRef.current?.click()}
        >
          <div className="text-sm">
            {busy ? 'Parsing PDFs…' : 'Drag & drop PDFs here, or click to select'}
          </div>
          <div className="text-xs text-zinc-500 mt-1">Supports multiple files – Evaluation / Showing / Supervision lists</div>
          <input
            ref={pdfInputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="hidden"
            disabled={busy}
            onChange={e => handlePdfFiles(e.target.files)}
          />
        </div>
        <button 
          className="btn-secondary mt-2 w-full"
          disabled={busy}
          onClick={() => pdfInputRef.current?.click()}
        >
          {busy ? 'Processing…' : 'Select PDF files'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 pt-2 border-t border-zinc-100">
        <div>
          <label className="text-sm text-zinc-600">Or paste chat text</label>
          <textarea id="wa_text" rows={3} placeholder="MDP: Night duty on 25/07 ..."></textarea>
          <button className="btn-secondary mt-2 w-full" disabled={busy} onClick={()=>{
            const el = document.getElementById('wa_text') as HTMLTextAreaElement
            const fd = new FormData(); fd.append('text', el.value); upload(fd); el.value=''
          }}>Parse Text</button>
        </div>
      </div>

      {msg && <p className="text-sm text-emerald-700 font-medium">{msg}</p>}
      
      {results.length > 0 && (
        <div className="text-xs bg-zinc-50 rounded-xl p-3 border border-zinc-200">
          <div className="font-medium mb-1">Per-file results:</div>
          <ul className="space-y-1">
            {results.map((r,i)=>(
              <li key={i} className="flex justify-between">
                <span className="truncate pr-2 text-zinc-600">{r.filename}</span>
                <span className="font-medium">{r.duties} duties</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-[11px] text-zinc-500">Watching for: <b>Milan Patel, MDP</b> – edit WATCH_NAMES in .env to add more</p>
    </div>
  )
}
