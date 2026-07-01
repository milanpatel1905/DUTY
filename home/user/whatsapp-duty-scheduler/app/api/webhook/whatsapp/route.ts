import { NextRequest, NextResponse } from 'next/server'
import { extractDutiesFromText } from '@/lib/extractor'
import { prisma } from '@/lib/db'
import crypto from 'crypto'

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'change-me-123'

// GET - webhook verification for Meta
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('hub.mode') === 'subscribe' && searchParams.get('hub.verify_token') === VERIFY_TOKEN) {
    return new NextResponse(searchParams.get('hub.challenge'), { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

// POST - incoming message
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  
  try {
    // WhatsApp Cloud API format
    const messages = body?.entry?.[0]?.changes?.[0]?.value?.messages || []
    for (const msg of messages) {
      const text = msg.text?.body || msg.caption || ''
      if (!text) continue
      
      const duties = extractDutiesFromText(text, { sender: msg.from })
      for (const d of duties) {
        const sourceHash = crypto.createHash('sha256').update(`${d.dutyDate.toISOString()}|${d.title}|wa-${msg.id}`).digest('hex')
        await prisma.duty.create({
          data: {
            title: d.title,
            description: d.description,
            dutyDate: d.dutyDate,
            source: 'whatsapp_text',
            assignee: d.assignee,
            confidence: d.confidence,
            sender: msg.from,
            sourceHash,
            rawText: text.slice(0, 2000)
          }
        }).catch(()=>{})
      }
    }
  } catch (e) {
    console.error(e)
  }
  return NextResponse.json({ status: 'ok' })
}
