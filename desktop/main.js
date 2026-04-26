const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const kill = require('tree-kill');
const http = require('http');

let mainWindow;
let splashWindow;
let backendProcess;

const BACKEND_PORT = process.env.PORT || 8000;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const HEALTH_URL = `${BACKEND_URL}/health`;
const MAX_RETRIES = 300;      // 150 seconds total (model download on first boot can be slow)
const RETRY_INTERVAL_MS = 500;

// ── Splash Window ──────────────────────────────────────────────────────────────
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 280,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  const splashHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
          border-radius: 16px;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color: white; overflow: hidden;
          border: 1px solid rgba(99,102,241,0.3);
          box-shadow: 0 25px 50px rgba(0,0,0,0.8);
        }
        .logo { font-size: 2.5rem; font-weight: 800; margin-bottom: 8px;
          background: linear-gradient(135deg, #818cf8, #a5b4fc);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .sub { font-size: 0.8rem; color: rgba(148,163,184,0.8); margin-bottom: 36px; letter-spacing: 0.1em; text-transform: uppercase; }
        .status { font-size: 0.78rem; color: #94a3b8; margin-bottom: 16px; }
        .bar-track { width: 200px; height: 3px; background: rgba(255,255,255,0.08); border-radius: 99px; overflow: hidden; }
        .bar-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #6366f1, #a78bfa);
          border-radius: 99px; animation: pulse 1.5s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes slide { 0%{width:0%} 100%{width:85%} }
        .bar-fill { animation: slide 8s ease-out forwards, pulse 1.5s ease-in-out infinite; }
      </style>
    </head>
    <body>
      <div class="logo">Omni-Doc</div>
      <div class="sub">AI Document Intelligence</div>
      <div class="status" id="status">Starting backend service...</div>
      <div class="bar-track"><div class="bar-fill"></div></div>
    </body>
    </html>
  `;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHTML)}`);
}

// ── Backend Process ────────────────────────────────────────────────────────────
function startBackend() {
  console.log('[Omni-Doc] Starting backend...');

  const backendDir = path.join(__dirname, '../backend');
  const isWindows = process.platform === 'win32';
  const pythonPath = isWindows
    ? path.join(backendDir, 'venv', 'Scripts', 'python.exe')
    : path.join(backendDir, 'venv', 'bin', 'python');

  const finalPythonPath = require('fs').existsSync(pythonPath) ? pythonPath : 'python';
  console.log(`[Omni-Doc] Using Python: ${finalPythonPath}`);

  backendProcess = spawn(
    finalPythonPath,
    ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', BACKEND_PORT.toString(), '--no-access-log'],
    {
      cwd: backendDir,
      env: { ...process.env, PYTHONUNBUFFERED: '1', PORT: BACKEND_PORT.toString() }
    }
  );

  backendProcess.stdout.on('data', (data) => {
    console.log(`[Backend] ${data.toString().trim()}`);
  });

  backendProcess.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    // uvicorn writes startup info to stderr — not a real error
    if (msg) console.log(`[Backend] ${msg}`);
  });

  backendProcess.on('close', (code) => {
    console.log(`[Omni-Doc] Backend process exited with code ${code}`);
  });
}

// ── Health Polling ─────────────────────────────────────────────────────────────
function pollBackendHealth(retriesLeft) {
  return new Promise((resolve, reject) => {
    function attempt(remaining) {
      const req = http.get(HEALTH_URL, (res) => {
        if (res.statusCode === 200) {
          console.log('[Omni-Doc] Backend is healthy ✓');
          resolve();
        } else {
          retry(remaining);
        }
      });
      req.on('error', () => retry(remaining));
      req.setTimeout(400, () => { req.destroy(); retry(remaining); });
    }

    function retry(remaining) {
      if (remaining <= 0) {
        reject(new Error('Backend did not become healthy in time.'));
        return;
      }
      setTimeout(() => attempt(remaining - 1), RETRY_INTERVAL_MS);
    }

    attempt(retriesLeft);
  });
}

// ── Main Window ────────────────────────────────────────────────────────────────
function createWindow() {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,            // hidden until ready-to-show
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: !isDev,  // allow localhost fetch in dev mode
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'Omni-Doc',
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── App Lifecycle ──────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  createSplash();
  startBackend();

  try {
    await pollBackendHealth(MAX_RETRIES);
    createWindow();
  } catch (err) {
    console.error('[Omni-Doc] Fatal: backend failed to start:', err.message);
    // Still open the window — user will see connection error in UI rather than blank screen
    createWindow();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (backendProcess) {
      kill(backendProcess.pid, 'SIGTERM', (err) => {
        if (err) console.error('[Omni-Doc] Failed to kill backend:', err);
        app.quit();
      });
    } else {
      app.quit();
    }
  }
});

app.on('quit', () => {
  if (backendProcess) kill(backendProcess.pid);
});

const { ipcMain, shell } = require('electron');
ipcMain.on('open-external', (event, url) => {
  shell.openExternal(url);
});
