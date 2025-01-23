import { navigateTo } from './router';

export function setupNavigation() {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.matches('[data-link]')) {
      e.preventDefault();
      const href = (target as HTMLAnchorElement).href;
      const path = new URL(href).pathname;
      history.pushState(null, '', path);
      navigateTo(path);
    }
  });

  window.addEventListener('popstate', () => {
    navigateTo(window.location.pathname);
  });
}