// Preload – keep context isolated
const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('desktop', {
  version: '1.0.0',
  platform: process.platform,
  checkDutiesNow: () => ipcRenderer.invoke('check-duties-now')
})
