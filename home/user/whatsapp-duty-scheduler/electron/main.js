const { app, BrowserWindow, shell, Notification, Tray, Menu, nativeImage, ipcMain } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const http = require('http')

let nextProcess = null
let mainWindow = null
let tray = null
const isDev = !app.isPackaged
const PORT = isDev ? 3000 : 3415

function waitForServer(url, timeout = 30000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const check = () => {
      http.get(url, () => resolve(true)).on('error', () => {
        if (Date.now() - start > timeout) return reject(new Error('Server timeout'))
        setTimeout(check, 500)
      })
    }
    check()
  })
}

const fs = require('fs')

function ensureDatabase() {
  const userDataDb = path.join(app.getPath('userData'), 'duties.db')
  process.env.DATABASE_URL = process.env.DATABASE_URL || `file:${userDataDb}`
  if (!fs.existsSync(userDataDb)) {
    try {
      fs.mkdirSync(path.dirname(userDataDb), { recursive: true })
      // copy blank pre-initialized DB
      const blankPaths = [
        path.join(__dirname, '..', 'prisma', 'duties.blank.db'),
        path.join(process.resourcesPath, 'app', 'prisma', 'duties.blank.db'),
        path.join(process.resourcesPath, 'prisma', 'duties.blank.db')
      ]
      for (const src of blankPaths) {
        if (fs.existsSync(src)) { fs.copyFileSync(src, userDataDb); break }
      }
    } catch(e) { console.error('DB init failed', e) }
  }
  return process.env.DATABASE_URL
}

async function startNextServer() {
  const nextBin = isDev 
    ? path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'bin', 'next')
    : path.join(process.resourcesPath, 'app', 'node_modules', 'next', 'dist', 'bin', 'next')

  const appDir = isDev ? path.join(__dirname, '..') : path.join(process.resourcesPath, 'app')

  ensureDatabase()
  process.env.WATCH_NAMES = process.env.WATCH_NAMES || 'Milan Patel,MDP,milan,patel'
  process.env.TZ = process.env.TZ || 'Asia/Kolkata'

  return new Promise((resolve, reject) => {
    nextProcess = spawn(process.execPath, [nextBin, 'start', '-p', String(PORT), '-H', '127.0.0.1'], {
      cwd: appDir,
      env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT) },
      stdio: 'inherit'
    })
    nextProcess.on('error', reject)
    waitForServer(`http://127.0.0.1:${PORT}`).then(resolve).catch(reject)
  })
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1150,
    height: 780,
    backgroundColor: '#f6f5f2',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false,
    },
    icon: path.join(__dirname, 'icon.png'),
    show: false
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  const url = isDev ? `http://localhost:3000` : `http://127.0.0.1:${PORT}`
  await mainWindow.loadURL(url)
  mainWindow.show()

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      mainWindow.hide()
    }
  })
}

function createTray() {
  const iconPath = path.join(__dirname, 'icon.png')
  let trayIcon = nativeImage.createFromPath(iconPath)
  if (trayIcon.isEmpty()) trayIcon = nativeImage.createEmpty()
  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }))
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Duty Scheduler – Milan Patel', enabled: false },
    { type: 'separator' },
    { label: 'Show App', click: () => { mainWindow.show() } },
    { label: 'Check today\'s duties now', click: () => { checkTodayDuties(true) } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit() } }
  ])
  tray.setToolTip('Duty Scheduler MDP')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => { mainWindow.show() })
}

// --- Daily 8am notification ---
function fetchJson(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => { try { resolve(JSON.parse(data)) } catch { resolve([]) } })
    }).on('error', () => resolve([]))
  })
}

async function checkTodayDuties(manual = false) {
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth()+1).padStart(2,'0')
  const dd = String(today.getDate()).padStart(2,'0')
  const dateStr = `${yyyy}-${mm}-${dd}`
  const base = isDev ? 'http://localhost:3000' : `http://127.0.0.1:${PORT}`
  const duties = await fetchJson(`${base}/api/duties?from=${dateStr}&to=${dateStr}`)
  
  if (duties.length > 0) {
    const body = duties.map(d => `• ${d.title}`).slice(0,4).join('\n') + (duties.length > 4 ? `\n+${duties.length-4} more` : '')
    new Notification({
      title: `Milan Patel – ${duties.length} duty${duties.length>1?'ies':''} today`,
      body,
      silent: false
    }).show()
  } else if (manual) {
    new Notification({ title: 'Duty Scheduler', body: 'No duties scheduled for today. Enjoy!' }).show()
  }
  return duties.length
}

// Schedule daily at 08:00 Asia/Kolkata
function scheduleDaily8am() {
  const scheduleNext = () => {
    const now = new Date()
    // compute next 8:00 IST
    const istOffset = 5.5 * 60 * 60 * 1000
    const nowUTC = now.getTime() + now.getTimezoneOffset()*60000
    const nowIST = new Date(nowUTC + istOffset)
    const nextIST = new Date(nowIST)
    nextIST.setHours(8,0,5,0)
    if (nextIST <= nowIST) nextIST.setDate(nextIST.getDate()+1)
    const delay = nextIST.getTime() - nowIST.getTime()
    
    console.log(`[Duty Scheduler] Next 8am notification in ${Math.round(delay/1000/60)} min`)
    setTimeout(async () => {
      await checkTodayDuties(false)
      scheduleNext() // schedule following day
    }, delay)
  }
  scheduleNext()
  // also check once at startup after 10s, if it's after 8am
  setTimeout(() => checkTodayDuties(false), 10000)
}

app.whenReady().then(async () => {
  try {
    if (!isDev) {
      await startNextServer()
    }
    await createWindow()
    createTray()
    scheduleDaily8am()
  } catch (e) {
    console.error(e)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  // keep running in tray on Windows
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
  else mainWindow.show()
})

app.on('will-quit', () => {
  if (nextProcess) nextProcess.kill()
})

ipcMain.handle('check-duties-now', () => checkTodayDuties(true))
