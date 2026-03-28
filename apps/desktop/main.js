const { app, BrowserWindow, ipcMain } = require('electron')
const { spawn } = require('child_process')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')
const WEB_DIR = path.join(ROOT, 'apps', 'web')
const API_DIR = path.join(ROOT, 'apps', 'api')
const WEB_URL = process.env.APPLYBOT_WEB_URL || 'http://localhost:3000'
const API_URL = process.env.APPLYBOT_API_URL || 'http://localhost:8000/health'
const STARTUP_TIMEOUT_MS = Number(process.env.APPLYBOT_STARTUP_TIMEOUT_MS || 45000)
const HEALTH_POLL_INTERVAL_MS = Number(process.env.APPLYBOT_HEALTH_POLL_INTERVAL_MS || 500)

let mainWindow = null
let bootstrapPromise = null
let healthMonitor = null
let isQuitting = false

function chooseModule(url) {
  return String(url).startsWith('https://') ? https : http
}

function ping(url) {
  return new Promise((resolve) => {
    const client = chooseModule(url)
    const request = client.get(url, (res) => {
      res.resume()
      resolve(Boolean(res.statusCode) && res.statusCode < 500)
    })
    request.setTimeout(2500, () => {
      request.destroy()
      resolve(false)
    })
    request.on('error', () => resolve(false))
  })
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function fileExists(pathname) {
  try {
    return fs.existsSync(pathname)
  } catch {
    return false
  }
}

function resolveApiCommand() {
  if (process.env.APPLYBOT_API_BIN) {
    return {
      command: process.env.APPLYBOT_API_BIN,
      args: ['-m', 'uvicorn', 'app.main:app', '--port', '8000'],
    }
  }

  const candidates = [
    path.join(API_DIR, '.venv_runtime', 'bin', 'python'),
    path.join(API_DIR, '.venv', 'bin', 'python'),
  ]
  const pythonBin = candidates.find(fileExists) || 'python3'
  return {
    command: pythonBin,
    args: ['-m', 'uvicorn', 'app.main:app', '--port', '8000'],
  }
}

function resolveWebCommand() {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  return {
    command: process.env.APPLYBOT_WEB_BIN || npmCmd,
    args: ['run', process.env.APPLYBOT_WEB_SCRIPT || 'dev'],
  }
}

const services = {
  api: {
    key: 'api',
    name: 'API',
    cwd: API_DIR,
    healthUrl: API_URL,
    process: null,
    ownedByDesktop: false,
    lastError: null,
    ...resolveApiCommand(),
  },
  web: {
    key: 'web',
    name: 'Dashboard',
    cwd: WEB_DIR,
    healthUrl: WEB_URL,
    process: null,
    ownedByDesktop: false,
    lastError: null,
    ...resolveWebCommand(),
  },
}

function renderStatusPage({ title, kicker, message, details = [], tone = 'info' }) {
  const escapedDetails = details
    .map((detail) => `<li>${detail.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</li>`)
    .join('')
  const html = `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${title}</title>
      <style>
        :root {
          --bg: #cfd4cb;
          --panel: rgba(16, 20, 17, 0.94);
          --text: #edf2eb;
          --text-muted: #879084;
          --text-faint: #687166;
          --accent: ${tone === 'error' ? '#f88d8d' : '#aef59d'};
          --border: rgba(194, 222, 187, 0.11);
          --shadow: 0 32px 80px rgba(7, 9, 8, 0.24);
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 32px;
          background:
            radial-gradient(circle at 20% 12%, rgba(185, 210, 181, 0.2), transparent 28%),
            radial-gradient(circle at 82% 24%, rgba(190, 214, 188, 0.18), transparent 24%),
            linear-gradient(180deg, #d4d8cf 0%, #cfd4cb 100%);
          color: var(--text);
          font-family: "Space Grotesk", sans-serif;
        }
        .shell {
          width: min(720px, 100%);
          padding: 24px;
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.04);
          background:
            radial-gradient(circle at 50% 46%, rgba(151, 255, 137, 0.07), transparent 26%),
            linear-gradient(180deg, rgba(21, 26, 22, 0.96) 0%, rgba(15, 19, 17, 0.98) 100%);
          box-shadow: var(--shadow);
        }
        .kicker, .meta {
          color: var(--text-faint);
          font: 500 12px/1.2 "IBM Plex Mono", monospace;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        h1 {
          margin: 10px 0 0;
          font-size: 40px;
          line-height: 1;
          letter-spacing: -0.04em;
        }
        p {
          margin: 14px 0 0;
          color: var(--text-muted);
          font-size: 16px;
          line-height: 1.6;
        }
        ul {
          margin: 22px 0 0;
          padding: 16px 18px 16px 34px;
          border-radius: 18px;
          border: 1px solid var(--border);
          background: var(--panel);
        }
        li {
          color: var(--text);
          margin: 8px 0;
        }
        .actions {
          display: flex;
          gap: 12px;
          margin-top: 20px;
        }
        button {
          min-height: 46px;
          padding: 0 18px;
          border-radius: 999px;
          border: 1px solid rgba(194, 222, 187, 0.16);
          background: rgba(174, 245, 157, 0.08);
          color: var(--accent);
          cursor: pointer;
          font: 600 12px/1.2 "IBM Plex Mono", monospace;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        button.secondary {
          background: transparent;
          color: var(--text-muted);
        }
      </style>
    </head>
    <body>
      <div class="shell">
        <div class="kicker">${kicker}</div>
        <h1>${title}</h1>
        <p>${message}</p>
        ${escapedDetails ? `<ul>${escapedDetails}</ul>` : ''}
        <div class="actions">
          <button onclick="window.applybotDesktop.retryStart()">Retry Startup</button>
          <button class="secondary" onclick="window.applybotDesktop.quit()">Quit</button>
        </div>
      </div>
    </body>
  </html>`
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}

async function loadStatusPage(config) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  await mainWindow.loadURL(renderStatusPage(config))
}

function watchChildProcess(service, child) {
  child.on('error', (error) => {
    service.lastError = `Could not start ${service.name}: ${error.message}`
  })

  child.on('exit', (code, signal) => {
    service.process = null
    if (isQuitting || !service.ownedByDesktop) return

    const detail = code !== null
      ? `${service.name} exited with code ${code}.`
      : `${service.name} exited from signal ${signal || 'unknown'}.`

    void loadStatusPage({
      kicker: 'Service Exit',
      title: `${service.name} stopped`,
      message: 'The desktop-managed service exited unexpectedly. Review the terminal output, then retry startup.',
      tone: 'error',
      details: [
        detail,
        `${service.name} command: ${service.command} ${service.args.join(' ')}`,
      ],
    })
  })
}

function spawnService(service) {
  service.lastError = null
  service.ownedByDesktop = true
  service.process = spawn(service.command, service.args, {
    cwd: service.cwd,
    stdio: 'inherit',
    env: { ...process.env },
  })
  watchChildProcess(service, service.process)
}

async function waitForService(service) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < STARTUP_TIMEOUT_MS) {
    if (await ping(service.healthUrl)) return
    if (service.lastError) {
      throw new Error(service.lastError)
    }
    if (service.ownedByDesktop && service.process && service.process.exitCode !== null) {
      throw new Error(`${service.name} exited before becoming healthy.`)
    }
    await delay(HEALTH_POLL_INTERVAL_MS)
  }
  throw new Error(`${service.name} did not become healthy within ${STARTUP_TIMEOUT_MS / 1000}s.`)
}

async function ensureService(service) {
  if (await ping(service.healthUrl)) {
    service.ownedByDesktop = false
    service.process = null
    return 'external'
  }

  spawnService(service)
  await waitForService(service)
  return 'managed'
}

function startHealthMonitor() {
  if (healthMonitor) clearInterval(healthMonitor)
  healthMonitor = setInterval(async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const [apiHealthy, webHealthy] = await Promise.all([
      ping(services.api.healthUrl),
      ping(services.web.healthUrl),
    ])
    if (apiHealthy && webHealthy) return

    clearInterval(healthMonitor)
    healthMonitor = null

    await loadStatusPage({
      kicker: 'Service Health',
      title: 'Desktop services are unavailable',
      message: 'The dashboard or API became unreachable after startup. Retry once the local services are healthy again.',
      tone: 'error',
      details: [
        `API health: ${apiHealthy ? 'ok' : 'offline'} (${services.api.healthUrl})`,
        `Dashboard health: ${webHealthy ? 'ok' : 'offline'} (${services.web.healthUrl})`,
      ],
    })
  }, 5000)
}

async function bootstrapDesktop() {
  await loadStatusPage({
    kicker: 'Desktop Startup',
    title: 'Starting local services',
    message: 'Checking for running API and dashboard processes, then launching anything the desktop still needs.',
    details: [
      `API health URL: ${services.api.healthUrl}`,
      `Dashboard URL: ${services.web.healthUrl}`,
    ],
  })

  const startupSummary = []
  for (const service of [services.api, services.web]) {
    const mode = await ensureService(service)
    startupSummary.push(
      mode === 'external'
        ? `${service.name} already running externally.`
        : `${service.name} started by Electron with: ${service.command} ${service.args.join(' ')}`
    )
  }

  await loadStatusPage({
    kicker: 'Desktop Startup',
    title: 'Loading workspace',
    message: 'All required services are healthy. Opening the dashboard now.',
    details: startupSummary,
  })

  await mainWindow.loadURL(WEB_URL)
  startHealthMonitor()
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 980,
    minWidth: 1100,
    minHeight: 760,
    title: 'applybot desktop',
    backgroundColor: '#cfd4cb',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (!bootstrapPromise) {
    bootstrapPromise = bootstrapDesktop().catch(async (error) => {
      await loadStatusPage({
        kicker: 'Startup Failed',
        title: 'Could not launch desktop workspace',
        message: 'The desktop shell could not bring the local dashboard online. Review the expected commands below and retry after fixing the issue.',
        tone: 'error',
        details: [
          error.message,
          `API command: ${services.api.command} ${services.api.args.join(' ')}`,
          `Dashboard command: ${services.web.command} ${services.web.args.join(' ')}`,
        ],
      })
    }).finally(() => {
      bootstrapPromise = null
    })
  }
}

ipcMain.handle('desktop:retry', async () => {
  if (bootstrapPromise) return { status: 'busy' }
  bootstrapPromise = bootstrapDesktop().then(
    () => ({ status: 'ok' }),
    async (error) => {
      await loadStatusPage({
        kicker: 'Startup Failed',
        title: 'Retry failed',
        message: 'The local services still are not ready. Review the command details and try again after fixing the runtime issue.',
        tone: 'error',
        details: [
          error.message,
          `API command: ${services.api.command} ${services.api.args.join(' ')}`,
          `Dashboard command: ${services.web.command} ${services.web.args.join(' ')}`,
        ],
      })
      return { status: 'error', message: error.message }
    }
  ).finally(() => {
    bootstrapPromise = null
  })
  return bootstrapPromise
})

ipcMain.handle('desktop:quit', () => {
  app.quit()
  return { status: 'ok' }
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow()
  }
})

app.on('before-quit', () => {
  isQuitting = true
  if (healthMonitor) clearInterval(healthMonitor)
  for (const service of Object.values(services)) {
    if (service.ownedByDesktop && service.process && !service.process.killed) {
      service.process.kill()
    }
  }
})
