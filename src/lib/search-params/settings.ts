import { createLoader, parseAsString, parseAsStringLiteral } from "nuqs/server"

export const SETTINGS_TABS = ["clinics", "doctors", "services", "availability"] as const
export type SettingsTab = (typeof SETTINGS_TABS)[number]

export const settingsSearchParams = {
  tab: parseAsStringLiteral(SETTINGS_TABS).withDefault("clinics"),
  /** Doctor selected on the Availability tab. */
  doctor: parseAsString,
}

export const loadSettingsParams = createLoader(settingsSearchParams)
