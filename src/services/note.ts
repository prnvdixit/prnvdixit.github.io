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

  private constructor() { }

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

  public getAllNotes(includeHidden: boolean = false): Note[] {
    return [...this.notes]
      .filter((note) => includeHidden || !note.hidden)
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
    const renderer = new marked.Renderer();
    renderer.link = (href, title, text) => {
      return `<a href="${href}" ${title ? `title="${title}"` : ""} target="_blank" rel="noopener noreferrer">${text}</a>`;
    };
    return marked(content, { renderer });
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

  public async renderFullNote(note: Note, activeTags: string[] = []): Promise<string> {
    let contentHtml = "";
    if (note.blogLink === "screens") {
      contentHtml = await this.renderMovies(note.content);
    } else if (note.blogLink === "songs") {
      contentHtml = await this.renderSongs(note.content);
    } else {
      contentHtml = this.parseMarkdown(note.content);
    }

    return `
      <div class="note-header">
         <div class="note-header-top">
            <h2>
              <a href="/${this.getUrlFromNote(note)}" data-link>
                ${note.pinned ? '<span class="pin-icon">📌</span> ' : ""}${note.title}
              </a>
            </h2>
         </div>
         <div class="note-meta">
            <span class="reading-time">⌛ ${note.readingTime}</span>
            <span class="publish-date">🗓️ ${note.publishDate}</span>
            <div class="note-tags">
                ${note.tags.map(tag => `<a href="/tag/${tag}" class="tag ${activeTags.includes(tag) ? 'active' : ''}" data-link>${tag}</a>`).join("")}
            </div>
         </div>
      </div>
      <div class="note-content">${contentHtml}</div>
      <div class="feed-footer">
        <div class="separator-line"></div>
        <div class="separator-line"></div>
        <div class="separator-line"></div>
      </div>
    `;
  }

  private async renderMovies(content: string): Promise<string> {
    const lines = content.split("\n").filter((line) => line.trim() !== "");
    const sections: { title: string; movies: any[] }[] = [];
    let currentSection: { title: string; movies: any[] } | null = null;

    lines.forEach((line) => {
      if (line.startsWith("## ")) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = { title: line.replace("## ", "").trim(), movies: [] };
      } else if (currentSection) {
        const match = line.match(/(.+)\s\((\d{4})\)/);
        if (match) {
          currentSection.movies.push({ title: match[1].trim(), year: match[2] });
        }
      }
    });
    if (currentSection) {
      sections.push(currentSection);
    }

    const renderedSections = await Promise.all(
      sections.map(async (section) => {
        const movieCards = await Promise.all(
          section.movies.map(async (movie: any) => {
            try {
              const response = await fetch(
                `https://www.omdbapi.com/?t=${encodeURIComponent(
                  movie.title
                )}&y=${movie.year}&apikey=72bc447a`
              );
              const data = await response.json();

              if (data.Response === "True") {
                return `
                  <div class="movie-card">
                    <img src="${data.Poster}" alt="${data.Title} Poster" class="movie-poster">
                    <div class="movie-info">
                      <h3>${data.Title} (${data.Year})</h3>
                      <p><strong>Director:</strong> ${data.Director}</p>
                      <p><strong>IMDb:</strong> ${data.imdbRating}</p>
                    </div>
                  </div>
                `;
              } else {
                return `
                  <div class="movie-card error">
                    <h3>${movie.title} (${movie.year})</h3>
                    <p>Could not load movie details.</p>
                  </div>
                `;
              }
            } catch (error) {
              console.error("Error fetching movie data:", error);
              return `
                  <div class="movie-card error">
                    <h3>${movie.title} (${movie.year})</h3>
                    <p>Error loading movie details.</p>
                  </div>
                `;
            }
          })
        );
        return `
          <h3>${section.title}</h3>
          <div class="movie-grid">${movieCards.join("")}</div>
        `;
      })
    );

    return renderedSections.join("");
  }

  private renderSongs(content: string): Promise<string> {
    const lines = content.split("\n").filter((line) => line.trim() !== "");
    const sections: { title: string; songs: { title: string; artist: string; url: string }[] }[] = [];
    let currentSection: { title: string; songs: { title: string; artist: string; url: string }[] } | null = null;

    lines.forEach((line) => {
      if (line.startsWith("## ")) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = { title: line.replace("## ", "").trim(), songs: [] };
      } else if (currentSection) {
        const parts = line.split("|").map(p => p.trim());
        if (parts.length === 3) {
          currentSection.songs.push({
            title: parts[0],
            artist: parts[1],
            url: parts[2],
          });
        } else if (parts.length === 2) {
          currentSection.songs.push({
            title: parts[0],
            artist: "",
            url: parts[1],
          });
        } else {
          currentSection.songs.push({
            title: "",
            artist: "",
            url: line.trim(),
          });
        }
      }
    });
    if (currentSection) {
      sections.push(currentSection);
    }

    const renderedSections = sections.map((section) => {
      const songCards = section.songs.map((song) => {
        let videoId = "";

        // Extract video ID from YouTube URL
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = song.url.match(regExp);
        if (match && match[2].length === 11) {
          videoId = match[2];
        }

        if (videoId) {
          const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
          return `
            <div class="song-card">
              <a href="${song.url}" target="_blank" class="song-link">
                <div class="song-thumbnail-container">
                  <img src="${thumbnailUrl}" alt="${song.title || 'Song Thumbnail'}" class="song-thumbnail">
                  <div class="play-icon">▶</div>
                </div>
                <div class="song-info">
                  ${song.title ? `<h3>${song.title}</h3>` : ""}
                  ${song.artist ? `<p><strong>Artist:</strong> ${song.artist}</p>` : ""}
                </div>
              </a>
            </div>
          `;
        }
        return "";
      });

      return `
        <h3>${section.title}</h3>
        <div class="song-grid">${songCards.join("")}</div>
      `;
    });

    return Promise.resolve(renderedSections.join(""));
  }
}
