// ⚠️  WARNING: WHATSAPP MAY BAN YOUR NUMBER
// whatsapp-web.js is UNOFFICIAL. Using it with your personal number WILL risk a ban.
// RECOMMENDED SAFE OPTIONS (no ban risk):
//  1. WhatsApp Export ZIP upload  -> app/page.tsx IngestPanel  (SAFE, recommended)
//  2. WhatsApp Cloud API webhook -> /api/webhook/whatsapp  (SAFE, official)
//  3. Watch Folder               -> npm run worker (SAFE)
// Only use this bridge with a SPARE / burner number.
// 
// npm i whatsapp-web.js qrcode-terminal
// node scripts/wa-bridge.js

const { Client, LocalAuth } = require('whatsapp-web.js')
const qrcode = require('qrcode-terminal')

const WATCH_NAMES = (process.env.WATCH_NAMES || '').toLowerCase().split(',')
const client = new Client({ authStrategy: new LocalAuth() })

client.on('qr', qr => qrcode.generate(qr, {small: true}))
client.on('ready', () => console.log('WA Bridge ready'))

client.on('message', async msg => {
  const body = msg.body || ''
  if (WATCH_NAMES.some(n => n && body.toLowerCase().includes(n.trim()))) {
    console.log('Duty hit:', body.slice(0,80))
    const fd = new FormData()
    fd.append('text', `[${msg.from}] ${body}`)
    await fetch('http://localhost:3000/api/ingest', { method: 'POST', body: fd }).catch(()=>{})
  }
  // auto-download PDFs
  if (msg.hasMedia) {
    const media = await msg.downloadMedia()
    if (media.mimetype === 'application/pdf') {
      const buf = Buffer.from(media.data, 'base64')
      const fd = new FormData()
      fd.append('pdf', new Blob([buf]), 'wa.pdf')
      await fetch('http://localhost:3000/api/ingest', { method: 'POST', body: fd }).catch(()=>{})
    }
  }
})

client.initialize()
