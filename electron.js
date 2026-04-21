const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const net = require('net')

let serverProcess = null
let tradePopup = null

function isPortInUse(port) {
    return new Promise((resolve) => {
        const tester = net.createServer()
            .once('error', () => resolve(true))
            .once('listening', () => { tester.close(); resolve(false); })
            .listen(port)
    })
}

async function startServer() {
    const inUse = await isPortInUse(3000)
    if (!inUse) {
        serverProcess = spawn('node', ['index.js'], {
            cwd: __dirname,
            stdio: 'ignore',
            detached: false
        })
        await new Promise(r => setTimeout(r, 5000))
    }
}

function createWindow() {
    const win = new BrowserWindow({
        width: 380,
        height: 480,
        x: 1340,
        y: 580,
        alwaysOnTop: true,
        resizable: true,
        title: 'Jarvis',
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    })
    win.setMenuBarVisibility(false)
    win.loadURL('http://localhost:3000')
    win.on('closed', () => {
        if (serverProcess) serverProcess.kill()
    })
    globalShortcut.register('CommandOrControl+Shift+K', () => {
        fetch('http://localhost:3000/kill-workflow', { method: 'POST' }).catch(() => {})
        fetch('http://localhost:3000/panic', { method: 'POST' }).catch(() => {})
    })
}

ipcMain.on('show-trade-popup', (event, trade) => {
    if (tradePopup) tradePopup.close()
    tradePopup = new BrowserWindow({
        width: 400,
        height: 520,
        x: 1010,
        y: 580,
        alwaysOnTop: true,
        frame: false,
        resizable: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    })
    tradePopup.loadFile('trade-popup.html')
    tradePopup.webContents.on('did-finish-load', () => {
        tradePopup.webContents.send('trade-data', trade)
    })
})

ipcMain.on('close-trade-popup', () => {
    if (tradePopup) { tradePopup.close(); tradePopup = null; }
})

app.whenReady().then(async () => {
    await startServer()
    createWindow()
})

app.on('will-quit', () => {
    globalShortcut.unregisterAll()
    if (serverProcess) serverProcess.kill()
    if (tradePopup) tradePopup.close()
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
