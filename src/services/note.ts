import { marked } from "marked";

export interface Note {
  id: string;
  title: string;
  content: string;
  readingTime: string;
  githubLink?: string;
  publishDate: string;
  tags: string[];
  contentPath?: string;
  blogLink: string;
  links?: Array<{ url: string; description: string }>;
}

export class NoteService {
  private static instance: NoteService;
  private notes: Note[] = [];
  private initialized: boolean = false;

  private constructor() {}

  public static getInstance(): NoteService {
    if (!NoteService.instance) {
      NoteService.instance = new NoteService();
    }
    return NoteService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const response = await fetch("/data/notes.json");
      const notesData = await response.json();

      this.notes = await Promise.all(
        notesData.notes.map(async (note: Omit<Note, "content">) => {
          try {
            const contentResponse = await fetch(`/data/${note.contentPath}`);
            if (!contentResponse.ok) {
              throw new Error(`Failed to load content for note ${note.id}`);
            }
            const content = await contentResponse.text();
            return {
              ...note,
              content,
            };
          } catch (error) {
            console.error(`Error loading content for note ${note.id}:`, error);
            return {
              ...note,
              content: "Content could not be loaded.",
            };
          }
        })
      );

      this.initialized = true;
    } catch (error) {
      console.error("Error loading notes:", error);
      this.notes = [];
    }
  }

  public getAllNotes(): Note[] {
    return [...this.notes].sort(
      (a, b) =>
        new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
    );
  }

  public getNoteById(id: string): Note | undefined {
    return this.notes.find((note) => note.id === id);
  }

  public getNoteByBlogLink(blogLink: string): Note | undefined {
    return this.notes.find((note) => note.blogLink === blogLink);
  }

  public getUrlFromNote(note: Note): string {
    return note.blogLink;
  }

  public async getNotesByTags(tags: string[]): Promise<Note[]> {
    await this.initialize();
    return this.notes
      .filter((note) => tags.every((tag) => note.tags.includes(tag)))
      .sort(
        (a, b) =>
          new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
      );
  }

  public async getNotesByTag(tag: string): Promise<Note[]> {
    return this.getNotesByTags([tag]);
  }

  public parseMarkdown(content: string): string {
    return marked(content);
  }
}
