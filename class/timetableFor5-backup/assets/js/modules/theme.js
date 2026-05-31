export function applyTheme({ document, themeBtn }, theme) {
  document.body.className = theme === "light" ? "theme-light" : "theme-dark";
  if (themeBtn) {
    themeBtn.dataset.theme = theme;
  }
}

export function installThemeToggle({ document, themeBtn, getTheme, setTheme, onAfterApply }) {
  if (!themeBtn) return;

  // Initial paint
  applyTheme({ document, themeBtn }, getTheme());

  themeBtn.addEventListener("click", () => {
    const next = getTheme() === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme({ document, themeBtn }, next);
    if (typeof onAfterApply === "function") onAfterApply(next);
  });
}
