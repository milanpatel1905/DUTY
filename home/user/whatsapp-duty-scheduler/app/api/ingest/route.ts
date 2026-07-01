import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { extractDutiesFromText, parseWhatsAppChat, containsMyName } from '@/lib/extractor'
import { extractPdfText } from '@/lib/pdf'
import crypto from 'crypto'
import AdmZip from 'adm-zip'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function hashStr(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex')
}

async function saveDuties(duties: Awaited<ReturnType<typeof extractDutiesFromText>>, source: string, rawText: string, meta: any) {
  let created = 0
  for (const d of duties) {
    const sourceHash = hashStr(`${d.dutyDate.toISOString()}|${d.title}|${source}`)
    try {
      await prisma.duty.create({
        data: {
          title: d.title,
          description: d.description,
          dutyDate: d.dutyDate,
          source,
          assignee: d.assignee,
          confidence: d.confidence,
          chatName: meta.chatName,
          sender: meta.sender,
          sourceHash,
          rawText: rawText.slice(0, 2000)
        }
      })
      created++
    } catch (e: any) {
      // duplicate, ignore
      if (!String(e.message).includes('Unique constraint')) console.error(e)
    }
  }
  return created
}

export async function POST(req: NextRequest) {
  const form = await req.formData()
  let totalDuties = 0
  let filesProcessed = 0

  // Handle ZIP (WhatsApp export)
  const zipFile = form.get('zip') as File | null
  if (zipFile) {
    const buf = Buffer.from(await zipFile.arrayBuffer())
    const zip = new AdmZip(buf)
    const entries = zip.getEntries()
    
    let chatText = ''
    const pdfEntries = entries.filter(e => e.entryName.toLowerCase().endsWith('.pdf'))
    
    const chatEntry = entries.find(e => e.entryName.endsWith('_chat.txt') || e.entryName.toLowerCase().includes('chat'))
    if (chatEntry) chatText = chatEntry.getData().toString('utf8')

    // Parse chat messages
    if (chatText) {
      const messages = parseWhatsAppChat(chatText, zipFile.name)
      for (const msg of messages) {
        if (!containsMyName(msg.body).matched && !/duty|shift|roster/i.test(msg.body)) continue
        const duties = extractDutiesFromText(msg.body, { sender: msg.sender })
        totalDuties += await saveDuties(duties, 'whatsapp_text', msg.body, { sender: msg.sender, chatName: zipFile.name })
      }
      filesProcessed++
    }

    // Parse PDFs
    for (const entry of pdfEntries) {
      const pdfBuf = entry.getData()
      const text = await extractPdfText(pdfBuf)
      const duties = extractDutiesFromText(text, { chatName: zipFile.name })
      totalDuties += await saveDuties(duties, 'pdf', text, { chatName: entry.entryName })
      filesProcessed++
    }

    return NextResponse.json({ ok: true, filesProcessed, dutiesFound: totalDuties })
  }

  // Handle direct text / pdf upload (supports multiple PDFs)
  const text = form.get('text') as string | null
  // support pdf, pdfs, multiple files
  const pdfFiles: File[] = [
    ...form.getAll('pdfs') as File[],
    ...form.getAll('pdf') as File[],
  ].filter(Boolean)

  const perFileResults: {filename: string, duties: number}[] = []

  if (text) {
    const duties = extractDutiesFromText(text)
    const created = await saveDuties(duties, 'whatsapp_text', text, {})
    totalDuties += created
    filesProcessed++
    perFileResults.push({ filename: 'pasted_text', duties: created })
  }

  for (const pdfFile of pdfFiles) {
    if (!pdfFile || typeof pdfFile === 'string') continue
    try {
      const buf = Buffer.from(await pdfFile.arrayBuffer())
      const pdfText = await extractPdfText(buf)
      const duties = extractDutiesFromText(pdfText, { chatName: pdfFile.name })
      const created = await saveDuties(duties, 'pdf', pdfText, { chatName: pdfFile.name })
      totalDuties += created
      filesProcessed++
      perFileResults.push({ filename: pdfFile.name, duties: created })
    } catch (e) {
      perFileResults.push({ filename: pdfFile.name, duties: 0 })
    }
  }

  return NextResponse.json({ ok: true, filesProcessed, dutiesFound: totalDuties, files: perFileResults })
}
