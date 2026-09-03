import { useEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "apartment-ledger.theme";

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): "light" | "dark" {
  return preference === "system" ? (systemPrefersDark ? "dark" : "light") : preference;
}

function getSystemPreference() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function getInitialPreference(): ThemePreference {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(saved) ? saved : "system";
  } catch {
    return "system";
  }
}

export function useThemePreference() {
  const [preference, setPreference] = useState<ThemePreference>(getInitialPreference);
  const [systemPrefersDark, setSystemPrefersDark] = useState(getSystemPreference);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;

    const handleChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);
    media.addEventListener?.("change", handleChange);
    return () => media.removeEventListener?.("change", handleChange);
  }, []);

  useEffect(() => {
    const resolved = resolveTheme(preference, systemPrefersDark);
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePreference = preference;
    document.documentElement.style.colorScheme = resolved;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // The selected theme still applies for this session when storage is unavailable.
    }
  }, [preference, systemPrefersDark]);

  return { preference, setPreference, resolved: resolveTheme(preference, systemPrefersDark) };
}
