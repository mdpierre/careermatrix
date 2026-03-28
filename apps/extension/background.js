const API_BASE_URL = 'http://localhost:8000'

function normalizeProfile(profile) {
  if (!profile) return null
  const experience = (profile.experiences && profile.experiences[0]) || {}
  const education = (profile.educations && profile.educations[0]) || {}
  return {
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

async function loadRuntimeContext() {
  const cached = await chrome.storage.local.get(['activeProfile', 'profiles'])
  try {
    const configRes = await fetch(`${API_BASE_URL}/extension/config`)
    const config = await configRes.json()
    const profilesRes = await fetch(`${API_BASE_URL}/profiles`)
    const profilesJson = await profilesRes.json()
    const profiles = Object.fromEntries((profilesJson.data || []).map((profile) => [profile.slot, normalizeProfile(profile)]))
    await chrome.storage.local.set({
      activeProfile: config.active_profile_slot,
      profiles,
      apiBaseUrl: API_BASE_URL,
    })
    return {
      activeProfile: config.active_profile_slot,
      profiles,
      apiBaseUrl: API_BASE_URL,
    }
  } catch {
    return {
      activeProfile: ['profile_1', 'profile_2', 'profile_3'].includes(cached.activeProfile)
        ? cached.activeProfile
        : 'profile_1',
      profiles: cached.profiles || {},
      apiBaseUrl: cached.apiBaseUrl || API_BASE_URL,
    }
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'autofill') return

  const runtime = await loadRuntimeContext()
  const profile = runtime.profiles?.[runtime.activeProfile]
  if (!profile) {
    console.warn('[TrackFill] background: no active profile found')
    return
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !tab.url) {
    console.warn('[TrackFill] background: no active tab found')
    return
  }

  let sessionId = null
  let runtimeProfile = profile
  try {
    const res = await fetch(`${runtime.apiBaseUrl}/application-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile_slot: runtime.activeProfile,
        page_url: tab.url,
        origin: 'extension_shortcut',
      }),
    })
    const json = await res.json()
    sessionId = json?.data?.id || null
    if (sessionId) {
      const payloadRes = await fetch(`${runtime.apiBaseUrl}/application-sessions/${sessionId}/payload`)
      const payloadJson = await payloadRes.json()
      runtimeProfile = payloadJson?.data?.profile || runtimeProfile
    }
  } catch {
    sessionId = null
  }

  chrome.tabs.sendMessage(tab.id, {
    action: 'autofill',
    profile: runtimeProfile,
    sessionId,
    apiBaseUrl: runtime.apiBaseUrl,
  }, () => {
    void chrome.runtime.lastError
  })
})
