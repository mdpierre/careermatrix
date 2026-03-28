const statusEl = document.getElementById('status')
const linkEl = document.getElementById('dashboard-link')
const pillEl = document.getElementById('options-pill')

fetch('http://localhost:8000/extension/config')
  .then((res) => res.json())
  .then((config) => {
    statusEl.textContent = `Connected. Active slot: ${config.active_profile_slot}.`
    pillEl.textContent = 'Connected'
    pillEl.className = 'status-pill'
    if (config.dashboard_url) linkEl.href = config.dashboard_url
  })
  .catch(() => {
    statusEl.textContent = 'Desktop app not detected. Start the local app, then come back here.'
    pillEl.textContent = 'Offline'
    pillEl.className = 'status-pill status-pill--offline'
  })
