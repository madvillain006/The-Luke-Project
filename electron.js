const { app, BrowserWindow, globalShortcut, ipcMain } = require("electron");
const { spawn } = require("child_process");
const net = require("net");
const path = require("path");

let serverProcess = null;

function isPortInUse(port) {
  return new Promise((resolve) => {
    const tester = net.createConnection({ port, host: "127.0.0.1" });
    tester.once("connect", () => { tester.destroy(); resolve(true); });
    tester.once("error", () => resolve(false));
  });
}

function startServer() {
  serverProcess = spawn("node", ["index.js"], {
    cwd: __dirname,
    stdio: "ignore",
    detached: false,
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    resizable: true,
    title: "Jarvis",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "icon.ico"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.setMenuBarVisibility(false);
  win.loadURL("http://localhost:3000");

  win.on("closed", () => {
    if (serverProcess) serverProcess.kill();
  });

  globalShortcut.register("CommandOrControl+Shift+K", () => {
    fetch("http://localhost:3000/kill-workflow", { method: "POST" }).catch(() => {});
    fetch("http://localhost:3000/panic",         { method: "POST" }).catch(() => {});
  });
}

app.whenReady().then(async () => {
  const inUse = await isPortInUse(3000);
  if (inUse) {
    createWindow();
  } else {
    startServer();
    setTimeout(createWindow, 5000);
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  if (serverProcess) serverProcess.kill();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
