import aboutTemplate from '../pages/layout/about.html?raw';

export function renderAbout() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = aboutTemplate;
}