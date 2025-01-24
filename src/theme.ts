export function initTheme(): void {
  const themeToggle = document.querySelector(
    ".theme-toggle"
  ) as HTMLButtonElement;

  // Load saved theme or use system preference
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme) {
    document.body.dataset.theme = savedTheme;
    updateThemeIcon();
  }

  // Toggle theme on button click
  themeToggle.addEventListener("click", () => {
    const isDark = document.body.dataset.theme === "dark";
    document.body.dataset.theme = isDark ? "light" : "dark";
    localStorage.setItem("theme", isDark ? "light" : "dark");
    updateThemeIcon();
  });
}

function updateThemeIcon(): void {
  // Theme toggle appearance is handled through CSS transforms
}
