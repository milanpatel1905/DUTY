// Preload – keep context isolated, no node exposure needed for this app
const { contextBridge } = require('electron')
contextBridge.exposeInMainWorld('desktop', {
  version: '1.0.0',
  platform: process.platform
})
