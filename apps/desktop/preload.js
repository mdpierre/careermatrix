const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('applybotDesktop', {
  version: '0.1.0',
  retryStart: () => ipcRenderer.invoke('desktop:retry'),
  quit: () => ipcRenderer.invoke('desktop:quit'),
})
