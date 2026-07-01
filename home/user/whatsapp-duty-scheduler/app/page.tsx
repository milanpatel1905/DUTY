'use client'
import { useEffect, useMemo, useState } from 'react'
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
  rawText?: string | null
}

export default function Page() {
  const [duties, setDuties] = useState<Duty[]>([])
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [q, setQ] = useState('')
  const [hideLowConf, setHideLowConf] = useState(false)
  const [reviewMode, setReviewMode] = useState(false)
  const [editing, setEditing] = useState<Duty | null>(null)

  const load = async (opts?: {from?:string,to?:string,q?:string}) => {
    const f = opts?.from ?? fromDate
    const t = opts?.to ?? toDate
    const query = opts?.q ?? q
    const params = new URLSearchParams()
    if (f) params.set('from', f)
    if (t) params.set('to', t)
    if (query) params.set('q', query)
    if (hideLowConf) params.set('minConfidence', '0.8')
    const res = await fetch(`/api/duties?${params.toString()}`, { cache: 'no-store' })
    setDuties(await res.json())
  }
  useEffect(() => { load() }, [hideLowConf])

  const toggle = async (id: string, completed: boolean) => {
    await fetch('/api/duties', { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id, completed: !completed })})
    load()
  }

  const saveEdit = async () => {
    if (!editing) return
    await fetch('/api/duties', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(editing) })
    setEditing(null)
    load()
  }

  const removeDuty = async (id: string) => {
    if (!confirm('Delete this duty?')) return
    await fetch(`/api/duties?id=${id}`, { method: 'DELETE' })
    load()
  }

  const exportCSV = () => {
    const rows = [['Date','Title','Description','Source','Confidence','Completed']].concat(
      duties.map(d => [
        format(new Date(d.dutyDate), 'yyyy-MM-dd'),
        `"${(d.title||'').replace(/"/g,'""')}"`,
        `"${(d.description||'').replace(/"/g,'""')}"`,
        d.source, d.confidence.toFixed(2), d.completed ? 'Yes':'No'
      ])
    )
    const csv = rows.map(r=>r.join(',')).join('\n')
    const blob = new Blob([csv], {type:'text/csv'})
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `milan-patel-duties-${format(new Date(),'yyyy-MM-dd')}.csv`
    a.click()
  }

  const lowConfCount = useMemo(() => duties.filter(d => d.confidence < 0.8 && !d.completed).length, [duties])
  const reviewList = reviewMode ? duties.filter(d => d.confidence < 0.8) : duties

  const grouped = reviewList.reduce((acc: any, d) => {
    const day = format(new Date(d.dutyDate), 'yyyy-MM-dd')
    ;(acc[day] ||= []).push(d)
    return acc
  }, {})

  const applyFilter = () => load()
  const clearFilter = () => { setFromDate(''); setToDate(''); setQ(''); load({from:'',to:'',q:''}) }

  return (
    <main className="min-h-screen bg-[#f6f5f2]">
      <header className="sticky top-0 z-30 backdrop-blur bg-[#f6f5f2]/85 border-b border-zinc-200">
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-zinc-900 text-white flex items-center justify-center font-bold text-sm">MDP</div>
            <div>
              <div className="text-[17px] font-semibold tracking-tight">Duty Scheduler</div>
              <div className="text-xs text-zinc-500">Milan Patel • WhatsApp auto-extract</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <input 
              placeholder="Search duties…"
              value={q}
              onChange={e=>setQ(e.target.value)}
              onKeyDown={e=> e.key==='Enter' && load({q:e.currentTarget.value})}
              className="border border-zinc-300 rounded-full px-4 py-2 w-56 bg-white outline-none focus:ring-2 focus:ring-zinc-900/10"
            />
            <button onClick={()=>load()} className="px-3 py-2 rounded-full bg-zinc-900 text-white text-sm">Search</button>
            <button onClick={exportCSV} className="px-3 py-2 rounded-full bg-white border border-zinc-300 text-sm hover:bg-zinc-50">Export CSV</button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 md:px-10 py-8 grid lg:grid-cols-[360px_1fr] gap-8">
        {/* Left */}
        <div className="space-y-4">
          <IngestPanel onIngested={()=>load()} />
          <div className="rounded-[20px] bg-white border border-zinc-200 p-5 shadow-sm">
            <div className="font-medium mb-2">Accuracy – 100% workflow</div>
            <ol className="text-sm text-zinc-600 space-y-1.5 list-decimal pl-4">
              <li>Upload PDFs / WhatsApp ZIP</li>
              <li>Review low-confidence items ({lowConfCount} pending)</li>
              <li>Edit / confirm → mark done</li>
              <li>Export CSV for your records</li>
            </ol>
            <button 
              onClick={()=>setReviewMode(!reviewMode)}
              className={`mt-3 w-full rounded-xl px-3 py-2 text-sm font-medium transition ${reviewMode ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-900 border border-amber-200'}`}
            >
              {reviewMode ? 'Exit Review Mode' : `Review ${lowConfCount} low-confidence duties`}
            </button>
            <label className="flex items-center gap-2 text-sm text-zinc-600 mt-3 cursor-pointer">
              <input type="checkbox" checked={hideLowConf} onChange={e=>setHideLowConf(e.target.checked)} />
              Hide confidence &lt; 80%
            </label>
          </div>
          <div className="rounded-[20px] bg-white border border-zinc-200 p-5 shadow-sm text-sm text-zinc-600">
            <b>WhatsApp – 0 ban risk</b>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Export ZIP upload ✓</li>
              <li>Watch folder ✓</li>
              <li>Cloud API webhook ✓</li>
            </ul>
            <p className="text-xs text-zinc-500 mt-2">WA Web bridge is disabled by default to protect your number.</p>
          </div>
        </div>

        {/* Right */}
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="rounded-[20px] bg-white border border-zinc-200 p-5 shadow-sm">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-xs text-zinc-600">Start date</label>
                <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} className="border border-zinc-300 rounded-xl px-3 py-2 bg-white" />
              </div>
              <div>
                <label className="text-xs text-zinc-600">End date</label>
                <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} className="border border-zinc-300 rounded-xl px-3 py-2 bg-white" />
              </div>
              <button onClick={applyFilter} className="px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm font-medium">Apply</button>
              <button onClick={clearFilter} className="px-4 py-2 rounded-xl bg-zinc-100 text-sm">Clear</button>
              <div className="text-xs text-zinc-500 ml-auto">Showing {duties.length} duties</div>
            </div>
            <div className="flex gap-2 mt-3 text-xs flex-wrap">
              {[
                ['Today', ()=>{const t=format(new Date(),'yyyy-MM-dd'); setFromDate(t);setToDate(t);load({from:t,to:t})}],
                ['Next 7 days', ()=>{const s=format(new Date(),'yyyy-MM-dd'); const e=format(new Date(Date.now()+7*864e5),'yyyy-MM-dd'); setFromDate(s);setToDate(e);load({from:s,to:e})}],
                ['This month', ()=>{const d=new Date(); const s=format(new Date(d.getFullYear(),d.getMonth(),1),'yyyy-MM-dd'); const e=format(new Date(d.getFullYear(),d.getMonth()+1,0),'yyyy-MM-dd'); setFromDate(s);setToDate(e);load({from:s,to:e})}],
                ['All', clearFilter],
              ].map(([label, fn])=> <button key={label as string} onClick={fn as any} className="px-3 py-1.5 bg-zinc-100 rounded-full hover:bg-zinc-200">{label}</button>)}
            </div>
          </div>

          {Object.keys(grouped).length === 0 && (
            <div className="rounded-[20px] bg-white border border-zinc-200 p-10 text-center text-zinc-500 shadow-sm">
              No duties in this range.<br/>Upload PDFs or a WhatsApp Export ZIP to start.
            </div>
          )}

          {Object.keys(grouped).sort().map(day => (
            <div key={day} className="rounded-[24px] bg-white border border-zinc-200 p-5 shadow-sm">
              <div className="font-semibold text-zinc-900 mb-3">{format(new Date(day), 'EEEE, dd MMM yyyy')}</div>
              <ul className="space-y-3">
                {grouped[day].map((d: Duty) => (
                  <li key={d.id} className="flex items-start gap-3 border-t border-zinc-100 pt-3 first:border-0 first:pt-0">
                    <input type="checkbox" checked={d.completed} onChange={()=>toggle(d.id, d.completed)} className="mt-1.5 h-4 w-4 accent-zinc-900" />
                    <div className="flex-1 min-w-0">
                      <div className={`flex items-center gap-2 flex-wrap ${d.completed ? 'line-through text-zinc-400' : 'font-medium text-zinc-900'}`}>
                        <span>{d.title}</span>
                        {d.confidence < 0.8 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">review • {(d.confidence*100).toFixed(0)}%</span>}
                        {d.confidence >= 0.9 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">verified</span>}
                      </div>
                      {d.description && d.description !== d.title && 
                        <div className="text-sm text-zinc-500 mt-0.5">{d.description}</div>
                      }
                      <div className="text-xs text-zinc-400 mt-1">
                        {d.source} • {d.sender || d.assignee || 'MDP'}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={()=>setEditing(d)} className="text-xs px-2 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200">Edit</button>
                      <button onClick={()=>removeDuty(d.id)} className="text-xs px-2 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-500">Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={()=>setEditing(null)}>
          <div className="bg-white rounded-[24px] p-6 w-full max-w-lg shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="text-lg font-semibold mb-3">Edit duty – verify for 100% accuracy</div>
            <div className="space-y-3 text-sm">
              <div><label className="text-zinc-600">Title</label>
                <input className="border border-zinc-300 rounded-xl px-3 py-2 w-full" value={editing.title} onChange={e=>setEditing({...editing, title: e.target.value})} />
              </div>
              <div><label className="text-zinc-600">Date</label>
                <input type="date" className="border border-zinc-300 rounded-xl px-3 py-2 w-full" value={format(new Date(editing.dutyDate), 'yyyy-MM-dd')} onChange={e=>setEditing({...editing, dutyDate: new Date(e.target.value).toISOString()})} />
              </div>
              <div><label className="text-zinc-600">Description</label>
                <textarea rows={3} className="border border-zinc-300 rounded-xl px-3 py-2 w-full" value={editing.description || ''} onChange={e=>setEditing({...editing, description: e.target.value})} />
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={editing.completed} onChange={e=>setEditing({...editing, completed: e.target.checked})} />
                Mark as verified / completed
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={()=>setEditing(null)} className="px-4 py-2 rounded-xl bg-zinc-100">Cancel</button>
              <button onClick={saveEdit} className="px-4 py-2 rounded-xl bg-zinc-900 text-white">Save & Verify</button>
            </div>
            <p className="text-xs text-zinc-500 mt-3">Confidence: {(editing.confidence*100).toFixed(0)}% • Source: {editing.source}</p>
          </div>
        </div>
      )}
    </main>
  )
}
