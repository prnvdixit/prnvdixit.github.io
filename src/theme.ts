import { updateThemeForNotes } from './pages/notes';

export function createThemeToggle() {
  const button = document.getElementById('themeToggle');
  if (!button) return;

  const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="5"></circle>
    <line x1="12" y1="1" x2="12" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="23"></line>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
    <line x1="1" y1="12" x2="3" y2="12"></line>
    <line x1="21" y1="12" x2="23" y2="12"></line>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
  </svg>`;

  const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
  </svg>`;

  function updateIcon(): void {
    if (!button) return;
    const isDark = document.documentElement.classList.contains('dark');
    button.innerHTML = isDark ? sunIcon : moonIcon;
  }

  function setInitialTheme(): void {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else {
      const systemDark = window.matchMedia(
        '(prefers-color-scheme: dark)'
      ).matches;
      document.documentElement.classList.toggle('dark', systemDark);
    }
    updateThemeForNotes(savedTheme ? savedTheme : 'dark');
    updateIcon();
  }

  function toggleTheme(): void {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');

    updateIcon();
    updateThemeForNotes(isDark ? 'dark' : 'light');
  }

  button.addEventListener('click', toggleTheme);
  setInitialTheme();

  // Watch for system theme changes
  const systemPreferenceQuery = window.matchMedia(
    '(prefers-color-scheme: dark)'
  );
  systemPreferenceQuery.addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      document.documentElement.classList.toggle('dark', e.matches);
      updateIcon();
    }
  });
}