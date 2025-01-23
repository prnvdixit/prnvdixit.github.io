import homeTemplate from '../pages/layout/home.html?raw';

export function renderHome() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = homeTemplate;
}