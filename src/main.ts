import { navigateTo } from './router';
import { setupNavigation } from './navigation';
import { createThemeToggle } from './theme';

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  createThemeToggle();

  // Handle initial route
  navigateTo(window.location.pathname);
});
