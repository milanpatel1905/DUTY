const { app, BrowserWindow, shell } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const http = require('http')

let nextProcess = null
let mainWindow = null
const isDev = !app.isPackaged
const PORT = 3415

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

async function startNextServer() {
  const nextBin = isDev 
    ? path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'bin', 'next')
    : path.join(process.resourcesPath, 'app', 'node_modules', 'next', 'dist', 'bin', 'next')

  const appDir = isDev ? path.join(__dirname, '..') : path.join(process.resourcesPath, 'app')

  // ensure DB exists
  process.env.DATABASE_URL = process.env.DATABASE_URL || `file:${path.join(app.getPath('userData'), 'duties.db')}`
  process.env.WATCH_NAMES = process.env.WATCH_NAMES || 'Milan Patel,MDP,milan,patel'

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
    backgroundColor: '#fafafa',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false,
    },
    icon: path.join(__dirname, 'icon.png')
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    await mainWindow.loadURL(`http://localhost:3000`)
  } else {
    await mainWindow.loadURL(`http://127.0.0.1:${PORT}`)
  }
}

app.whenReady().then(async () => {
  try {
    if (!isDev) {
      await startNextServer()
    }
    await createWindow()
  } catch (e) {
    console.error(e)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  if (nextProcess) nextProcess.kill()
})
