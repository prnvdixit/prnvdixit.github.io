import {
  loadAllNotes,
  loadNoteBySlug,
  loadNotesByTag,
} from '../utils/markdown';
import { NoteCard } from '../components/NoteCard';
import notesListTemplate from '../pages/layout/notes.html?raw';
import singleNoteTemplate from '../pages/layout/note.html?raw';

export function updateThemeForNotes(theme: string | null) {
  const notesStyleElement = document.getElementById('github-markdown');
  if (notesStyleElement instanceof HTMLLinkElement) {
    const isDark = theme === 'dark' || 
      (!theme && document.documentElement.classList.contains('dark'));
    notesStyleElement.href = isDark
      ? 'https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown-dark.min.css'
      : 'https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown-light.min.css';
  }
}

export async function renderNotesList(tag?: string) {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = notesListTemplate;
  const notesGrid = app.querySelector('.notes-grid');
  if (!notesGrid) return;

  const notes = tag ? await loadNotesByTag(tag) : await loadAllNotes();
  const sortedNotes = [...notes].sort(
    (a, b) => b.publishDate.getTime() - a.publishDate.getTime()
  );

  const title = app.querySelector('h1');
  if (title && tag) {
    title.textContent = `Notes tagged "${tag}"`;
    const intro = app.querySelector('.intro');
    if (intro) {
      intro.innerHTML = `
        <a href="/notes" data-link class="back-link">← Back to all notes</a>
      `;
    }
  }

  notesGrid.innerHTML =
    sortedNotes.length > 0
      ? sortedNotes.map((note) => NoteCard(note)).join('')
      : '<p class="no-notes">No notes found.</p>';
}

export async function renderNote(slug: string) {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = singleNoteTemplate;

  // Set theme before loading content
  const currentTheme = localStorage.getItem('theme') || 
    (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  updateThemeForNotes(currentTheme);

  const note = await loadNoteBySlug(slug);
  if (!note) {
    app.innerHTML = '<h1>Note not found</h1>';
    return;
  }

  const content = app.querySelector('.content');
  if (content) {
    content.innerHTML = `
      <div class="note-metadata">
        <h1>${note.title}</h1>
        <div class="metadata">
          <time datetime="${note.publishDate.toISOString()}">
            ${note.publishDate.toLocaleDateString()}
          </time>
          <span>·</span>
          <span>${note.readingTime} min read</span>
          ${
            note.githubLink
              ? `
            <span>·</span>
            <a href="${note.githubLink}" target="_blank" rel="noopener noreferrer" class="github-link">
              View on GitHub
            </a>
          `
              : ''
          }
        </div>
        <div class="tags">
          ${note.tags
            .map(
              (tag) => `
            <a href="/notes/tag/${encodeURIComponent(
              tag
            )}" data-link class="tag">${tag}</a>
          `
            )
            .join('')}
        </div>
      </div>
      ${note.content}
    `;
  }

  const copyButton = app.querySelector('.copy-button');
  if (copyButton) {
    copyButton.addEventListener('click', async () => {
      const url = window.location.href;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(url);
          copyButton.textContent = 'Copied!';
        } else {
          // Fallback for browsers that don't support clipboard API
          const textArea = document.createElement('textarea');
          textArea.value = url;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          textArea.style.top = '-999999px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          try {
            document.execCommand('copy');
            copyButton.textContent = 'Copied!';
          } catch (err) {
            console.error('Failed to copy URL:', err);
            copyButton.textContent = 'Failed to copy';
          }
          textArea.remove();
        }
      } catch (err) {
        console.error('Failed to copy URL:', err);
        copyButton.textContent = 'Failed to copy';
      }
      setTimeout(() => {
        copyButton.textContent = 'Copy URL';
      }, 2000);
    });
  }

  // Initialize HTML Comment Box
  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.innerHTML = `
  if(!window.hcb_user){hcb_user={};} (function(){var s=document.createElement("script"), l=hcb_user.PAGE || (""+window.location).replace(/'/g,"%27"), h="https://www.htmlcommentbox.com";s.setAttribute("type","text/javascript");s.setAttribute("src", h+"/jread?page="+encodeURIComponent(l).replace("+","%2B")+"&mod=%241%24wq1rdBcg%24KJMmEL71byVY1j2LJQUns0"+"&opts=17310&num=10&ts=1737627297297");if (typeof s!="undefined") document.getElementsByTagName("head")[0].appendChild(s);})();
  `
  document.head.appendChild(script);
}