const SLOT_CLASSES = {
  profile_1: 'slot-theme--profile-1',
  profile_2: 'slot-theme--profile-2',
  profile_3: 'slot-theme--profile-3'
}
const API_BASE_URL = 'http://localhost:8000'

let activeProfile = 'profile_1'
let profiles = {}
let dashboardUrl = 'http://localhost:3000/profiles'

function normalizeProfile(profile) {
  if (!profile) return null
  const experience = (profile.experiences && profile.experiences[0]) || {}
  const education = (profile.educations && profile.educations[0]) || {}
  return {
    slot: profile.slot,
    display_name: profile.display_name || profile.displayName || '',
    profile_name: profile.profile_name || profile.profileName || '',
    resume_label: profile.resume_label || profile.resumeLabel || '',
    runtime: {
      displayName: profile.display_name || profile.displayName || '',
      profileName: profile.profile_name || profile.profileName || '',
      firstName: profile.first_name || profile.firstName || '',
      lastName: profile.last_name || profile.lastName || '',
      fullName: profile.full_name || profile.fullName || '',
      email: profile.email || '',
      phone: profile.phone || '',
      city: profile.city || '',
      state: profile.state || '',
      zip: profile.zip || '',
      country: profile.country || 'United States',
      linkedin: profile.linkedin || '',
      website: profile.website || '',
      github: profile.github || '',
      targetTitle: profile.target_title || profile.targetTitle || '',
      targetSalary: profile.target_salary || profile.targetSalary || '',
      workAuthorization: profile.work_authorization || profile.workAuthorization || '',
      requireSponsorship: profile.require_sponsorship || profile.requireSponsorship || '',
      veteran: profile.veteran || '',
      disability: profile.disability || '',
      gender: profile.gender || '',
      ethnicity: profile.ethnicity || '',
      summary: profile.summary || '',
      resumeLabel: profile.resume_label || profile.resumeLabel || '',
      experiences: (profile.experiences || []).map((item) => ({
        employer: item.employer,
        title: item.title,
        startDate: item.start_date || item.startDate || '',
        endDate: item.end_date || item.endDate || '',
        location: item.location || '',
        description: item.description || '',
      })),
      educations: (profile.educations || []).map((item) => ({
        school: item.school,
        degree: item.degree,
        major: item.major,
        graduationYear: item.graduation_year || item.graduationYear || '',
        gpa: item.gpa || '',
      })),
      currentEmployer: experience.employer || '',
      currentTitle: experience.title || '',
      school: education.school || '',
      education: education.degree || '',
      graduationYear: education.graduation_year || education.graduationYear || '',
      gpa: education.gpa || '',
      major: education.major || '',
    }
  }
}

const trackBtns = document.querySelectorAll('.track-btn')
const targetTitle = document.getElementById('target-title')
const resumeLabel = document.getElementById('resume-label')
const autofillBtn = document.getElementById('autofill-btn')
const editBtn = document.getElementById('edit-btn')
const statusVal = document.getElementById('status-val')
const slotDisplay = document.getElementById('slot-display')
const connectionPill = document.getElementById('connection-pill')

function setStatus(text, cls) {
  statusVal.textContent = text
  statusVal.className = `status-val ${cls}`
}

function setConnectionState(connected) {
  if (!connectionPill) return
  connectionPill.textContent = connected ? 'Local' : 'Offline'
  connectionPill.className = connected ? 'status-pill' : 'status-pill status-pill--offline'
}

function applyAccent(track) {
  Object.values(SLOT_CLASSES).forEach((className) => document.body.classList.remove(className))
  document.body.classList.add(SLOT_CLASSES[track] || SLOT_CLASSES.profile_1)
}

function slotLabel(track) {
  const profile = profiles[track]
  return profile?.display_name || track.replace('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function updateProfileDisplay(track) {
  const profile = profiles[track]
  slotDisplay.textContent = slotLabel(track)

  if (!profile) {
    targetTitle.textContent = 'No cached profile'
    resumeLabel.textContent = 'Upload in desktop app'
    return
  }

  targetTitle.textContent = profile.profile_name || profile.display_name || '—'
  resumeLabel.textContent = profile.resume_label || '—'
}

async function switchTrack(track) {
  activeProfile = track
  trackBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.track === track)
  })
  applyAccent(track)
  updateProfileDisplay(track)
  chrome.storage.local.set({ activeProfile: track })

  try {
    await fetch(`${API_BASE_URL}/profiles/active/${track}`, { method: 'PUT' })
  } catch {
    // Cache-only fallback is fine when the desktop app is offline.
  }

  setStatus('Ready', 'ready')
}

async function loadProfilesWithFallback() {
  try {
    const configRes = await fetch(`${API_BASE_URL}/extension/config`, {
      signal: AbortSignal.timeout(2000)
    })
    if (!configRes.ok) throw new Error(`HTTP ${configRes.status}`)
    const config = await configRes.json()
    dashboardUrl = config.dashboard_url || dashboardUrl

    const res = await fetch(`${API_BASE_URL}/profiles`, {
      signal: AbortSignal.timeout(2000)
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const json = await res.json()
    const data = Object.fromEntries((json.data || []).map((profile) => [profile.slot, normalizeProfile(profile)]))

    chrome.storage.local.set({
      profiles: data,
      activeProfile: config.active_profile_slot,
      apiBaseUrl: API_BASE_URL,
    })

    activeProfile = config.active_profile_slot
    setConnectionState(true)
    return data
  } catch {
    setConnectionState(false)
    return new Promise((resolve) => {
      chrome.storage.local.get(['profiles'], (result) => {
        resolve(result.profiles || {})
      })
    })
  }
}

chrome.storage.local.get(['activeProfile'], async (result) => {
  profiles = await loadProfilesWithFallback()
  const saved = ['profile_1', 'profile_2', 'profile_3'].includes(result.activeProfile)
    ? result.activeProfile
    : activeProfile || 'profile_1'
  switchTrack(saved)
})

trackBtns.forEach((btn) => {
  btn.addEventListener('click', () => switchTrack(btn.dataset.track))
})

autofillBtn.addEventListener('click', async () => {
  const profile = profiles[activeProfile]
  if (!profile) {
    setStatus('No profile data', 'error')
    return
  }

  setStatus('Filling...', 'filling')
  autofillBtn.disabled = true

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    let runtimeProfile = profiles[activeProfile]?.runtime
    let sessionId = null

    try {
      const sessionRes = await fetch(`${API_BASE_URL}/application-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_slot: activeProfile,
          page_url: tab.url,
          origin: 'extension_popup',
        }),
      })
      const sessionJson = await sessionRes.json()
      sessionId = sessionJson?.data?.id || null
      if (sessionId) {
        const payloadRes = await fetch(`${API_BASE_URL}/application-sessions/${sessionId}/payload`)
        const payloadJson = await payloadRes.json()
        runtimeProfile = payloadJson?.data?.profile || runtimeProfile
      }
    } catch {
      sessionId = null
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    }).catch(() => {
      // Already injected — ignore
    })

    chrome.tabs.sendMessage(tab.id, {
      action: 'autofill',
      profile: runtimeProfile,
      sessionId,
      apiBaseUrl: API_BASE_URL,
    }, (response) => {
      if (chrome.runtime.lastError) {
        setStatus('Reload page', 'error')
        autofillBtn.disabled = false
        return
      }

      if (response && response.status === 'done') {
        const { filled, missed } = response
        setStatus(`${filled} filled / ${missed} missed`, 'done')
      } else {
        setStatus('No page response', 'error')
      }
      autofillBtn.disabled = false
    })
  } catch (err) {
    setStatus('Check console', 'error')
    console.error('[TrackFill popup]', err)
    autofillBtn.disabled = false
  }
})

editBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: dashboardUrl })
})
