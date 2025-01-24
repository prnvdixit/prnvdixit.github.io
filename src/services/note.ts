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
  pinned?: boolean;
  hidden?: boolean; // Add this field
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
    return [...this.notes]
      .filter(note => !note.hidden)
      .sort(
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
    return `note/${note.blogLink}`;
  }

  public async getNotesByTags(tags: string[]): Promise<Note[]> {
    await this.initialize();
    return this.notes
      .filter(note => !note.hidden && tags.every(tag => note.tags.includes(tag)))
      .sort(
        (a, b) =>
          new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
      );
  }

  public async getNotesByTag(tag: string): Promise<Note[]> {
    return this.getNotesByTags([tag]);
  }

  public getAdjacentNotes(currentNote: Note): {
    previous: Note | null;
    next: Note | null;
  } {
    const sortedNotes = this.getAllNotes();
    const currentIndex = sortedNotes.findIndex(
      (note) => note.id === currentNote.id
    );

    return {
      previous:
        currentIndex < sortedNotes.length - 1
          ? sortedNotes[currentIndex + 1]
          : null,
      next: currentIndex > 0 ? sortedNotes[currentIndex - 1] : null,
    };
  }

  public parseMarkdown(content: string): string {
    return marked(content);
  }

  public async getTagFrequencies(): Promise<Map<string, number>> {
    await this.initialize();
    const tagFrequencies = new Map<string, number>();

    this.notes
      .filter(note => !note.hidden) // Only count tags from visible notes
      .forEach((note) => {
        note.tags?.forEach((tag) => {
          tagFrequencies.set(tag, (tagFrequencies.get(tag) || 0) + 1);
        });
      });

    return tagFrequencies;
  }
}
