import { AbstractView } from "../router";
import { NoteService } from "../services/note";

export class NotePage extends AbstractView {
  private noteService: NoteService;
  private scrollVal: number;

  constructor(params: any) {
    super(params);
    this.noteService = NoteService.getInstance();
    this.scrollVal = 500;
  }

  async render(): Promise<HTMLElement> {
    const element = document.createElement("div");
    element.classList.add("note-page");

    element.innerHTML = `
            <div class="container with-toc">
                <a href="/notes" class="back-to-notes floating visible" data-link>← Back to all notes</a>
                <div id="note-content"></div>
            </div>
        `;

    try {
      await this.noteService.initialize();
      const note = this.noteService.getNoteByBlogLink(this.params.dateid);

      if (!note) {
        const noteContent = element.querySelector("#note-content");
        if (noteContent) {
          noteContent.innerHTML = `
                        <h1>Note not found</h1>
                        <p>The requested note could not be found. Please check the URL and try again.</p>
                    `;
        }
        return element;
      }

      const noteContent = element.querySelector("#note-content");
      if (noteContent) {
        noteContent.innerHTML = `
                    <div class="note-header">
                        <div class="note-header-top">
                            <h1>${note.title}</h1>
                        </div>
                        <button class="copy-link-btn" onclick="copyNoteLink('${note.id
          }')">Copy Link</button>
                            <div class="note-meta">
                            <span class="reading-time">⌛ ${note.readingTime
          }</span>
                            <span class="publish-date">🗓️ ${note.publishDate
          }</span>
                            <div class="note-tags">
                                ${note.tags
            .map(
              (tag) =>
                `<a href="/tag/${tag}" class="tag" data-link>${tag}</a>`
            )
            .join("")}
                            </div>
                            ${note.githubLink
            ? `<a href="${note.githubLink}" class="github-link" target="_blank" aria-label="View on GitHub"></a>`
            : ""
          }
                            ${note.links && note.links.length > 0
            ? note.links
              .map(
                (link) =>
                  `<a href="${link.url}" class="external-link" target="_blank" aria-label="${link.description}">🔗 ${link.description}</a>`
              )
              .join("")
            : ""
          }
                        </div>
                    </div>
                    <div class="note-content">
                        ${note.blogLink === "screens"
            ? await this.renderMovies(note.content)
            : note.blogLink === "songs"
              ? await this.renderSongs(note.content)
              : note.blogLink === "paper-shelf"
                ? await this.renderPaperShelf(note.content)
                : this.noteService.parseMarkdown(note.content)
          }        </div>
                    <div class="note-navigation">
                        ${(() => {
            const adjacentNotes =
              this.noteService.getAdjacentNotes(note);
            return `
                            ${adjacentNotes.previous
                ? `
                              <a href="/${this.noteService.getUrlFromNote(
                  adjacentNotes.previous
                )}" class="nav-link prev" data-link>
                                <span class="nav-label">← Previous</span>
                                <span class="nav-title">${adjacentNotes.previous.title
                }</span>
                              </a>
                            `
                : ""
              }
                            ${adjacentNotes.next
                ? `
                              <a href="/${this.noteService.getUrlFromNote(
                  adjacentNotes.next
                )}" class="nav-link next" data-link>
                                <span class="nav-label">Next →</span>
                                <span class="nav-title">${adjacentNotes.next.title
                }</span>
                              </a>
                            `
                : ""
              }
                          `;
          })()} 
                    </div>
                    <!-- begin wwww.htmlcommentbox.com -->
                    <div id="HCB_comment_box" style="margin-top: 3rem;"></div>
                    <link rel="stylesheet" type="text/css" href="https://www.htmlcommentbox.com/static/skins/bootstrap/twitter-bootstrap.css?v=0" />
                    <!-- end www.htmlcommentbox.com -->
                    <button class="back-to-top" aria-label="Back to top">↑</button>
                `;

        // Setup table of contents after content is rendered
        this.setupTableOfContents(element);

        // Setup scroll event listeners
        this.setupScrollListeners(element);

        // Initialize HTML Comment Box with proper error handling
        const script = document.createElement("script");
        script.type = "text/javascript";
        script.id = "hcb";
        const location = window.location.toString().replace(/'/g, "%27");
        script.src = `https://www.htmlcommentbox.com/jread?page=${encodeURIComponent(
          location
        ).replace(
          "+",
          "%2B"
        )}&mod=%241%24wq1rdBcg%24KJMmEL71byVY1j2LJQUns0&opts=17310&num=10&ts=${Date.now()}`;

        // Add load and error event listeners
        script.onload = () => {
          console.log("[HCB Debug] Comment box script loaded successfully");
          const commentBox = document.querySelector("#HCB_comment_box");
          if (commentBox) {
            // Re-run TOC setup after comment box is initialized
            this.setupTableOfContents(element);
          }
        };

        script.onerror = (error) => {
          console.error("[HCB Debug] Error loading comment box script:", error);
        };

        document.head.appendChild(script);

        // Add the copyNoteLink function to window object
        (window as any).copyNoteLink = (id: string) => {
          const note = this.noteService.getNoteById(id);
          if (note) {
            const dateId = this.noteService.getUrlFromNote(note);
            const url = window.location.origin + "/" + dateId;
            navigator.clipboard
              .writeText(url)
              .then(() => {
                const btn = document.querySelector(
                  ".copy-link-btn"
                ) as HTMLButtonElement;
                if (btn) {
                  const originalText = btn.textContent || "Copy Link";
                  btn.textContent = "Copied!";
                  setTimeout(() => {
                    btn.textContent = originalText;
                  }, 2000);
                }
              })
              .catch((err) => console.error("Failed to copy:", err));
          }
        };
      }

      return element;
    } catch (error) {
      console.error("Error loading note:", error);
      const noteContent = element.querySelector("#note-content");
      if (noteContent) {
        noteContent.innerHTML = `
                    <h1>Error Loading Note</h1>
                    <p>There was an error loading the note content. Please try again later.</p>
                `;
      }
      return element;
    }
  }
  private extractHeadings(): { level: number; text: string; id: string }[] {
    console.log("[TOC Debug] Starting heading extraction");
    const headings: { level: number; text: string; id: string }[] = [];

    // First, get the note title from note-header-top
    const noteTitle = document.querySelector(".note-header-top h1");
    if (noteTitle) {
      const titleText = noteTitle.textContent || "";
      const titleId = titleText.toLowerCase().replace(/[^\w]+/g, "-");
      noteTitle.id = titleId;
      headings.push({ level: 1, text: titleText, id: titleId });
      console.log(`[TOC Debug] Added note title: ${titleText}`);
    }

    const content = document.querySelector(".note-content");
    if (!content) {
      console.log("[TOC Debug] Note content element not found");
      return headings;
    }

    const headingElements = content.querySelectorAll("h1, h2, h3, h4, h5, h6");
    console.log(`[TOC Debug] Found ${headingElements.length} heading elements`);

    headingElements.forEach((heading) => {
      // Skip headings inside movie or song cards (titles)
      if (heading.closest(".movie-card") || heading.closest(".song-card")) {
        return;
      }
      const level = parseInt(heading.tagName[1]);
      const text = heading.textContent || "";
      const id = text.toLowerCase().replace(/[^\w]+/g, "-");
      heading.id = id;
      headings.push({ level, text, id });
      console.log(
        `[TOC Debug] Processed heading: Level ${level}, Text: "${text}", ID: ${id}`
      );
    });

    // Add Comments section if HTMLCommentBox exists
    const commentBox = document.querySelector("#HCB_comment_box");
    if (commentBox) {
      headings.push({
        level: 1,
        text: "Comments",
        id: "HCB_comment_box",
      });
      console.log("[TOC Debug] Added Comments section to TOC");
    }

    return headings;
  }

  private createTableOfContents(
    headings: { level: number; text: string; id: string }[]
  ): HTMLElement {
    const toc = document.createElement("div");
    toc.classList.add("table-of-contents");
    toc.innerHTML = "<h2>On This Page</h2>";

    const tocList = document.createElement("ul");
    tocList.classList.add("toc-list");

    let currentLevel = 1;
    let currentList = tocList;
    let listStack = [tocList];

    headings.forEach(({ level, text, id }) => {
      while (level > currentLevel) {
        const newList = document.createElement("ul");
        currentList.lastElementChild?.appendChild(newList);
        listStack.push(newList);
        currentList = newList;
        currentLevel++;
      }

      while (level < currentLevel) {
        listStack.pop();
        currentList = listStack[listStack.length - 1];
        currentLevel--;
      }

      const li = document.createElement("li");
      li.innerHTML = `<a href="#${id}" class="toc-link">${text}</a>`;
      currentList.appendChild(li);
    });

    toc.appendChild(tocList);
    return toc;
  }

  private setupTableOfContents(element: HTMLElement): void {
    console.log("[TOC Debug] Starting TOC setup");

    // Wait for a short time to ensure content is rendered
    setTimeout(() => {
      const headings = this.extractHeadings();
      console.log("[TOC Debug] Extracted headings:", headings);

      if (headings.length === 0) {
        console.log("[TOC Debug] No headings found, skipping TOC creation");
        return;
      }

      const toc = this.createTableOfContents(headings);
      console.log("[TOC Debug] Created TOC element:", toc.innerHTML);

      const container = element.querySelector(".container.with-toc");
      if (!container) {
        console.log(
          "[TOC Debug] Container with class .container.with-toc not found"
        );
        return;
      }

      // Insert TOC after the back-to-notes links but before note-content
      const noteContent = container.querySelector("#note-content");
      if (noteContent) {
        container.insertBefore(toc, noteContent);
        console.log("[TOC Debug] Successfully inserted TOC into DOM");
      } else {
        console.log(
          "[TOC Debug] Note content element not found for TOC insertion"
        );
      }

      // Add click event listeners to TOC links (except for note title)
      toc.querySelectorAll(".toc-link").forEach((link) => {
        const href = (link as HTMLAnchorElement).getAttribute("href")?.slice(1);
        if (href) {
          const target = document.getElementById(href);
          // Skip note title (H1)
          if (target) {
            link.addEventListener("click", (e) => {
              e.preventDefault();
              target.scrollIntoView({ behavior: "smooth", block: "center" });
            });
          }
        }
      });

      // Highlight current section in TOC (only for h1 and h2)
      const observer = new IntersectionObserver(
        (entries) => {
          // Check if page is zoomed out
          const isZoomedOut = window.outerWidth > window.innerWidth;
          // Check if on mobile
          const isMobile = window.innerWidth <= 768;

          if (isZoomedOut || isMobile) {
            observer.disconnect();
            return;
          }

          const intersectingEntries = entries.filter(
            (entry) => entry.isIntersecting
          );

          if (intersectingEntries.length === 0) return;

          const sortedEntries = intersectingEntries.sort((a, b) => {
            const aDistance = Math.abs(a.boundingClientRect.top);
            const bDistance = Math.abs(b.boundingClientRect.top);
            return aDistance - bDistance;
          });

          const activeHeading = sortedEntries[0];
          (window as any).lastScrollY = window.scrollY;

          // Update active classes for all TOC links
          toc.querySelectorAll(".toc-link").forEach((link) => {
            const href = (link as HTMLAnchorElement)
              .getAttribute("href")
              ?.slice(1);
            if (href) {
              if (activeHeading && activeHeading.target.id === href) {
                link.classList.add("active");
                // Ensure the active link is visible in the ToC
                const tocContainer = toc;
                const linkRect = link.getBoundingClientRect();
                const tocRect = tocContainer.getBoundingClientRect();

                if (linkRect.bottom > tocRect.bottom) {
                  tocContainer.scrollTo({
                    top:
                      tocContainer.scrollTop +
                      (linkRect.bottom - tocRect.bottom) +
                      this.scrollVal,
                    behavior: "smooth",
                  });
                } else if (linkRect.top < tocRect.top) {
                  tocContainer.scrollTo({
                    top:
                      tocContainer.scrollTop -
                      (tocRect.top - linkRect.top) -
                      this.scrollVal,
                    behavior: "smooth",
                  });
                }
              } else {
                link.classList.remove("active");
              }
            }
          });
        },
        {
          rootMargin: "-10% 0px -10% 0px",
          threshold: [0.5],
        }
      );

      // Observe all headings and Comments section for highlighting
      headings.forEach(({ id }) => {
        const element = document.getElementById(id);
        if (
          element &&
          (element.tagName.match(/^H[1-6]$/) || id === "HCB_comment_box")
        ) {
          observer.observe(element);
        }
      });
    }, 100);
  }

  private setupScrollListeners(element: HTMLElement): void {
    const backToTopBtn = element.querySelector(
      ".back-to-top"
    ) as HTMLButtonElement;
    const floatingBackLink = element.querySelector(
      ".back-to-notes.floating"
    ) as HTMLAnchorElement;
    const originalBackLink = element.querySelector(
      ".back-to-notes:not(.floating)"
    ) as HTMLAnchorElement;

    if (backToTopBtn && backToTopBtn.checkVisibility()) {
      window.addEventListener("scroll", () => {
        if (window.scrollY > this.scrollVal) {
          backToTopBtn.classList.add("visible");
          backToTopBtn.style.opacity = "1";
          backToTopBtn.style.visibility = "visible";
        } else {
          backToTopBtn.classList.remove("visible");
          backToTopBtn.style.opacity = "0";
          backToTopBtn.style.visibility = "hidden";
        }
      });

      backToTopBtn.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    if (
      floatingBackLink &&
      originalBackLink &&
      floatingBackLink.checkVisibility()
    ) {
      const originalBackLinkRect = originalBackLink.getBoundingClientRect();
      const originalTop = originalBackLinkRect.top + this.scrollVal;

      window.addEventListener("scroll", () => {
        if (window.scrollY > originalTop) {
          floatingBackLink.classList.add("visible");
        } else {
          floatingBackLink.classList.remove("visible");
        }
      });
    }
  }

  private async renderMovies(content: string): Promise<string> {
    const lines = content.split("\n");
    const sections: { title: string; movies: any[] }[] = [];
    let currentSection: { title: string; movies: any[] } | null = null;
    let currentMovie: { title: string; year?: string; imdbID?: string; reviewLines: string[]; isSeen?: boolean; inTheatre?: boolean } | null = null;

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
            review: currentMovie.reviewLines.join("\n"),
            isSeen: currentMovie.isSeen,
            inTheatre: currentMovie.inTheatre
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
            review: currentMovie.reviewLines.join("\n"),
            isSeen: currentMovie.isSeen,
            inTheatre: currentMovie.inTheatre
          });
        }
        // Parse new movie line
        const match = trimmedLine.match(/^(?:\[([^\]]+)\]\s*|([✓✔])\s*)?(.+?)\s\((tt\d+|\d{4})\)(?:\s*\[([^\]]+)\])?$/);
        if (match) {
          const prefixFlags = (match[1] || match[2] || "").toLowerCase();
          const suffixFlags = (match[5] || "").toLowerCase();
          const combinedFlags = prefixFlags + " " + suffixFlags;
          const isSeen = /x|v|✓|✔|t/.test(combinedFlags);
          const inTheatre = /t/.test(combinedFlags);
          const isId = match[4].startsWith("tt");
          currentMovie = { 
            title: match[3].trim(), 
            year: isId ? undefined : match[4],
            imdbID: isId ? match[4] : undefined,
            reviewLines: [], 
            isSeen, 
            inTheatre 
          };
        } else {
          currentMovie = null;
        }
      }
    });

    // Don't forget the last movie and section
    const finalMovie = currentMovie as { title: string; year?: string; imdbID?: string; reviewLines: string[]; isSeen?: boolean; inTheatre?: boolean } | null;
    const finalSection = currentSection as { title: string; movies: any[] } | null;
    if (finalMovie && finalSection) {
      finalSection.movies.push({
        title: finalMovie.title,
        year: finalMovie.year,
        imdbID: finalMovie.imdbID,
        review: finalMovie.reviewLines.join("\n"),
        isSeen: finalMovie.isSeen,
        inTheatre: finalMovie.inTheatre
      });
    }
    if (finalSection && !sections.includes(finalSection)) {
      sections.push(finalSection);
    }

    const renderedSections = await Promise.all(
      sections.map(async (section) => {
        const movieCards = await Promise.all(
          section.movies.map(async (movie: any, index: number) => {
            try {
              let url = "";
              if (movie.imdbID) {
                url = `https://www.omdbapi.com/?i=${movie.imdbID}&apikey=72bc447a`;
              } else {
                url = `https://www.omdbapi.com/?t=${encodeURIComponent(movie.title)}&y=${movie.year}&apikey=72bc447a`;
              }
              const response = await fetch(url);
              const data = await response.json();
              const movieId = `movie-${section.title.replace(/\s+/g, '-')}-${index}`;
              const hasReview = movie.review && movie.review.trim() !== "";
              if (data.Response === "True") {
                const fallbackPosterUrl = `https://img.omdbapi.com/?i=${data.imdbID}&apikey=72bc447a`;
                const posterUrl = data.Poster && data.Poster !== "N/A" ? data.Poster : fallbackPosterUrl;

                return {
                  card: `
                    <div class="movie-card ${hasReview ? 'has-review' : ''}" ${hasReview ? `data-movie-id="${movieId}"` : ''}>
                      ${hasReview ? '<span class="review-indicator" title="Click to see my review">\u270d\ufe0f</span>' : ''}
                      <div class="movie-indicators">
                        ${movie.isSeen && !movie.inTheatre ? '<span class="seen-indicator" title="Viewed">✓ Watched</span>' : ''}
                        ${movie.inTheatre ? '<span class="theatre-indicator" title="Watched in Theatre">🍿✓ Theatre</span>' : ''}
                      </div>
                      <img src="${posterUrl}" alt="${data.Title} Poster" class="movie-poster" onerror="this.onerror=null; this.src='${fallbackPosterUrl}';">
                      <div class="movie-info">
                        <h3>${data.Title} (${data.Year})</h3>
                        <p><strong>Director:</strong> ${data.Director}</p>
                        <p><strong>IMDb:</strong> ${data.imdbRating}</p>
                        <p>${data.Plot}</p>
                      </div>
                    </div>
                  `,
                  modal: hasReview ? `
                    <div class="movie-review-modal" id="${movieId}">
                      <div class="modal-backdrop"></div>
                      <div class="modal-content">
                        <button class="modal-close">&times;</button>
                        <img src="${posterUrl}" alt="${data.Title} Poster" class="modal-poster" onerror="this.onerror=null; this.src='${fallbackPosterUrl}';">
                        <div class="modal-info">
                          <h2>${data.Title} (${data.Year})</h2>
                          <p class="modal-meta"><strong>Director:</strong> ${data.Director} | <strong>IMDb:</strong> ${data.imdbRating}</p>
                          <div class="modal-review">
                            <h3>Notes</h3>
                            <p>${movie.review.replace(/\n/g, '<br>')}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ` : ''
                };
              } else {
                return {
                  card: `
                    <div class="movie-card error">
                      <h3>${movie.title} (${movie.year})</h3>
                      <p>Could not load movie details.</p>
                    </div>
                  `,
                  modal: ''
                };
              }
            } catch (error) {
              console.error("Error fetching movie data:", error);
              return {
                card: `
                  <div class="movie-card error">
                    <h3>${movie.title} (${movie.year})</h3>
                    <p>Error loading movie details.</p>
                  </div>
                `,
                modal: ''
              };
            }
          })
        );
        const cards = movieCards.map(m => m.card).join("");
        const modals = movieCards.map(m => m.modal).join("");
        return `
          <h2 id="${section.title.toLowerCase().replace(/\s+/g, '-')}">${section.title}</h2>
          <div class="movie-grid">${cards}</div>
          ${modals}
        `;
      })
    );

    // Add event listener setup for modals
    setTimeout(() => {
      // Move all modals to body for proper positioning
      document.querySelectorAll('.movie-review-modal').forEach(modal => {
        document.body.appendChild(modal);
      });

      document.querySelectorAll('.movie-card.has-review').forEach(card => {
        card.addEventListener('click', (e) => {
          e.stopPropagation();
          const movieId = card.getAttribute('data-movie-id');
          if (movieId) {
            const modal = document.getElementById(movieId);
            if (modal) {
              modal.classList.add('active');
              document.body.style.overflow = 'hidden';
            }
          }
        });
      });

      document.querySelectorAll('.movie-review-modal').forEach(modal => {
        const closeModal = () => {
          modal.classList.remove('active');
          document.body.style.overflow = '';
        };

        modal.querySelector('.modal-backdrop')?.addEventListener('click', closeModal);
        modal.querySelector('.modal-close')?.addEventListener('click', closeModal);

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeModal();
          }
        });
      });
    }, 100);

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
      const songListItems = section.songs.map((song, index) => {
        const match = song.url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
        const videoId = match && match[2].length === 11 ? match[2] : null;

        if (videoId) {
          return `
            <a href="${song.url}" target="_blank" rel="noopener noreferrer" class="song-list-item">
              <div class="sl-col-index">
                <span class="track-number">${index + 1}</span>
                <span class="play-icon-hover">▶</span>
              </div>
              <div class="sl-col-title">${song.title}</div>
              <div class="sl-col-artist">${song.artist || "Unknown Artist"}</div>
            </a>
          `;
        }
        return "";
      });

      const videoIds = section.songs
        .map((song) => {
          const match = song.url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
          return match && match[2].length === 11 ? match[2] : "";
        })
        .filter((id) => id);

      const playAllUrl = videoIds.length > 0
        ? `https://www.youtube.com/watch_videos?video_ids=${videoIds.join(",")}`
        : "";

      const playAllBtn = playAllUrl
        ? `<a href="${playAllUrl}" target="_blank" class="play-all-btn" title="Play all songs in this section sequentially"><span class="play-icon-small">▶</span> Play All</a>`
        : "";

      return `
        <div class="section-header">
          <div class="section-title-wrapper">
            <h2 id="${section.title.toLowerCase().replace(/\s+/g, '-')}">${section.title}</h2>
            <span class="playlist-length">${videoIds.length} songs</span>
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
        <h2 id="${section.title.toLowerCase().replace(/\s+/g, "-")}">${section.title}</h2>
        <div class="paper-grid">${paperCards.join("")}</div>
      `;
    });

    return renderedSections.join("");
  }
}
