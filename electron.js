const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const net = require('net')
const http = require('http')
const fs = require('fs')

const STATE_FILE = path.join(__dirname, 'data', 'window-state.json')
const APP_PORT = Number(process.env.PORT || 3000)
const APP_HOST = process.env.HOST || '127.0.0.1'
const APP_BASE_URL = `http://${APP_HOST}:${APP_PORT}`
const SERVER_START_TIMEOUT_MS = 30000

function loadWindowState() {
    try {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
    } catch (err) {
        if (err.code !== 'ENOENT') console.error('[loadWindowState]', err.message)
        return null
    }
}

function saveWindowState(win) {
    try {
        if (!win || win.isDestroyed()) return
        const bounds = win.getBounds()
        const tmp = STATE_FILE + '.tmp'
        fs.writeFileSync(tmp, JSON.stringify(bounds))
        fs.renameSync(tmp, STATE_FILE)
    } catch (err) {
        console.error('[saveWindowState]', err.message)
    }
}

let serverProcess = null
let tradePopup = null
let popupAutoCloseTimer = null

function isPortInUse(port, host = APP_HOST) {
    return new Promise((resolve) => {
        const tester = net.createServer()
            .once('error', () => resolve(true))
            .once('listening', () => { tester.close(); resolve(false); })
            .listen(port, host)
    })
}

function checkLukeHealth() {
    return new Promise((resolve) => {
        const req = http.get(`${APP_BASE_URL}/api/health`, { timeout: 2500 }, (res) => {
            let body = ''
            res.setEncoding('utf8')
            res.on('data', chunk => { body += chunk })
            res.on('end', () => {
                if (res.statusCode !== 200) return resolve(false)
                try {
                    const payload = JSON.parse(body)
                    resolve(payload && payload.app === 'Luke')
                } catch {
                    resolve(false)
                }
            })
        })
        req.on('timeout', () => {
            req.destroy()
            resolve(false)
        })
        req.on('error', () => resolve(false))
    })
}

async function waitForLukeHealth(timeoutMs = SERVER_START_TIMEOUT_MS) {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        if (await checkLukeHealth()) return true
        if (serverProcess && serverProcess.exitCode !== null) {
            throw new Error(`Luke server exited early with code ${serverProcess.exitCode}`)
        }
        await new Promise(resolve => setTimeout(resolve, 500))
    }
    return false
}

async function startServer() {
    if (await checkLukeHealth()) return

    const inUse = await isPortInUse(APP_PORT)
    if (inUse) {
        throw new Error(`Port ${APP_PORT} is in use, but Luke health is not responding at ${APP_BASE_URL}/api/health`)
    }

    serverProcess = spawn('node', ['index.js'], {
        cwd: __dirname,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
        windowsHide: true,
        env: { ...process.env, PORT: String(APP_PORT), HOST: APP_HOST, NODE_ENV: 'production' }
    })
    serverProcess.stdout.on('data', data => console.log(`[luke-server] ${String(data).trim()}`))
    serverProcess.stderr.on('data', data => console.error(`[luke-server] ${String(data).trim()}`))

    const healthy = await waitForLukeHealth()
    if (!healthy) throw new Error(`Luke server did not become healthy at ${APP_BASE_URL}/api/health`)
}

function createWindow(startupError = null) {
    const saved = loadWindowState()
    const defaultBounds = { width: 1280, height: 820, x: 80, y: 60 }
    const bounds = saved && saved.width >= 960 && saved.height >= 640 ? saved : defaultBounds
    const win = new BrowserWindow({
        width:  bounds.width,
        height: bounds.height,
        x:      bounds.x,
        y:      bounds.y,
        minWidth: 960,
        minHeight: 640,
        resizable: true,
        title: 'Luke',
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true,
            preload: path.join(__dirname, 'preload.js')
        }
    })
    win.setMenuBarVisibility(false)
    if (startupError) {
        const message = String(startupError.stack || startupError.message || startupError)
        win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Luke startup failed</title>
  <style>
    body { margin: 0; padding: 28px; background: #050403; color: #f3efe7; font: 14px/1.45 Consolas, monospace; }
    pre { white-space: pre-wrap; border: 1px solid #514638; padding: 16px; background: #151311; }
  </style>
</head>
<body>
  <h1>Luke startup failed</h1>
  <p>The desktop shell could not reach the local Luke server.</p>
  <pre>${message.replace(/[<>&]/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[ch]))}</pre>
</body>
</html>`)} `)
    } else {
        win.loadURL(`${APP_BASE_URL}/shell`)
    }
    win.on('resize', () => saveWindowState(win))
    win.on('move',   () => saveWindowState(win))
    win.on('closed', () => {
        if (serverProcess) serverProcess.kill()
    })
    globalShortcut.register('CommandOrControl+Shift+K', () => {
        fetch(`${APP_BASE_URL}/kill-workflow`, { method: 'POST' }).catch(() => {})
        fetch(`${APP_BASE_URL}/panic`, { method: 'POST' }).catch(() => {})
    })
}

function closeTradePopup() {
    if (popupAutoCloseTimer) { clearTimeout(popupAutoCloseTimer); popupAutoCloseTimer = null; }
    if (tradePopup) {
        tradePopup.close();
        tradePopup.destroy();
        tradePopup = null;
    }
}

ipcMain.on('show-trade-popup', (event, trade) => {
    closeTradePopup();
    tradePopup = new BrowserWindow({
        width: 400,
        height: 520,
        x: 1010,
        y: 580,
        frame: false,
        resizable: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true,
            preload: path.join(__dirname, 'preload.js')
        }
    })
    tradePopup.loadFile('trade-popup.html')
    tradePopup.webContents.on('did-finish-load', () => {
        tradePopup.webContents.send('trade-data', trade)
    })
    // auto-close after 60 seconds if no button pressed
    popupAutoCloseTimer = setTimeout(closeTradePopup, 60000)
})

ipcMain.on('close-trade-popup', () => {
    closeTradePopup();
})

app.whenReady().then(async () => {
    let startupError = null
    try {
        await startServer()
    } catch (err) {
        startupError = err
        console.error('[luke-startup]', err.stack || err.message || err)
    }
    createWindow(startupError)
})

app.on('will-quit', () => {
    globalShortcut.unregisterAll()
    if (serverProcess) serverProcess.kill()
    closeTradePopup()
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
