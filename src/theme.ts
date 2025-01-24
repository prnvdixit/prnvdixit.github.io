export function initTheme(): void {
    const themeToggle = document.querySelector('.theme-toggle') as HTMLButtonElement;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Load saved theme or use system preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.body.dataset.theme = savedTheme;
        updateThemeIcon();
    } else if (prefersDark.matches) {
        document.body.dataset.theme = 'dark';
        updateThemeIcon();
    }
    
    // Toggle theme on button click
    themeToggle.addEventListener('click', () => {
        const isDark = document.body.dataset.theme === 'dark';
        document.body.dataset.theme = isDark ? 'light' : 'dark';
        localStorage.setItem('theme', isDark ? 'light' : 'dark');
        updateThemeIcon();
    });
    
    // Update theme when system preference changes
    prefersDark.addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            document.body.dataset.theme = e.matches ? 'dark' : 'light';
            updateThemeIcon();
        }
    });
}

function updateThemeIcon(): void {
    // Theme toggle appearance is handled through CSS transforms
}