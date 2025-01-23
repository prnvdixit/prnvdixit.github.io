import { renderHome } from './pages/home';
import { renderAbout } from './pages/about';
import { renderNotesList, renderNote } from './pages/notes';

export async function navigateTo(path: string) {
  const app = document.getElementById('app');
  if (!app) return;

  // Check if it's a tag URL first (more specific)
  const tagMatch = path.match(/^\/notes\/tag\/(.+)$/);
  if (tagMatch) {
    const tag = decodeURIComponent(tagMatch[1]);
    await renderNotesList(tag);
    return;
  }

  // Then check if it's a note URL
  const noteMatch = path.match(/^\/notes\/(.+)$/);
  if (noteMatch) {
    await renderNote(noteMatch[1]);
    return;
  }

  switch (path) {
    case '/':
      renderHome();
      break;
    case '/about':
      renderAbout();
      break;
    case '/notes':
      await renderNotesList();
      break;
    default:
      app.innerHTML = '<h1>404 - Page Not Found</h1>';
  }
}