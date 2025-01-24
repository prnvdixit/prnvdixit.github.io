export function initTheme(): void {
  const themeToggle = document.querySelector(
    ".theme-toggle"
  ) as HTMLButtonElement;

  // Load saved theme or default to dark theme
  const savedTheme = localStorage.getItem("theme") || "dark";
  document.body.dataset.theme = savedTheme;
  updateThemeIcon();

  // Toggle theme on button click
  themeToggle.addEventListener("click", () => {
    const isDark = document.body.dataset.theme === "dark";
    const nextTheme = isDark ? "light" : "dark";
    document.body.dataset.theme = nextTheme;
    localStorage.setItem("theme", nextTheme);
    updateThemeIcon();
  });
}

function updateThemeIcon(): void {
  // Theme toggle appearance is handled through CSS transforms
}
