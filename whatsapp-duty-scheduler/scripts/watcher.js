// Watch folder auto-ingest
// npm run worker
const chokidar = require('chokidar')
const fs = require('fs')
const path = require('path')

const WATCH_DIR = path.join(__dirname, '../watch_inbox')
if (!fs.existsSync(WATCH_DIR)) fs.mkdirSync(WATCH_DIR, {recursive: true})

console.log('Watching', WATCH_DIR, 'for new PDFs / chat txt files...')

chokidar.watch(WATCH_DIR, {ignoreInitial: true}).on('add', async (filePath) => {
  console.log('New file:', filePath)
  const FormData = globalThis.FormData
  const Blob = globalThis.Blob
  const buf = fs.readFileSync(filePath)
  const fd = new FormData()
  if (filePath.endsWith('.pdf')) {
    fd.append('pdf', new Blob([buf]), path.basename(filePath))
  } else if (filePath.endsWith('.txt')) {
    fd.append('text', buf.toString('utf8'))
  } else {
    return
  }
  try {
    const res = await fetch('http://localhost:3000/api/ingest', { method: 'POST', body: fd })
    console.log(await res.json())
  } catch(e) { console.error(e) }
})
