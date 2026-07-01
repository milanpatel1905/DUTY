'use client'
import { useEffect, useState } from 'react'
import IngestPanel from '@/components/IngestPanel'
import { format } from 'date-fns'

type Duty = {
  id: string
  title: string
  description: string | null
  dutyDate: string
  source: string
  assignee: string | null
  sender: string | null
  completed: boolean
  confidence: number
}

export default function Page() {
  const [duties, setDuties] = useState<Duty[]>([])
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const load = async (from?: string, to?: string) => {
    const f = from ?? fromDate
    const t = to ?? toDate
    const params = new URLSearchParams()
    if (f) params.set('from', f)
    if (t) params.set('to', t)
    const qs = params.toString() ? `?${params.toString()}` : ''
    const res = await fetch(`/api/duties${qs}`, { cache: 'no-store' })
    setDuties(await res.json())
  }
  useEffect(() => { load() }, [])

  const toggle = async (id: string, completed: boolean) => {
    await fetch('/api/duties', { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id, completed: !completed })})
    load()
  }

  const clearFilter = () => { setFromDate(''); setToDate(''); load('', '') }
  const applyFilter = () => load()

  const grouped = duties.reduce((acc: any, d) => {
    const day = format(new Date(d.dutyDate), 'yyyy-MM-dd')
    ;(acc[day] ||= []).push(d)
    return acc
  }, {})

  return (
    <main className="max-w-5xl mx-auto p-6 md:p-10 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">WhatsApp Duty Scheduler</h1>
          <p className="text-zinc-600 text-sm">Auto-extracts duties mentioning your name from WhatsApp chats & PDFs</p>
        </div>
        <div className="text-sm text-zinc-500">Asia/Kolkata</div>
      </header>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <IngestPanel onIngested={load} />
          <div className="card mt-4 text-sm text-zinc-600">
            <b>Live auto-ingest:</b>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Webhook: <code>/api/webhook/whatsapp</code></li>
              <li>Watch folder: <code>npm run worker</code></li>
              <li>WA Web bridge: <code>scripts/wa-bridge.js</code></li>
            </ul>
            <p className="mt-2 text-xs">Set your aliases in <code>.env</code> → <code>WATCH_NAMES</code></p>
          </div>
        </div>

        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-semibold">Day-wise Schedule</h2>
            <button onClick={()=>load()} className="btn-secondary">Refresh</button>
          </div>

          {/* Date Range Filter */}
          <div className="card">
            <div className="text-sm font-medium mb-2">Filter duties by date</div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-xs text-zinc-600">Start date</label>
                <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} className="text-sm" />
              </div>
              <div>
                <label className="text-xs text-zinc-600">End date</label>
                <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} className="text-sm" />
              </div>
              <button onClick={applyFilter} className="btn">Apply</button>
              <button onClick={clearFilter} className="btn-secondary">Clear</button>
              <div className="text-xs text-zinc-500 ml-auto">
                Showing {duties.length} duties
                {(fromDate||toDate) && ` • ${fromDate||'…'} → ${toDate||'…'}`}
              </div>
            </div>
            <div className="flex gap-2 mt-3 text-xs">
              <button className="px-2 py-1 bg-zinc-100 rounded-lg hover:bg-zinc-200" onClick={()=>{ const t = format(new Date(), 'yyyy-MM-dd'); setFromDate(t); setToDate(t); load(t,t)}}>Today</button>
              <button className="px-2 py-1 bg-zinc-100 rounded-lg hover:bg-zinc-200" onClick={()=>{ const s = format(new Date(), 'yyyy-MM-dd'); const e = format(new Date(Date.now()+7*864e5), 'yyyy-MM-dd'); setFromDate(s); setToDate(e); load(s,e)}}>Next 7 days</button>
              <button className="px-2 py-1 bg-zinc-100 rounded-lg hover:bg-zinc-200" onClick={()=>{ const d=new Date(); const s = format(new Date(d.getFullYear(), d.getMonth(),1), 'yyyy-MM-dd'); const e = format(new Date(d.getFullYear(), d.getMonth()+1,0), 'yyyy-MM-dd'); setFromDate(s); setToDate(e); load(s,e)}}>This month</button>
              <button className="px-2 py-1 bg-zinc-100 rounded-lg hover:bg-zinc-200" onClick={clearFilter}>All</button>
            </div>
          </div>
          
          {Object.keys(grouped).length === 0 && (
            <div className="card text-zinc-500">No duties yet. Upload a WhatsApp export ZIP to start.</div>
          )}

          {Object.keys(grouped).sort().map(day => (
            <div key={day} className="card">
              <div className="font-semibold mb-2">{format(new Date(day), 'EEEE, dd MMM yyyy')}</div>
              <ul className="space-y-2">
                {grouped[day].map((d: Duty) => (
                  <li key={d.id} className="flex items-start gap-3 border-t border-zinc-100 pt-2 first:border-0 first:pt-0">
                    <input type="checkbox" checked={d.completed} onChange={()=>toggle(d.id, d.completed)} className="mt-1" />
                    <div className="flex-1">
                      <div className={d.completed ? 'line-through text-zinc-400' : 'font-medium'}>{d.title}</div>
                      {d.description && d.description !== d.title && 
                        <div className="text-sm text-zinc-500">{d.description}</div>
                      }
                      <div className="text-xs text-zinc-400 mt-1">
                        {d.source} • {d.sender || d.assignee || ''} • conf {(d.confidence*100).toFixed(0)}%
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
