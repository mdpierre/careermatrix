// profiles.js — TrackFill profile data store
// Update all "FILL_ME" values with your real information before use.

const DEFAULT_PROFILES = {
  profile_1: {
    displayName: "Profile 1",
    profileName: "Profile 1",
    firstName: "",
    lastName: "",
    fullName: "",
    email: "",
    phone: "",
    city: "",
    state: "",
    zip: "",
    country: "United States",
    linkedin: "",
    website: "",
    github: "",
    targetTitle: "",
    targetSalary: "",
    workAuthorization: "Yes - U.S. Citizen or Permanent Resident",
    requireSponsorship: "No",
    veteran: "No",
    disability: "Prefer not to say",
    gender: "Prefer not to say",
    ethnicity: "Prefer not to say",
    summary: "",
    resumeLabel: "",
    experiences: [],
    educations: [],
  },
  profile_2: {
    displayName: "Profile 2",
    profileName: "Profile 2",
    firstName: "",
    lastName: "",
    fullName: "",
    email: "",
    phone: "",
    city: "",
    state: "",
    zip: "",
    country: "United States",
    linkedin: "",
    website: "",
    github: "",
    targetTitle: "",
    targetSalary: "",
    workAuthorization: "Yes - U.S. Citizen or Permanent Resident",
    requireSponsorship: "No",
    veteran: "No",
    disability: "Prefer not to say",
    gender: "Prefer not to say",
    ethnicity: "Prefer not to say",
    summary: "",
    resumeLabel: "",
    experiences: [],
    educations: [],
  },
  profile_3: {
    displayName: "Profile 3",
    profileName: "Profile 3",
    firstName: "",
    lastName: "",
    fullName: "",
    email: "",
    phone: "",
    city: "",
    state: "",
    zip: "",
    country: "United States",
    linkedin: "",
    website: "",
    github: "",
    targetTitle: "",
    targetSalary: "",
    workAuthorization: "Yes - U.S. Citizen or Permanent Resident",
    requireSponsorship: "No",
    veteran: "No",
    disability: "Prefer not to say",
    gender: "Prefer not to say",
    ethnicity: "Prefer not to say",
    summary: "",
    resumeLabel: "",
    experiences: [],
    educations: [],
  }
}

// Initialize storage with defaults if not already set
chrome.storage.local.get(["profiles", "activeProfile"], (result) => {
  const updates = {}
  if (!result.profiles) updates.profiles = DEFAULT_PROFILES
  if (!result.activeProfile) updates.activeProfile = "profile_1"
  if (Object.keys(updates).length > 0) {
    chrome.storage.local.set(updates)
  }
})
