// content.js — TrackFill field detection + autofill
// Injected into all pages at document_idle.

;(function () {
  'use strict'

  // ── Field selector map ───────────────────────────────────────────
  const FIELD_MAP = {
    firstName: [
      'input[name*="first" i]',
      'input[id*="first" i]',
      'input[placeholder*="first name" i]',
      'input[aria-label*="first name" i]',
      '[data-automation-id*="legalFirstName"]',
      '#first_name',
      '#firstName'
    ],
    lastName: [
      'input[name*="last" i]',
      'input[id*="last" i]',
      'input[placeholder*="last name" i]',
      'input[aria-label*="last name" i]',
      '[data-automation-id*="legalLastName"]',
      '#last_name',
      '#lastName'
    ],
    fullName: [
      'input[name*="full_name" i]',
      'input[name*="fullname" i]',
      'input[id*="full_name" i]',
      'input[placeholder*="full name" i]',
      'input[aria-label*="full name" i]'
    ],
    email: [
      'input[type="email"]',
      'input[name*="email" i]',
      'input[id*="email" i]',
      'input[placeholder*="email" i]',
      '[data-automation-id*="email"]'
    ],
    phone: [
      'input[type="tel"]',
      'input[name*="phone" i]',
      'input[id*="phone" i]',
      'input[placeholder*="phone" i]',
      'input[placeholder*="mobile" i]',
      '[data-automation-id*="phone"]'
    ],
    city: [
      'input[name*="city" i]',
      'input[id*="city" i]',
      'input[placeholder*="city" i]',
      '[data-automation-id*="city"]'
    ],
    state: [
      'select[name*="state" i]',
      'input[name*="state" i]',
      'input[id*="state" i]',
      '[data-automation-id*="state"]'
    ],
    zip: [
      'input[name*="zip" i]',
      'input[name*="postal" i]',
      'input[id*="zip" i]',
      'input[id*="postal" i]',
      'input[placeholder*="zip" i]',
      'input[placeholder*="postal" i]'
    ],
    country: [
      'select[name*="country" i]',
      'input[name*="country" i]',
      'input[id*="country" i]'
    ],
    linkedin: [
      'input[name*="linkedin" i]',
      'input[id*="linkedin" i]',
      'input[placeholder*="linkedin" i]',
      'input[aria-label*="linkedin" i]'
    ],
    website: [
      'input[name*="website" i]',
      'input[name*="portfolio" i]',
      'input[id*="website" i]',
      'input[id*="portfolio" i]',
      'input[placeholder*="website" i]',
      'input[placeholder*="portfolio" i]'
    ],
    github: [
      'input[name*="github" i]',
      'input[id*="github" i]',
      'input[placeholder*="github" i]'
    ],
    currentTitle: [
      'input[name*="title" i]',
      'input[id*="currentTitle" i]',
      'input[id*="current_title" i]',
      'input[placeholder*="current title" i]',
      'input[placeholder*="job title" i]',
      'input[aria-label*="current title" i]',
      '[data-automation-id*="currentTitle"]'
    ],
    currentEmployer: [
      'input[name*="employer" i]',
      'input[name*="company" i]',
      'input[id*="employer" i]',
      'input[id*="company" i]',
      'input[placeholder*="employer" i]',
      'input[placeholder*="company" i]',
      '[data-automation-id*="currentEmployer"]',
      '[data-automation-id*="currentCompany"]'
    ],
    school: [
      'input[name*="school" i]',
      'input[name*="university" i]',
      'input[name*="college" i]',
      'input[id*="school" i]',
      'input[id*="university" i]',
      'input[placeholder*="school" i]',
      'input[placeholder*="university" i]'
    ],
    yearsExperience: [
      'input[name*="years" i]',
      'input[name*="experience" i]',
      'input[id*="years" i]',
      'select[name*="years" i]',
      'select[name*="experience" i]'
    ],
    targetTitle: [
      'input[name*="desired_title" i]',
      'input[name*="position" i]',
      'input[id*="desired" i]',
      'input[placeholder*="desired title" i]',
      'input[placeholder*="position" i]'
    ],
    summary: [
      'textarea[name*="summary" i]',
      'textarea[name*="cover" i]',
      'textarea[id*="summary" i]',
      'textarea[id*="cover" i]',
      'textarea[placeholder*="summary" i]',
      'textarea[placeholder*="cover letter" i]',
      '[data-automation-id*="coverLetter"]',
      '[data-automation-id*="summary"]'
    ]
  }

  // ── Phone formatting ──────────────────────────────────────────────
  function formatPhone(rawPhone, el) {
    const digits = rawPhone.replace(/\D/g, '')
    // Normalize 11-digit with leading 1 → 10 digits
    const d10 = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
    if (d10.length !== 10) return rawPhone // non-US or invalid — leave as-is

    const placeholder = (el.getAttribute('placeholder') || '').replace(/\s/g, '')
    const pattern     = (el.getAttribute('pattern')     || '')
    const inputmode   = (el.getAttribute('inputmode')   || '')

    if (/\+1/.test(placeholder) || /\+1/.test(pattern)) {
      return `+1${d10}`
    }
    if (/\(/.test(placeholder) || /\(/.test(pattern)) {
      return `(${d10.slice(0,3)}) ${d10.slice(3,6)}-${d10.slice(6)}`
    }
    if (/-/.test(placeholder) || /-/.test(pattern)) {
      return `${d10.slice(0,3)}-${d10.slice(3,6)}-${d10.slice(6)}`
    }
    if (inputmode === 'numeric' || /^\d+$/.test(placeholder.replace(/x/gi, ''))) {
      return d10
    }
    // Default: most common US ATS format
    return `(${d10.slice(0,3)}) ${d10.slice(3,6)}-${d10.slice(6)}`
  }

  // ── Shadow DOM deep query ─────────────────────────────────────────
  function queryShadowDeep(root, selector) {
    try {
      const found = root.querySelector(selector)
      if (found) return found
    } catch {
      return null // invalid selector
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
    let node = walker.nextNode()
    while (node) {
      if (node.shadowRoot) {
        const found = queryShadowDeep(node.shadowRoot, selector)
        if (found) return found
      }
      node = walker.nextNode()
    }
    return null
  }

  // ── Shared: apply value to an element ────────────────────────────
  function applyValue(el, value) {
    el.focus()
    const proto = el.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')
    if (nativeSetter) {
      nativeSetter.set.call(el, value)
    } else {
      el.value = value
    }
    el.dispatchEvent(new Event('input',  { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }))
    el.blur()
  }

  // ── Fill a text input ─────────────────────────────────────────────
  function fillField(selectors, value) {
    // Pass 1: standard DOM
    for (const selector of selectors) {
      let el
      try { el = document.querySelector(selector) } catch { continue }
      if (el && el.tagName !== 'SELECT' && el.offsetParent !== null) {
        const finalValue = (el.type === 'tel' || el.getAttribute('inputmode') === 'tel')
          ? formatPhone(value, el)
          : value
        applyValue(el, finalValue)
        console.log(`[TrackFill] Filled "${selector}" → "${finalValue}"`)
        return { success: true, selector, mode: 'input' }
      }
    }

    // Pass 2: shadow DOM fallback
    for (const selector of selectors) {
      const el = queryShadowDeep(document.body, selector)
      if (el && el.tagName !== 'SELECT') {
        const finalValue = (el.type === 'tel' || el.getAttribute('inputmode') === 'tel')
          ? formatPhone(value, el)
          : value
        applyValue(el, finalValue)
        console.log(`[TrackFill] Shadow DOM filled "${selector}" → "${finalValue}"`)
        return { success: true, selector, mode: 'shadow-input' }
      }
    }

    return { success: false, selector: null, mode: 'input' }
  }

  // ── Fill a <select> dropdown ──────────────────────────────────────
  function fillSelect(selectors, value) {
    function trySelect(el) {
      if (!el || el.tagName !== 'SELECT') return false
      const option = Array.from(el.options).find(o =>
        o.text.toLowerCase().includes(value.toLowerCase()) ||
        o.value.toLowerCase().includes(value.toLowerCase())
      )
      if (!option) return false
      el.value = option.value
      el.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    }

    // Pass 1: standard DOM
    for (const selector of selectors) {
      let el
      try { el = document.querySelector(selector) } catch { continue }
      if (trySelect(el)) {
        console.log(`[TrackFill] Select filled "${selector}" → "${value}"`)
        return { success: true, selector, mode: 'select' }
      }
    }

    // Pass 2: shadow DOM fallback
    for (const selector of selectors) {
      const el = queryShadowDeep(document.body, selector)
      if (trySelect(el)) {
        console.log(`[TrackFill] Shadow DOM select filled "${selector}" → "${value}"`)
        return { success: true, selector, mode: 'shadow-select' }
      }
    }

    return { success: false, selector: null, mode: 'select' }
  }

  // ── Smart fill: try select first, then input ──────────────────────
  function fill(selectors, value) {
    if (!value) return false
    const hasSelectSelector = selectors.some(s => s.startsWith('select'))
    if (hasSelectSelector) {
      const selectSelectors = selectors.filter(s =>  s.startsWith('select'))
      const inputSelectors  = selectors.filter(s => !s.startsWith('select'))
      const selectResult = fillSelect(selectSelectors, value)
      return selectResult.success ? selectResult : fillField(inputSelectors, value)
    }
    return fillField(selectors, value)
  }

  // ── On-page results badge ─────────────────────────────────────────
  function ensureBadgeStyles() {
    const existing = document.getElementById('__applybot_badge_styles__')
    if (existing) return

    const style = document.createElement('style')
    style.id = '__applybot_badge_styles__'
    style.textContent = `
      #__applybot_badge__ {
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 2147483647;
        width: min(320px, calc(100vw - 32px));
        padding: 14px;
        border-radius: 20px;
        border: 1px solid rgba(194, 222, 187, 0.14);
        background:
          radial-gradient(circle at 50% 38%, rgba(174, 245, 157, 0.08), transparent 42%),
          linear-gradient(180deg, rgba(21, 26, 22, 0.96) 0%, rgba(15, 19, 17, 0.98) 100%);
        box-shadow: 0 24px 60px rgba(7, 9, 8, 0.34);
        color: #edf2eb;
        font-family: "Space Grotesk", sans-serif;
        line-height: 1.5;
        opacity: 1;
        transition: opacity 0.4s ease, transform 0.2s ease;
        backdrop-filter: blur(14px);
      }

      #__applybot_badge__::before {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background:
          linear-gradient(90deg, transparent 0, rgba(189, 255, 178, 0.03) 50%, transparent 100%),
          radial-gradient(circle at 50% 50%, rgba(174, 245, 157, 0.08), transparent 32%);
        pointer-events: none;
      }

      #__applybot_badge__ .applybot-badge__surface {
        position: relative;
        z-index: 1;
      }

      #__applybot_badge__ .applybot-badge__summary {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        cursor: pointer;
        user-select: none;
      }

      #__applybot_badge__ .applybot-badge__brand {
        display: flex;
        gap: 12px;
        align-items: center;
        min-width: 0;
      }

      #__applybot_badge__ .applybot-badge__mark {
        width: 16px;
        height: 16px;
        border-radius: 6px;
        flex-shrink: 0;
        background:
          linear-gradient(135deg, rgba(205, 245, 197, 0.95), rgba(141, 255, 120, 0.18)),
          #1a221d;
        box-shadow: 0 0 14px rgba(175, 255, 155, 0.22);
      }

      #__applybot_badge__ .applybot-badge__eyebrow,
      #__applybot_badge__ .applybot-badge__detail-title {
        color: #687166;
        font: 500 10px/1.2 "IBM Plex Mono", monospace;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      #__applybot_badge__ .applybot-badge__title {
        margin-top: 2px;
        font-size: 16px;
        font-weight: 600;
        letter-spacing: -0.03em;
        color: #edf2eb;
      }

      #__applybot_badge__ .applybot-badge__stats {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      #__applybot_badge__ .applybot-badge__pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 52px;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid rgba(194, 222, 187, 0.16);
        background: rgba(174, 245, 157, 0.08);
        color: #aef59d;
        font: 600 11px/1.2 "IBM Plex Mono", monospace;
        letter-spacing: 0.04em;
      }

      #__applybot_badge__ .applybot-badge__pill--missed {
        background: rgba(248, 141, 141, 0.08);
        color: #f88d8d;
      }

      #__applybot_badge__ .applybot-badge__detail {
        display: none;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid rgba(194, 222, 187, 0.08);
      }

      #__applybot_badge__ .applybot-badge__detail--open {
        display: block;
      }

      #__applybot_badge__ .applybot-badge__all-matched {
        color: #879084;
        font-size: 13px;
      }

      #__applybot_badge__ .applybot-badge__list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 10px;
      }

      #__applybot_badge__ .applybot-badge__item {
        display: flex;
        gap: 8px;
        align-items: center;
        color: #edf2eb;
        font-size: 13px;
      }

      #__applybot_badge__ .applybot-badge__item::before {
        content: "";
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #f88d8d;
        box-shadow: 0 0 10px rgba(248, 141, 141, 0.4);
        flex-shrink: 0;
      }
    `
    document.documentElement.appendChild(style)
  }

  function injectBadge(filled, missed, missedFields) {
    ensureBadgeStyles()

    const existing = document.getElementById('__applybot_badge__')
    if (existing) existing.remove()

    const badge = document.createElement('div')
    badge.id = '__applybot_badge__'

    const summary = document.createElement('div')
    summary.className = 'applybot-badge__summary'
    summary.innerHTML = `
      <div class="applybot-badge__brand">
        <div class="applybot-badge__mark"></div>
        <div>
          <div class="applybot-badge__eyebrow">Autofill Result</div>
          <div class="applybot-badge__title">applybot</div>
        </div>
      </div>
      <div class="applybot-badge__stats">
        <span class="applybot-badge__pill">${filled} filled</span>
        <span class="applybot-badge__pill applybot-badge__pill--missed">${missed} missed</span>
      </div>
    `

    const detail = document.createElement('div')
    detail.className = 'applybot-badge__detail'
    if (missedFields.length === 0) {
      detail.innerHTML = `
        <div class="applybot-badge__detail-title">Coverage</div>
        <div class="applybot-badge__all-matched">All mapped fields matched on this page.</div>
      `
    } else {
      detail.innerHTML = `
        <div class="applybot-badge__detail-title">Missed Fields</div>
        <div class="applybot-badge__list">
          ${missedFields.map((field) => `<div class="applybot-badge__item">${field}</div>`).join('')}
        </div>
      `
    }

    let expanded = false
    summary.addEventListener('click', () => {
      expanded = !expanded
      detail.classList.toggle('applybot-badge__detail--open', expanded)
    })

    const surface = document.createElement('div')
    surface.className = 'applybot-badge__surface'
    surface.appendChild(summary)
    surface.appendChild(detail)

    badge.appendChild(surface)
    document.body.appendChild(badge)

    // Auto-dismiss after 10 s
    setTimeout(() => {
      badge.style.opacity = '0'
      setTimeout(() => badge.remove(), 400)
    }, 10000)
  }

  // ── Resolve array-format profile to flat autofill values ─────────
  function computeYearsExperience(startDate) {
    if (!startDate) return ''
    const parts = startDate.split('/')
    let year, month
    if (parts.length === 2) {
      month = parseInt(parts[0], 10) - 1
      year  = parseInt(parts[1], 10)
    } else {
      month = 0
      year  = parseInt(parts[0], 10)
    }
    if (isNaN(year)) return ''
    const years = Math.floor(
      (Date.now() - new Date(year, month).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
    )
    return years > 0 ? String(years) : ''
  }

  function resolveProfile(profile) {
    const exp = (profile.experiences && profile.experiences[0]) || {}
    const edu = (profile.educations  && profile.educations[0])  || {}
    return Object.assign({}, profile, {
      currentEmployer: exp.employer       || profile.currentEmployer || '',
      currentTitle:    exp.title          || profile.currentTitle    || '',
      yearsExperience: computeYearsExperience(exp.startDate),
      school:          edu.school         || profile.school          || '',
      education:       edu.degree         || profile.education       || '',
      graduationYear:  edu.graduationYear || profile.graduationYear  || '',
      gpa:             edu.gpa            || profile.gpa             || '',
      major:           edu.major          || profile.major           || '',
    })
  }

  // ── Main autofill handler ─────────────────────────────────────────
  async function reportSessionData(apiBaseUrl, sessionId, result, events) {
    if (!apiBaseUrl || !sessionId) return
    try {
      if (events.length > 0) {
        await fetch(`${apiBaseUrl}/application-sessions/${sessionId}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events }),
        })
      }
      await fetch(`${apiBaseUrl}/application-sessions/${sessionId}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: result.missed > 0 ? 'completed_with_gaps' : 'completed',
          final_result: result.missed > 0 ? 'manual_review_needed' : 'filled',
          submitted: false,
        }),
      })
    } catch (err) {
      console.warn('[TrackFill] Could not report session data:', err)
    }
  }

  async function autofill(rawProfile, sessionId, apiBaseUrl) {
    const profile = resolveProfile(rawProfile)
    let filled = 0
    let missed = 0
    const missedFields = []
    const events = []

    Object.entries(FIELD_MAP).forEach(([key, selectors]) => {
      const value = profile[key]
      if (!value || value === 'FILL_ME' || value.includes('FILL_ME')) return

      const outcome = fill(selectors, value)
      if (outcome.success) {
        filled++
        events.push({
          event_type: 'field_filled',
          field_name: key,
          selector: outcome.selector,
          detail_json: { mode: outcome.mode },
        })
      } else {
        missed++
        missedFields.push(key)
        events.push({
          event_type: 'field_not_found',
          field_name: key,
          selector: null,
          detail_json: { attempted_selectors: selectors.slice(0, 4) },
        })
        console.warn(`[TrackFill] No match for field: ${key}`)
      }
    })

    console.log(`[TrackFill] Done — ${filled} filled, ${missed} missed`)
    injectBadge(filled, missed, missedFields)
    const result = { status: 'done', filled, missed }
    await reportSessionData(apiBaseUrl, sessionId, result, events)
    return result
  }

  // ── Message listener ──────────────────────────────────────────────
  if (!window.__trackfillLoaded) {
    window.__trackfillLoaded = true

    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.action === 'autofill') {
        try {
          autofill(msg.profile, msg.sessionId, msg.apiBaseUrl).then(sendResponse)
        } catch (err) {
          console.error('[TrackFill] Error during autofill:', err)
          sendResponse({ status: 'error', message: err.message })
        }
        return true
      }
    })

    console.log('[TrackFill] Content script ready.')
  }
})()
