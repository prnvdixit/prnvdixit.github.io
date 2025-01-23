import { marked } from 'marked';
import fm from 'front-matter';
import { Note } from '../types';

interface NoteAttributes {
  title: string;
  publishDate: string;
  readingTime: number;
  tags: string[];
  githubLink?: string;
}

export async function loadNoteBySlug(slug: string): Promise<Note | null> {
  try {
    const modules = import.meta.glob<string>('/src/content/notes/*.md', {
      query: '?raw',
      import: 'default',
    });
    const path = `/src/content/notes/${slug}.md`;
    const module = modules[path];
    if (!module) {
      throw new Error(`No module found for slug: ${slug}`);
    }
    const text = await module();

    const { attributes, body } = fm<NoteAttributes>(text);
    const content = await marked(body, { async: false }) as string;

    return {
      title: attributes.title,
      publishDate: new Date(attributes.publishDate),
      readingTime: attributes.readingTime,
      tags: attributes.tags || [],
      githubLink: attributes.githubLink,
      slug,
      content,
    };
  } catch (error) {
    console.error(`Error loading note ${slug}:`, error);
    return null;
  }
}

export async function loadAllNotes(): Promise<Note[]> {
  const notes: Note[] = [];
  const modules = await Promise.all(
    Object.entries(
      import.meta.glob<string>('/src/content/notes/*.md', {
        query: '?raw',
        import: 'default',
      })
    ).map(([path, loader]) => loader().then((content) => ({ path, content })))
  );

  for (const { path, content } of modules) {
    const slug = path.split('/').pop()?.replace('.md', '');
    if (slug) {
      const { attributes, body } = fm<NoteAttributes>(content);
      const htmlContent = await marked(body, { async: false }) as string;
      notes.push({
        title: attributes.title,
        publishDate: new Date(attributes.publishDate),
        readingTime: attributes.readingTime,
        tags: attributes.tags || [],
        githubLink: attributes.githubLink,
        slug,
        content: htmlContent,
      });
    }
  }

  return notes;
}

export async function loadNotesByTag(tag: string): Promise<Note[]> {
  const notes = await loadAllNotes();
  return notes.filter((note) => note.tags.includes(tag));
}