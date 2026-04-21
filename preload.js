const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('electronAPI', {
    onTradeData: (cb) => ipcRenderer.on('trade-data', (e, data) => cb(data)),
    closePopup: () => ipcRenderer.send('close-trade-popup'),
    showTradePopup: (trade) => ipcRenderer.send('show-trade-popup', trade)
})
