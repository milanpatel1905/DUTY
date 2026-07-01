import { parse, isValid, addDays } from 'date-fns'

const WATCH_NAMES = (process.env.WATCH_NAMES || "Milan Patel,MDP,milan,patel")
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean)

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
const nameRegex = new RegExp(`\\b(${WATCH_NAMES.map(escapeRegex).join('|')})\\b`, 'i')

export function containsMyName(text: string): {matched: boolean, alias?: string} {
  const m = text.match(nameRegex)
  return m ? { matched: true, alias: m[0] } : { matched: false }
}

// Extract dates: 24/07, 24-07-2025, 24 July, 22-June-2026, June 22, etc.
function extractDates(text: string): Date[] {
  const dates: Date[] = []
  const now = new Date()
  const year = now.getFullYear()

  const monthMap: Record<string, number> = {
    jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12
  }

  const patterns: RegExp[] = [
    /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/g,
    // dd-MMM-yyyy
    /(\d{1,2})\s*[-–]\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*[-–]?\s*(\d{2,4})/gi,
    // dd MMM [yyyy]
    /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{2,4})?/gi,
    // dd/mm
    /(\d{1,2})[\/\-\.](\d{1,2})(?!\d)/g,
  ]

  for (const re of patterns) {
    let m
    while ((m = re.exec(text)) !== null) {
      try {
        let d: Date | null = null
        if (m[3] && /^\d{2,4}$/.test(m[3]) && isNaN(Number(m[2]))) {
          const mon = monthMap[m[2].toLowerCase().substring(0,3)]
          if (mon) {
            const yr = Number(m[3].length===2 ? 2000+Number(m[3]) : m[3])
            d = new Date(yr, mon-1, Number(m[1]))
          }
        } else if (m[3] && /^\d{2,4}$/.test(m[3])) {
          d = parse(`${m[1]}/${m[2]}/${m[3]}`, 'd/M/yyyy', new Date())
        } else if (!isNaN(Number(m[1])) && !isNaN(Number(m[2]))) {
          d = parse(`${m[1]}/${m[2]}/${year}`, 'd/M/yyyy', new Date())
        } else if (m[2] && isNaN(Number(m[2]))) {
          const mon = monthMap[m[2].toLowerCase().substring(0,3)]
          if (mon) d = new Date(year, mon-1, Number(m[1]))
        }
        if (d && isValid(d)) dates.push(d)
      } catch {}
    }
    re.lastIndex = 0
  }

  // relative
  if (/\btomorrow\b/i.test(text)) dates.push(addDays(now, 1))
  if (/\btoday\b/i.test(text)) dates.push(now)

  return [...new Map(dates.map(d => [d.toDateString(), d])).values()]
}

const dutyKeywords = /\b(duty|shift|call|posting|roster|opd|emergency|night|morning|evening|ward|evaluation|showing|supervision|supervisor|invigilat)\b/i

export type ExtractedDuty = {
  title: string
  description: string
  dutyDate: Date
  assignee?: string
  confidence: number
}

export function extractDutiesFromText(text: string, meta: { sender?: string, chatName?: string } = {}): ExtractedDuty[] {
  const duties: ExtractedDuty[] = []

  // 1. Special parser: LJ Institute Supervision List (MDP row with FY1/VL columns)
  const supervision = parseLJSupervision(text)
  duties.push(...supervision)

  // 2. Line-by-line scan (Evaluation/Showing duty PDFs, WhatsApp text)
  const lines = text.split(/\r?\n/)
  for (let i=0; i<lines.length; i++) {
    const rawLine = lines[i]
    const line = rawLine.trim()
    if (line.length < 3) continue

    const nameHit = containsMyName(line)
    const hasKeyword = dutyKeywords.test(line)
    if (!nameHit.matched && !hasKeyword) continue

    // try dates in this line + 2 lines of context
    const context = lines.slice(Math.max(0,i-2), i+3).join(' ')
    const dates = extractDates(line + ' ' + context)
    if (dates.length === 0) continue

    const confidence = nameHit.matched ? 0.92 : 0.62
    if (!nameHit.matched && line.length > 140) continue

    for (const dutyDate of dates) {
      duties.push({
        title: cleanTitle(line),
        description: line,
        dutyDate,
        assignee: nameHit.alias,
        confidence
      })
    }
  }

  // 3. Fallback: if my name is anywhere in doc, attach all dates found in doc
  if (duties.length === 0 && containsMyName(text).matched) {
    const dates = extractDates(text)
    const alias = containsMyName(text).alias
    const docType = /showing/i.test(text) ? 'Showing Duty' : /evaluation/i.test(text) ? 'Evaluation Duty' : /supervis/i.test(text) ? 'Supervision Duty' : 'Duty'
    for (const dutyDate of dates) {
      duties.push({
        title: `${docType} - ${alias?.toUpperCase()}`,
        description: text.slice(0, 280),
        dutyDate,
        assignee: alias,
        confidence: 0.58
      })
    }
  }

  // dedupe by date+title
  const seen = new Set<string>()
  return duties.filter(d => {
    const k = d.dutyDate.toDateString() + '|' + d.title.slice(0,40)
    if (seen.has(k)) return false
    seen.add(k); return true
  })
}

function cleanTitle(line: string) {
  return line.replace(/\s+/g, ' ').slice(0, 110)
}

// LJ Institute Supervision List parser
// Finds "MILAN PATEL MDP" row, then maps FY/VL/SB entries to exam dates in header
function parseLJSupervision(text: string): ExtractedDuty[] {
  if (!/supervis/i.test(text)) return []
  const nameHit = containsMyName(text)
  if (!nameHit.matched) return []

  const duties: ExtractedDuty[] = []
  const dates = extractDates(text)
  if (dates.length === 0) return []

  // Find the MDP row in the extracted text
  const lines = text.split(/\n/)
  const myLineIdx = lines.findIndex(l => nameRegex.test(l))
  if (myLineIdx === -1) return []

  // Try to get the full faculty row (can wrap across lines)
  let rowText = lines.slice(myLineIdx, myLineIdx+3).join(' ')
  
  // Extract FY / VL / SB tokens after my name
  const afterName = rowText.split(new RegExp(nameRegex.source, 'i'))[1] || ''
  const tokens = (afterName.match(/\b(FY\d?|VL|SB|CL|ME|RAI)\b/gi) || [])

  // Map tokens to dates in order they appear in the document
  // Supervision PDF usually has dates left-to-right matching the tokens
  tokens.forEach((tok, idx) => {
    if (idx < dates.length) {
      duties.push({
        title: `Supervision Duty - ${tok.toUpperCase()}`,
        description: `Milan Patel (MDP) - ${tok.toUpperCase()} supervision`,
        dutyDate: dates[idx],
        assignee: nameHit.alias,
        confidence: 0.75
      })
    }
  })

  return duties
}

// WhatsApp export chat parser
export function parseWhatsAppChat(chatText: string, chatName?: string) {
  const messages: {sender: string, body: string, timestamp: Date | null}[] = []
  const re = /^(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?:\s?[ap]m)?)\s*[-–]\s*([^:]+):\s*(.*)$/gim

  let m
  while ((m = re.exec(chatText)) !== null) {
    const [, dateStr] = m
    let timestamp: Date | null = null
    try { timestamp = parse(dateStr, 'd/M/yy', new Date()) } catch {}
    messages.push({
      sender: m[3].trim(),
      body: m[4].trim(),
      timestamp
    })
  }
  if (messages.length === 0) {
    chatText.split(/\n/).forEach(l => {
      if (l.trim()) messages.push({ sender: chatName || 'Unknown', body: l, timestamp: null })
    })
  }
  return messages
}
