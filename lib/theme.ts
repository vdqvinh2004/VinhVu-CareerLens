const THEME_STORAGE_KEY = "meshmind-theme";
const DARK_MODE_QUERY = "(prefers-color-scheme: dark)";

const themePreferences = ["system", "light", "dark"] as const;

type ThemePreference = (typeof themePreferences)[number];
type ResolvedTheme = Exclude<ThemePreference, "system">;

function isThemePreference(value: unknown): value is ThemePreference {
  return themePreferences.includes(value as ThemePreference);
}

const themeInitializationScript = `
(function () {
  var preference = "system";

  try {
    var storedPreference = window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});

    if (storedPreference === "light" || storedPreference === "dark" || storedPreference === "system") {
      preference = storedPreference;
    }
  } catch (error) {}

  var resolvedTheme = preference === "dark" ||
    (preference === "system" && window.matchMedia(${JSON.stringify(DARK_MODE_QUERY)}).matches)
      ? "dark"
      : "light";
  var root = document.documentElement;

  root.classList.toggle("dark", resolvedTheme === "dark");
  root.dataset.theme = resolvedTheme;
  root.dataset.themePreference = preference;
})();
`;

export {
  DARK_MODE_QUERY,
  THEME_STORAGE_KEY,
  isThemePreference,
  themeInitializationScript,
  themePreferences,
};
export type { ResolvedTheme, ThemePreference };
