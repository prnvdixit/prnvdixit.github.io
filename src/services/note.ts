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
    // 1. Process glossary links [text](glossary:definition)
    let processedContent = content.replace(/\[([^\]]+)\]\(glossary:([^)]+)\)/g, (_match, text, definition) => {
      const escapedDefinition = definition.replace(/"/g, "&quot;").trim();
      return `<span class="glossary-term" data-tooltip="${escapedDefinition}">${text}</span>`;
    });

    // 2. Process poetic focus highlights focus(text)
    // Note: This must handle cases where the inner text might contain glossary spans
    processedContent = processedContent.replace(/focus\(([^)]+)\)/g, (_match, text) => {
      return `<span class="poetic-focus">${text}</span>`;
    });

    const renderer = new marked.Renderer();
    renderer.link = (href, title, text) => {
      return `<a href="${href}" ${title ? `title="${title}"` : ""} target="_blank" rel="noopener noreferrer" data-tooltip="${href}">${text}</a>`;
    };
    return marked(processedContent, { renderer });
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
    } else if (note.blogLink === "paper-shelf") {
      contentHtml = await this.renderPaperShelf(note.content);
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
    const lines = content.split("\n");
    const sections: { title: string; movies: any[] }[] = [];
    let currentSection: { title: string; movies: any[] } | null = null;
    let currentMovie: { title: string; year?: string; imdbID?: string; reviewLines: string[] } | null = null;

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (trimmedLine === "") return;

      if (line.startsWith("## ")) {
        // Save current movie if exists
        if (currentMovie && currentSection) {
          currentSection.movies.push({
            title: currentMovie.title,
            year: currentMovie.year,
            imdbID: currentMovie.imdbID,
            review: currentMovie.reviewLines.join("\n")
          });
          currentMovie = null;
        }
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = { title: line.replace("## ", "").trim(), movies: [] };
      } else if (trimmedLine.startsWith(">")) {
        // This is a review line
        if (currentMovie) {
          currentMovie.reviewLines.push(trimmedLine.substring(1).trim());
        }
      } else if (currentSection) {
        // Save previous movie if exists
        if (currentMovie) {
          currentSection.movies.push({
            title: currentMovie.title,
            year: currentMovie.year,
            imdbID: currentMovie.imdbID,
            review: currentMovie.reviewLines.join("\n")
          });
        }
        // Parse new movie line
        const match = trimmedLine.match(/(.+)\s\((tt\d+|\d{4})\)/);
        if (match) {
          const isId = match[2].startsWith("tt");
          currentMovie = { 
            title: match[1].trim(), 
            year: isId ? undefined : match[2],
            imdbID: isId ? match[2] : undefined,
            reviewLines: [] 
          };
        } else {
          currentMovie = null;
        }
      }
    });

    // Don't forget the last movie and section
    const finalMovie = currentMovie as { title: string; year?: string; imdbID?: string; reviewLines: string[] } | null;
    const finalSection = currentSection as { title: string; movies: any[] } | null;
    if (finalMovie && finalSection) {
      finalSection.movies.push({
        title: finalMovie.title,
        year: finalMovie.year,
        imdbID: finalMovie.imdbID,
        review: finalMovie.reviewLines.join("\n")
      });
    }
    if (finalSection && !sections.includes(finalSection)) {
      sections.push(finalSection);
    }

    const renderedSections = await Promise.all(
      sections.map(async (section) => {
        const movieCards = await Promise.all(
          section.movies.map(async (movie: any) => {
            try {
              let url = "";
              if (movie.imdbID) {
                url = `https://www.omdbapi.com/?i=${movie.imdbID}&apikey=72bc447a`;
              } else {
                url = `https://www.omdbapi.com/?t=${encodeURIComponent(movie.title)}&y=${movie.year}&apikey=72bc447a`;
              }
              const response = await fetch(url);
              const data = await response.json();
              const hasReview = movie.review && movie.review.trim() !== "";

              if (data.Response === "True") {
                return `
                  <div class="movie-card ${hasReview ? 'has-review' : ''}">
                    ${hasReview ? '<span class="review-indicator" title="Has a review">\u270d\ufe0f</span>' : ''}
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
    const sections: { title: string; songs: { title: string; artist: string; url: string; videoId: string }[] }[] = [];
    let currentSection: { title: string; songs: { title: string; artist: string; url: string; videoId: string }[] } | null = null;

    lines.forEach((line) => {
      if (line.startsWith("## ")) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = { title: line.replace("## ", "").trim(), songs: [] };
      } else if (currentSection) {
        const parts = line.split("|").map(p => p.trim());
        let title = "", artist = "", url = "";
        if (parts.length === 3) {
          title = parts[0]; artist = parts[1]; url = parts[2];
        } else if (parts.length === 2) {
          title = parts[0]; artist = ""; url = parts[1];
        } else {
          title = ""; artist = ""; url = line.trim();
        }

        const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
        const videoId = match && match[2].length === 11 ? match[2] : null;
        if (videoId) {
           currentSection.songs.push({ title, artist, url, videoId });
        }
      }
    });
    if (currentSection) {
      sections.push(currentSection);
    }

    const renderedSections = sections.map((section, sIndex) => {
      const songListItems = section.songs.map((song, index) => {
        return `
          <div class="song-list-item" 
               data-video-id="${song.videoId}" 
               data-title="${song.title.replace(/"/g, '&quot;')}" 
               data-artist="${song.artist.replace(/"/g, '&quot;')}" 
               data-section-index="${sIndex}" 
               data-song-index="${index}"
               data-section-songs='${JSON.stringify(section.songs.map(s => ({title: s.title, artist: s.artist, videoId: s.videoId}))).replace(/'/g, "&apos;")}'>
            <div class="sl-col-index">
              <span class="track-number">${index + 1}</span>
              <span class="play-icon-hover">▶</span>
            </div>
            <div class="sl-col-title" data-title="${song.title.replace(/"/g, '&quot;')}" data-artist="${song.artist.replace(/"/g, '&quot;')}">${song.title}</div>
            <div class="sl-col-artist">${song.artist || "Unknown Artist"}</div>
          </div>
        `;
      });

      const playAllBtn = section.songs.length > 0
        ? `<button class="play-all-btn" 
                   data-section-songs='${JSON.stringify(section.songs.map(s => ({title: s.title, artist: s.artist, videoId: s.videoId}))).replace(/'/g, "&apos;")}'>
             <span class="play-icon-small">▶</span> Play All
           </button>`
        : "";

      return `
        <div class="section-header">
          <div class="section-title-wrapper">
            <h3>${section.title}</h3>
            <span class="playlist-length">${section.songs.length} songs</span>
          </div>
          ${playAllBtn}
        </div>
        <div class="song-list">
          <div class="song-list-header-row">
            <div class="sl-col-index">#</div>
            <div class="sl-col-title">Title</div>
            <div class="sl-col-artist">Artist</div>
          </div>
          ${songListItems.join("")}
        </div>
      `;
    });

    return Promise.resolve(renderedSections.join(""));
  }

  private async renderPaperShelf(content: string): Promise<string> {
    const lines = content.split("\n").filter((line) => line.trim() !== "");
    const sections: { title: string; papers: { title: string; url: string; summary: string }[] }[] = [];
    let currentSection: { title: string; papers: { title: string; url: string; summary: string }[] } | null = null;

    lines.forEach((line) => {
      if (line.startsWith("## ")) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = { title: line.replace("## ", "").trim(), papers: [] };
      } else if (currentSection) {
        const parts = line.split("|").map((p) => p.trim());
        if (parts.length >= 2) {
          currentSection.papers.push({
            title: parts[0],
            url: parts[1],
            summary: parts[2] || "",
          });
        }
      }
    });
    if (currentSection) {
      sections.push(currentSection);
    }

    const renderedSections = sections.map((section) => {
      const paperCards = section.papers.map((paper) => {
        return `
            <div class="paper-card">
              <div class="paper-info">
                <h3 class="paper-title">${paper.title}</h3>
                <p class="paper-summary">${paper.summary}</p>
                <a href="${paper.url}" target="_blank" class="paper-link">View Paper →</a>
              </div>
            </div>
          `;
      });

      return `
        <h3>${section.title}</h3>
        <div class="paper-grid">${paperCards.join("")}</div>
      `;
    });

    return Promise.resolve(renderedSections.join(""));
  }
}
