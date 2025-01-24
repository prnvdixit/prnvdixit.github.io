import { AbstractView } from "../router";
import { NoteService } from "../services/note";
import { MusicPlayerService, Track } from "../services/player";

async function fetchFromTMDB(
  title: string,
  year?: string,
  imdbID?: string,
  tmdbID?: string,
  existingDirector?: string
): Promise<{ title: string; year: string; director: string; poster: string } | null> {
  const apiKey = "a57d53117f589d584b9c37624f5ac500";
  let movieData: any = null;
  let isTV = false;

  try {
    // 1. If we have a tmdbID, fetch movie/tv details directly
    if (tmdbID) {
      const url = `https://api.themoviedb.org/3/movie/${tmdbID}?api_key=${apiKey}`;
      const res = await fetch(url);
      if (res.ok) {
        movieData = await res.json();
        isTV = false;
      } else {
        const tvUrl = `https://api.themoviedb.org/3/tv/${tmdbID}?api_key=${apiKey}`;
        const tvRes = await fetch(tvUrl);
        if (tvRes.ok) {
          movieData = await tvRes.json();
          isTV = true;
        }
      }
    }

    // 2. If no movieData yet but we have an imdbID, find it (tries movie then tv)
    if (!movieData && imdbID) {
      const url = `https://api.themoviedb.org/3/find/${imdbID}?api_key=${apiKey}&external_source=imdb_id`;
      const res = await fetch(url);
      if (res.ok) {
        const findData = await res.json();
        if (findData.movie_results && findData.movie_results.length > 0) {
          movieData = findData.movie_results[0];
          isTV = false;
        } else if (findData.tv_results && findData.tv_results.length > 0) {
          movieData = findData.tv_results[0];
          isTV = true;
        }
      }
    }

    // 3. If no movieData yet, search by title and year
    if (!movieData) {
      let url = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(title)}`;
      if (year && /^\d{4}$/.test(year)) {
        url += `&primary_release_year=${year}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const searchData = await res.json();
        if (searchData.results && searchData.results.length > 0) {
          movieData = searchData.results[0];
          isTV = false;
        }
      }

      if (!movieData) {
        let tvUrl = `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&query=${encodeURIComponent(title)}`;
        if (year && /^\d{4}$/.test(year)) {
          tvUrl += `&first_air_date_year=${year}`;
        }
        const tvRes = await fetch(tvUrl);
        if (tvRes.ok) {
          const searchData = await tvRes.json();
          if (searchData.results && searchData.results.length > 0) {
            movieData = searchData.results[0];
            isTV = true;
          }
        }
      }
    }

    // 4. If we found movieData, extract the fields and return details
    if (movieData) {
      const movieTitle = isTV
        ? (movieData.name || movieData.original_name || title)
        : (movieData.title || movieData.original_title || title);
      const releaseDate = isTV
        ? (movieData.first_air_date || "")
        : (movieData.release_date || "");
      const movieYear = releaseDate ? releaseDate.split("-")[0] : (year || "");
      const posterPath = movieData.poster_path;
      const poster = posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : "";

      // Just use the existing director or fallback to N/A
      const director = existingDirector && existingDirector !== "Unknown" ? existingDirector : "N/A";

      return {
        title: movieTitle,
        year: movieYear,
        director,
        poster
      };
    }
  } catch (error) {
    console.error("Error fetching from TMDB:", error);
  }

  return null;
}

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
                `<a href="/tag/${tag}" class="tag" data-link>${tag}</a>`,
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
                  `<a href="${link.url}" class="external-link" target="_blank" aria-label="${link.description}">🔗 ${link.description}</a>`,
              )
              .join("")
            : ""
          }
                        </div>
                    </div>
                    <div class="note-content">
                        ${(() => {
            const renderContent = async () => {
              const content = await this.noteService.fetchNoteContent(note);
              if (note.blogLink === "screens") return this.renderMovies(content);
              if (note.blogLink === "songs") return this.renderSongs(content);
              if (note.blogLink === "paper-shelf") return this.renderPaperShelf(content);
              if (note.blogLink === "books") return this.renderBooks(content);
              if (note.blogLink === "recipes") return this.noteService.renderRecipes(content);
              if (note.blogLink === "purpose") return this.noteService.renderBucketList(content);
              return this.noteService.parseMarkdown(content);
            };
            renderContent().then(html => {
              const nc = document.querySelector(".note-content") as HTMLElement;
              if (nc) {
                nc.innerHTML = html;
                this.setupTableOfContents(element);
                this.setupRecipeInteractivity(element);
                if (note.blogLink === "purpose") this.setupBucketListModals();
              }
            });
            return "<div class=\"loading-content\">Loading…</div>";
          })()
          }        </div>
                    <div class="note-navigation">
                        ${(() => {
            const adjacentNotes =
              this.noteService.getAdjacentNotes(note);
            return `
                            ${adjacentNotes.previous
                ? `
                              <a href="/${this.noteService.getUrlFromNote(
                  adjacentNotes.previous,
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
                  adjacentNotes.next,
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

        // Setup recipe interactivity
        this.setupRecipeInteractivity(element);

        // Initialize HTML Comment Box with proper error handling
        const script = document.createElement("script");
        script.type = "text/javascript";
        script.id = "hcb";
        const location = window.location.toString().replace(/'/g, "%27");
        script.src = `https://www.htmlcommentbox.com/jread?page=${encodeURIComponent(
          location,
        ).replace(
          "+",
          "%2B",
        )}&mod=%241%24wq1rdBcg%24KJMmEL71byVY1j2LJQUns0&opts=17310&num=10&ts=${Date.now()}`;

        // Add load and error event listeners
        script.onload = () => {
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
                  ".copy-link-btn",
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
    const headings: { level: number; text: string; id: string }[] = [];

    // First, get the note title from note-header-top
    const noteTitle = document.querySelector(".note-header-top h1");
    if (noteTitle) {
      const titleText = noteTitle.textContent || "";
      const titleId = titleText.toLowerCase().replace(/[^\w]+/g, "-");
      noteTitle.id = titleId;
      headings.push({ level: 1, text: titleText, id: titleId });
    }

    const content = document.querySelector(".note-content");
    if (!content) {
      return headings;
    }

    const headingElements = content.querySelectorAll("h1, h2, h3, h4, h5, h6");
    headingElements.forEach((heading) => {
      // Skip headings inside movie, song or recipe cards (except recipe titles)
      if (
        heading.closest(".movie-card") ||
        heading.closest(".song-card") ||
        (heading.closest(".recipe-card") && !heading.classList.contains("recipe-title"))
      ) {
        return;
      }
      const level = parseInt(heading.tagName[1]);
      const tempEl = heading.cloneNode(true) as HTMLElement;
      const existingAnchor = tempEl.querySelector(".heading-anchor");
      if (existingAnchor) {
        existingAnchor.remove();
      }
      const text = (tempEl.textContent || "").trim();
      const id = text.toLowerCase().replace(/[^\w]+/g, "-");
      heading.id = id;
      headings.push({ level, text, id });
      // Add a hoverable anchor link to allow copying the deep link
      if (!heading.querySelector(".heading-anchor") && !heading.closest(".bucket-card")) {
        const anchor = document.createElement("a");
        anchor.className = "heading-anchor";
        anchor.href = `#${id}`;
        anchor.innerHTML = "🔗";
        anchor.title = "Copy link to this section";
        anchor.addEventListener("click", (e) => {
          e.preventDefault();
          const url = `${window.location.origin}${window.location.pathname}#${id}`;
          navigator.clipboard.writeText(url).then(() => {
            const originalText = anchor.innerHTML;
            anchor.innerHTML = "✓";
            anchor.classList.add("copied");
            setTimeout(() => {
              anchor.innerHTML = originalText;
              anchor.classList.remove("copied");
            }, 2000);
          }).catch((err) => {
            console.error("Failed to copy link:", err);
          });
          history.pushState(null, "", `#${id}`);
          heading.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        heading.appendChild(anchor);
      }
    });

    // Add Comments section if HTMLCommentBox exists
    const commentBox = document.querySelector("#HCB_comment_box");
    if (commentBox) {
      headings.push({
        level: 1,
        text: "Comments",
        id: "HCB_comment_box",
      });
    }

    return headings;
  }

  private setupBucketListModals(): void {
    // Move all bucket modals to body for proper stacking
    document.querySelectorAll(".bucket-modal").forEach((modal) => {
      document.body.appendChild(modal);
    });

    document.querySelectorAll(".bucket-card").forEach((card) => {
      card.addEventListener("click", () => {
        const bucketId = (card as HTMLElement).dataset.bucketId;
        if (bucketId) {
          const modal = document.getElementById(bucketId);
          if (modal) {
            modal.classList.add("active");
            document.body.style.overflow = "hidden";
          }
        }
      });
    });

    document.querySelectorAll(".bucket-modal").forEach((modal) => {
      const closeModal = () => {
        modal.classList.remove("active");
        document.body.style.overflow = "";
      };
      modal.querySelector(".bucket-modal-backdrop")?.addEventListener("click", closeModal);
      modal.querySelector(".bucket-modal-close")?.addEventListener("click", closeModal);
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal.classList.contains("active")) closeModal();
      });
    });
  }

  private setupRecipeInteractivity(element: HTMLElement): void {
    const ingredients = element.querySelectorAll(".recipe-ingredients li");
    ingredients.forEach((ing) => {
      ing.addEventListener("click", () => {
        ing.classList.toggle("checked");
      });
    });

    const steps = element.querySelectorAll(".recipe-step");
    steps.forEach((step) => {
      const stepNum = step.querySelector(".step-num");
      if (stepNum) {
        stepNum.addEventListener("click", (e) => {
          e.stopPropagation();
          step.classList.toggle("checked");
        });
      }
    });
  }

  private createTableOfContents(
    headings: { level: number; text: string; id: string }[],
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
    // Wait for a short time to ensure content is rendered
    setTimeout(() => {
      const headings = this.extractHeadings();
      if (headings.length === 0) {
        return;
      }

      const toc = this.createTableOfContents(headings);
      const container = element.querySelector(".container.with-toc");
      if (!container) {
        return;
      }

      // Remove any existing TOC first to prevent duplicates
      const existingTocs = container.querySelectorAll(".table-of-contents");
      existingTocs.forEach((t) => t.remove());

      // Insert TOC after the back-to-notes links but before note-content
      const noteContent = container.querySelector("#note-content");
      if (noteContent) {
        container.insertBefore(toc, noteContent);
      } else {
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
              history.pushState(null, "", `#${href}`);
              target.scrollIntoView({ behavior: "smooth", block: "start" });
            });
          }
        }
      });

      // Track which heading is currently active using a robust scroll-based approach.
      // We maintain a map of each heading's position relative to the viewport and
      // pick the last heading that has passed the top of the visible area.
      const headingEls: HTMLElement[] = [];
      headings.forEach(({ id }) => {
        const el = document.getElementById(id);
        if (el && (el.tagName.match(/^H[1-6]$/) || id === "HCB_comment_box")) {
          headingEls.push(el);
        }
      });

      let activeLinkHref = "";

      const updateActiveLink = () => {
        const isMobile = window.innerWidth <= 768;
        if (isMobile) return;

        const scrollY = window.scrollY;
        const offset = 120; // px below the top to treat as "in view"

        // Find the last heading whose top is above the offset line
        let activeId = headingEls.length > 0 ? headingEls[0].id : "";
        for (const el of headingEls) {
          const top = el.getBoundingClientRect().top + scrollY;
          if (top - scrollY <= offset) {
            activeId = el.id;
          }
        }

        if (activeId !== activeLinkHref) {
          activeLinkHref = activeId;
          toc.querySelectorAll(".toc-link").forEach((link) => {
            const href = (link as HTMLAnchorElement).getAttribute("href")?.slice(1);
            if (href === activeId) {
              link.classList.add("active");
              // Scroll the TOC so the active link is visible
              const linkRect = link.getBoundingClientRect();
              const tocRect = toc.getBoundingClientRect();
              if (linkRect.bottom > tocRect.bottom) {
                toc.scrollTo({ top: toc.scrollTop + (linkRect.bottom - tocRect.bottom) + 20, behavior: "smooth" });
              } else if (linkRect.top < tocRect.top) {
                toc.scrollTo({ top: toc.scrollTop - (tocRect.top - linkRect.top) - 20, behavior: "smooth" });
              }
            } else {
              link.classList.remove("active");
            }
          });
        }
      };

      window.addEventListener("scroll", updateActiveLink, { passive: true });
      // Run once on setup to highlight the correct item on initial load
      updateActiveLink();

      // If there's a hash in the URL, scroll to the corresponding heading after layout renders
      const hash = window.location.hash;
      if (hash) {
        const id = decodeURIComponent(hash.slice(1));
        const target = document.getElementById(id);
        if (target) {
          setTimeout(() => {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 100);
        }
      }
    }, 100);
  }

  private setupScrollListeners(element: HTMLElement): void {
    const backToTopBtn = element.querySelector(
      ".back-to-top",
    ) as HTMLButtonElement;
    const floatingBackLink = element.querySelector(
      ".back-to-notes.floating",
    ) as HTMLAnchorElement;
    const originalBackLink = element.querySelector(
      ".back-to-notes:not(.floating)",
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
    const sections: any[] = [];
    let currentSection: any = null;
    let currentMovie: {
      title: string;
      year?: string;
      imdbID?: string;
      tmdbID?: string;
      reviewLines: string[];
      isSeen?: boolean;
      inTheatre?: boolean;
    } | null = null;

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
            tmdbID: currentMovie.tmdbID,
            review: currentMovie.reviewLines.join("\n"),
            isSeen: currentMovie.isSeen,
            inTheatre: currentMovie.inTheatre,
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
            tmdbID: currentMovie.tmdbID,
            review: currentMovie.reviewLines.join("\n"),
            isSeen: currentMovie.isSeen,
            inTheatre: currentMovie.inTheatre,
          });
        }
        // Parse new movie line
        const match = trimmedLine.match(
          /^(?:\[([^\]]+)\]\s*|([✓✔])\s*)?(.+?)\s\((tt\d+|tmdb\d+|\d{4})\)(?:\s*\[([^\]]+)\])?$/,
        );
        if (match) {
          const prefixFlags = (match[1] || match[2] || "").toLowerCase();
          const suffixFlags = (match[5] || "").toLowerCase();
          const combinedFlags = prefixFlags + " " + suffixFlags;
          const isSeen = /x|v|✓|✔|t/.test(combinedFlags);
          const inTheatre = /t/.test(combinedFlags);
          const isImdbId = match[4].startsWith("tt");
          const isTmdbId = match[4].startsWith("tmdb");
          currentMovie = {
            title: match[3].trim(),
            year: !isImdbId && !isTmdbId ? match[4] : undefined,
            imdbID: isImdbId ? match[4] : undefined,
            tmdbID: isTmdbId ? match[4].replace("tmdb", "") : undefined,
            reviewLines: [],
            isSeen,
            inTheatre,
          };
        } else {
          currentMovie = null;
        }
      }
    });

    // Don't forget the last movie and section
    const finalMovie = currentMovie as {
      title: string;
      year?: string;
      imdbID?: string;
      tmdbID?: string;
      reviewLines: string[];
      isSeen?: boolean;
      inTheatre?: boolean;
    } | null;
    const finalSection = currentSection as {
      title: string;
      movies: any[];
    } | null;
    if (finalMovie && finalSection) {
      finalSection.movies.push({
        title: finalMovie.title,
        year: finalMovie.year,
        imdbID: finalMovie.imdbID,
        tmdbID: finalMovie.tmdbID,
        review: finalMovie.reviewLines.join("\n"),
        isSeen: finalMovie.isSeen,
        inTheatre: finalMovie.inTheatre,
      });
    }
    if (finalSection && !sections.includes(finalSection)) {
      sections.push(finalSection);
    }

    // --- Instant render: show cards immediately, enrich with OMDB in background ---
    const renderedSections = sections.map((section) => {
      const movieItems = section.movies.map((movie: any, index: number) => {
        const movieId = `movie-${section.title.replace(/\s+/g, "-")}-${index}`;
        const hasReview = movie.review && movie.review.trim() !== "";
        const seenInd =
          movie.isSeen && !movie.inTheatre
            ? '<span class="seen-indicator" title="Viewed">✓ Watched</span>'
            : "";
        const theatreInd = movie.inTheatre
          ? '<span class="theatre-indicator" title="Watched in Theatre">🍿✓ Theatre</span>'
          : "";
        const reviewInd = hasReview
          ? '<span class="review-indicator" title="Click to see my review">\u270d\ufe0f</span>'
          : "";

        // Cache key: prefer imdbID for stable lookup
        const cacheKey = movie.imdbID
          ? `movie_imdb_${movie.imdbID}`
          : `movie_title_${movie.title}_${movie.year}`;
        const cached = localStorage.getItem(cacheKey);
        let cd = cached ? JSON.parse(cached) : null;
        if (cd && (!cd.poster || cd.poster === "N/A")) {
          cd = null;
        }

        const displayTitle = cd
          ? `${cd.title} (${cd.year})`
          : `${movie.title}${movie.year ? ` (${movie.year})` : ""}`;
        const displayDir = cd ? cd.director : "Loading\u2026";
        const displayPoster = cd ? cd.poster : "";

        const card = `
          <div class="movie-card ${hasReview ? "has-review" : ""}" id="card-${movieId}" ${hasReview ? `data-movie-id="${movieId}"` : ""}>
            ${reviewInd}
            <div class="movie-indicators">${seenInd}${theatreInd}</div>
            <img src="${displayPoster}" alt="${movie.title} Poster" class="movie-poster">
            <div class="movie-info">
              <h3 id="title-${movieId}">${displayTitle}</h3>
              <p><strong>Director:</strong> <span id="dir-${movieId}">${displayDir}</span></p>
            </div>
          </div>
        `;
        const modal = hasReview
          ? `
          <div class="movie-review-modal" id="${movieId}">
            <div class="modal-backdrop"></div>
            <div class="modal-content">
              <button class="modal-close">&times;</button>
              <img src="${displayPoster}" alt="${movie.title} Poster" class="modal-poster" id="modal-poster-${movieId}">
              <div class="modal-info">
                <h2 id="modal-title-${movieId}">${displayTitle}</h2>
                <p class="modal-meta"><strong>Director:</strong> <span id="modal-dir-${movieId}">${displayDir}</span></p>
                <div class="modal-review">
                  <h3>Notes</h3>
                  <p>${movie.review.replace(/\n/g, "<br>")}</p>
                </div>
              </div>
            </div>
          </div>
        `
          : "";
        return { card, modal, movie, movieId, hasCached: !!cd };
      });

      const cardsHtml = movieItems.map((m: any) => m.card).join("");
      const modalsHtml = movieItems.map((m: any) => m.modal).join("");

      // Background OMDB fetch for uncached movies only
      setTimeout(() => {
        movieItems.forEach(
          ({
            movie,
            movieId,
            hasCached,
          }: {
            movie: any;
            movieId: string;
            hasCached: boolean;
          }) => {
            if (hasCached) return;
            const cacheKey = movie.imdbID
              ? `movie_imdb_${movie.imdbID}`
              : `movie_title_${movie.title}_${movie.year}`;

            const updateMovieUI = (
              title: string,
              year: string,
              director: string,
              poster: string
            ) => {
              // Update card
              const titleEl = document.getElementById(`title-${movieId}`);
              if (titleEl) titleEl.textContent = `${title} (${year})`;
              const dirEl = document.getElementById(`dir-${movieId}`);
              if (dirEl) dirEl.textContent = director;
              const imgEl = document.querySelector(
                `#card-${movieId} .movie-poster`
              ) as HTMLImageElement;
              if (imgEl && poster) imgEl.src = poster;
              // Update modal
              const mTitle = document.getElementById(`modal-title-${movieId}`);
              if (mTitle) mTitle.textContent = `${title} (${year})`;
              const mDir = document.getElementById(`modal-dir-${movieId}`);
              if (mDir) mDir.textContent = director;
              const mImg = document.getElementById(
                `modal-poster-${movieId}`
              ) as HTMLImageElement;
              if (mImg && poster) mImg.src = poster;
              // Cache result
              localStorage.setItem(
                cacheKey,
                JSON.stringify({ title, year, director, poster })
              );
            };

            const omdbUrl = movie.imdbID
              ? `https://www.omdbapi.com/?i=${movie.imdbID}&apikey=f94f300b`
              : `https://www.omdbapi.com/?t=${encodeURIComponent(movie.title)}&y=${movie.year}&apikey=f94f300b`;

            fetch(omdbUrl)
              .then((r: Response) => r.json())
              .then((data: any) => {
                if (data.Response === "True" && data.Poster && data.Poster !== "N/A") {
                  const title = data.Title || movie.title;
                  const year = data.Year || movie.year;
                  const director = data.Director || "Unknown";
                  const poster = data.Poster;
                  updateMovieUI(title, year, director, poster);
                } else {
                  // Fallback to TMDB because OMDB failed or poster isn't available
                  fetchFromTMDB(movie.title, movie.year, movie.imdbID, movie.tmdbID, data.Director || "Unknown")
                    .then((tmdbData) => {
                      if (tmdbData) {
                        const title = tmdbData.title || (data.Response === "True" ? data.Title : movie.title);
                        const year = tmdbData.year || (data.Response === "True" ? data.Year : movie.year);
                        const director = tmdbData.director !== "Unknown" ? tmdbData.director : (data.Response === "True" && data.Director ? data.Director : "Unknown");
                        const poster = tmdbData.poster || (data.Response === "True" && data.Poster !== "N/A" ? data.Poster : "");
                        updateMovieUI(title, year, director, poster);
                      } else if (data.Response === "True") {
                        // fallback to OMDB even if no poster
                        updateMovieUI(data.Title || movie.title, data.Year || movie.year, data.Director || "Unknown", "");
                      } else {
                        const dirEl = document.getElementById(`dir-${movieId}`);
                        if (dirEl) dirEl.textContent = "Unknown";
                      }
                    });
                }
              })
              .catch(() => {
                // OMDB failed to fetch, fallback to TMDB
                fetchFromTMDB(movie.title, movie.year, movie.imdbID, movie.tmdbID)
                  .then((tmdbData) => {
                    if (tmdbData) {
                      updateMovieUI(tmdbData.title, tmdbData.year, tmdbData.director, tmdbData.poster);
                    } else {
                      const dirEl = document.getElementById(`dir-${movieId}`);
                      if (dirEl) dirEl.textContent = "Unknown";
                    }
                  });
              });
          },
        );
      }, 0);

      return `
        <h2 id="${section.title.toLowerCase().replace(/\s+/g, "-")}">${section.title}</h2>
        <div class="movie-grid">${cardsHtml}</div>
        ${modalsHtml}
      `;
    });

    // Add event listener setup for modals
    setTimeout(() => {
      // Move all modals to body for proper positioning
      document.querySelectorAll(".movie-review-modal").forEach((modal) => {
        document.body.appendChild(modal);
      });

      document.querySelectorAll(".movie-card.has-review").forEach((card) => {
        card.addEventListener("click", (e) => {
          e.stopPropagation();
          const movieId = card.getAttribute("data-movie-id");
          if (movieId) {
            const modal = document.getElementById(movieId);
            if (modal) {
              modal.classList.add("active");
              document.body.style.overflow = "hidden";
            }
          }
        });
      });

      document.querySelectorAll(".movie-review-modal").forEach((modal) => {
        const closeModal = () => {
          modal.classList.remove("active");
          document.body.style.overflow = "";
        };

        modal
          .querySelector(".modal-backdrop")
          ?.addEventListener("click", closeModal);
        modal
          .querySelector(".modal-close")
          ?.addEventListener("click", closeModal);

        // Close on Escape key
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape" && modal.classList.contains("active")) {
            closeModal();
          }
        });
      });
    }, 100);

    return renderedSections.join("");
  }

  private renderSongs(content: string): Promise<string> {
    const lines = content.split("\n").filter((line) => line.trim() !== "");
    const sections: {
      title: string;
      songs: { title: string; artist: string; url: string; videoId: string }[];
    }[] = [];
    let currentSection: {
      title: string;
      songs: { title: string; artist: string; url: string; videoId: string }[];
    } | null = null;

    lines.forEach((line) => {
      if (line.startsWith("## ")) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = { title: line.replace("## ", "").trim(), songs: [] };
      } else if (currentSection) {
        const parts = line.split("|").map((p) => p.trim());
        let title = "",
          artist = "",
          url = "";
        if (parts.length === 3) {
          title = parts[0];
          artist = parts[1];
          url = parts[2];
        } else if (parts.length === 2) {
          title = parts[0];
          artist = "";
          url = parts[1];
        } else {
          title = "";
          artist = "";
          url = line.trim();
        }

        const match = url.match(
          /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/,
        );
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
          <div class="song-list-item" data-video-id="${song.videoId}" data-title="${song.title.replace(/"/g, "&quot;")}" data-artist="${song.artist.replace(/"/g, "&quot;")}" data-section-index="${sIndex}" data-song-index="${index}">
            <div class="sl-col-index">
              <span class="track-number">${index + 1}</span>
              <span class="play-icon-hover">▶</span>
            </div>
            <div class="sl-col-title" data-title="${song.title.replace(/"/g, "&quot;")}" data-artist="${song.artist.replace(/"/g, "&quot;")}">${song.title}</div>
            <div class="sl-col-artist">${song.artist || "Unknown Artist"}</div>
          </div>
        `;
      });

      const playAllBtn =
        section.songs.length > 0
          ? `<button class="play-all-btn" data-section-index="${sIndex}"><span class="play-icon-small">▶</span> Play All</button>`
          : "";

      return `
        <div class="section-header">
          <div class="section-title-wrapper">
            <h2 id="${section.title.toLowerCase().replace(/\s+/g, "-")}">${section.title}</h2>
            <span class="playlist-length">${section.songs.length} songs</span>
          </div>
          ${playAllBtn}
        </div>
        <div class="song-list" data-section-index="${sIndex}">
          <div class="song-list-header-row">
            <div class="sl-col-index">#</div>
            <div class="sl-col-title">Title</div>
            <div class="sl-col-artist">Artist</div>
          </div>
          ${songListItems.join("")}
        </div>
      `;
    });

    // Add event listeners for songs
    setTimeout(() => {
      const player = MusicPlayerService.getInstance();

      // Handle "Play All"
      document.querySelectorAll(".play-all-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const sIndex = parseInt(
            btn.getAttribute("data-section-index") || "0",
          );
          const sectionTracks: Track[] = sections[sIndex].songs.map((s) => ({
            title: s.title,
            artist: s.artist,
            videoId: s.videoId,
          }));
          // Fisher-Yates shuffle
          for (let i = sectionTracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [sectionTracks[i], sectionTracks[j]] = [sectionTracks[j], sectionTracks[i]];
          }
          player.playQueue(sectionTracks, 0);
        });
      });

      // Handle individual songs
      document.querySelectorAll(".song-list-item").forEach((item) => {
        item.addEventListener("click", () => {
          const sIndex = parseInt(
            item.getAttribute("data-section-index") || "0",
          );
          const songIndex = parseInt(
            item.getAttribute("data-song-index") || "0",
          );
          const sectionTracks: Track[] = sections[sIndex].songs.map((s) => ({
            title: s.title,
            artist: s.artist,
            videoId: s.videoId,
          }));
          player.playQueue(sectionTracks, songIndex);
        });
      });
    }, 100);

    return Promise.resolve(renderedSections.join(""));
  }

  private async renderPaperShelf(content: string): Promise<string> {
    const lines = content.split("\n").filter((line) => line.trim() !== "");
    const sections: {
      title: string;
      papers: { title: string; url: string; summary: string }[];
    }[] = [];
    let currentSection: {
      title: string;
      papers: { title: string; url: string; summary: string }[];
    } | null = null;

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

  private async renderBooks(content: string): Promise<string> {
    const lines = content.split("\n");
    const sections: any[] = [];
    let currentSection: any = null;
    let currentBook: any = null;

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (trimmedLine === "") return;

      if (line.startsWith("## ")) {
        if (currentBook && currentSection) {
          currentSection.books.push({
            title: currentBook.title,
            review: currentBook.reviewLines.join("\n"),
            isRead: currentBook.isRead,
          });
          currentBook = null;
        }
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = { title: line.replace("## ", "").trim(), books: [] };
      } else if (trimmedLine.startsWith(">")) {
        if (currentBook) {
          currentBook.reviewLines.push(trimmedLine.substring(1).trim());
        }
      } else if (currentSection) {
        if (currentBook) {
          currentSection.books.push({
            title: currentBook.title,
            isbn: currentBook.isbn,
            review: currentBook.reviewLines.join("\n"),
            isRead: currentBook.isRead,
          });
        }
        const match = trimmedLine.match(/^(?:\[([ xX✓✔])\]\s*)?(.+)$/);
        if (match) {
          const isRead = match[1] && match[1].trim() !== "";
          let rawTitle = match[2].trim();
          // Extract ISBN in parentheses if present
          let isbn = null;
          const isbnMatch = rawTitle.match(/\(([\d-]+)\)$/);
          if (isbnMatch) {
            isbn = isbnMatch[1].replace(/-/g, "");
            if (isbn.length < 10 || isbn.length > 13) {
              isbn = null; // Reset if not a valid ISBN length after normalization
            } else {
              rawTitle = rawTitle.replace(isbnMatch[0], "").trim();
            }
          }
          currentBook = {
            title: rawTitle,
            isbn: isbn,
            reviewLines: [],
            isRead: !!isRead,
          };
        } else {
          currentBook = null;
        }
      }
    });

    if (currentBook && currentSection) {
      currentSection.books.push({
        title: currentBook.title,
        isbn: currentBook.isbn,
        review: currentBook.reviewLines.join("\n"),
        isRead: currentBook.isRead,
      });
    }
    if (currentSection && !sections.includes(currentSection)) {
      sections.push(currentSection);
    }

    // --- Instant render: build HTML immediately from markdown data (no API wait) ---
    const renderedSections = sections.map((section) => {
      const cards = section.books.map((book: any, bookIndex: number) => {
        const bookId = `book-${section.title.replace(/\s+/g, "-")}-${bookIndex}`;
        const hasReview = book.review && book.review.trim() !== "";
        const reviewClass = hasReview ? "has-review" : "";
        const reviewAttr = hasReview ? `data-movie-id="${bookId}"` : "";
        const reviewIndicator = hasReview
          ? '<span class="review-indicator" title="Click to see my review">\u270d\ufe0f</span>'
          : "";
        const readIndicator = book.isRead
          ? '<span class="seen-indicator" title="Read">✓ Read</span>'
          : "";
        // Use ISBN cover directly — no API call needed
        const poster = book.isbn
          ? `https://covers.openlibrary.org/b/isbn/${book.isbn}-M.jpg`
          : "";
        const authorHtml = `<span class="book-author-text" id="author-${bookId}">Loading…</span>`;
        const card = `
          <div class="movie-card ${reviewClass}" ${reviewAttr} data-book-id="${bookId}">
            ${reviewIndicator}
            <div class="movie-indicators">${readIndicator}</div>
            <img src="${poster}" alt="${book.title} Cover" class="movie-poster" style="object-fit: cover;">
            <div class="movie-info">
              <h3 class="book-title" data-book-id="${bookId}">${book.title}</h3>
              <p><strong>Author:</strong> ${authorHtml}</p>
            </div>
          </div>
        `;
        const modal = hasReview
          ? `
          <div class="movie-review-modal" id="${bookId}">
            <div class="modal-backdrop"></div>
            <div class="modal-content">
              <button class="modal-close">&times;</button>
              <img src="${poster}" alt="${book.title} Cover" class="modal-poster" style="object-fit: cover;">
              <div class="modal-info">
                <h2>${book.title}</h2>
                <p class="modal-meta"><strong>Author:</strong> <span id="modal-author-${bookId}">Loading…</span></p>
                <div class="modal-review">
                  <h3>Notes</h3>
                  <p>${book.review.replace(/\n/g, "<br>")}</p>
                </div>
              </div>
            </div>
          </div>
        `
          : "";
        return { card, modal, book, bookId };
      });

      const cardsHtml = cards.map((c: any) => c.card).join("");
      const modalsHtml = cards.map((c: any) => c.modal).join("");

      // Background enrichment: fetch author info after render
      setTimeout(() => {
        cards.forEach(({ book, bookId }: { book: any; bookId: string }) => {
          const cacheKey = book.isbn
            ? `book_isbn_${book.isbn}`
            : `book_title_${book.title}`;
          const cached = localStorage.getItem(cacheKey);
          const applyAuthor = (author: string) => {
            const el = document.getElementById(`author-${bookId}`);
            if (el) el.textContent = author;
            const mel = document.getElementById(`modal-author-${bookId}`);
            if (mel) mel.textContent = author;
          };
          if (cached) {
            const info = JSON.parse(cached);
            applyAuthor(info.authors || "Unknown");
          } else {
            const url = book.isbn
              ? `https://openlibrary.org/search.json?isbn=${book.isbn}`
              : `https://openlibrary.org/search.json?q=intitle:${encodeURIComponent(book.title)}`;
            fetch(url)
              .then((r) => r.json())
              .then((data) => {
                if (data.docs && data.docs.length > 0) {
                  const info = data.docs[0];
                  const authors = info.author_name
                    ? info.author_name.join(", ")
                    : "Unknown";
                  const poster = book.isbn
                    ? `https://covers.openlibrary.org/b/isbn/${book.isbn}-M.jpg`
                    : info.cover_i
                      ? `https://covers.openlibrary.org/b/id/${info.cover_i}-M.jpg`
                      : "";
                  applyAuthor(authors);
                  localStorage.setItem(
                    cacheKey,
                    JSON.stringify({
                      title: info.title || book.title,
                      authors,
                      description: "",
                      poster,
                    }),
                  );
                } else {
                  applyAuthor("Unknown");
                }
              })
              .catch(() => applyAuthor("Unknown"));
          }
        });
      }, 0);

      return `
        <h2 id="${section.title.toLowerCase().replace(/\s+/g, "-")}">${section.title}</h2>
        <div class="movie-grid">${cardsHtml}</div>
        ${modalsHtml}
      `;
    });

    // Add event listener setup for modals
    setTimeout(() => {
      // Move all modals to body for proper positioning
      document.querySelectorAll(".movie-review-modal").forEach((modal) => {
        document.body.appendChild(modal);
      });

      document.querySelectorAll(".movie-card.has-review").forEach((card) => {
        card.addEventListener("click", (e) => {
          e.stopPropagation();
          const movieId = card.getAttribute("data-movie-id");
          if (movieId) {
            const modal = document.getElementById(movieId);
            if (modal) {
              modal.classList.add("active");
              document.body.style.overflow = "hidden";
            }
          }
        });
      });
      // Click on book title to open its comments modal
      document.querySelectorAll(".book-title").forEach((titleEl) => {
        titleEl.addEventListener("click", (e) => {
          e.stopPropagation();
          const bookId = (titleEl as HTMLElement).dataset.bookId;
          if (bookId) {
            const modal = document.getElementById(bookId);
            if (modal) {
              modal.classList.add("active");
              document.body.style.overflow = "hidden";
            }
          }
        });
      });
      document.querySelectorAll(".movie-review-modal").forEach((modal) => {
        const closeModal = () => {
          modal.classList.remove("active");
          document.body.style.overflow = "";
        };

        modal
          .querySelector(".modal-backdrop")
          ?.addEventListener("click", closeModal);
        modal
          .querySelector(".modal-close")
          ?.addEventListener("click", closeModal);

        // Close on Escape key
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape" && modal.classList.contains("active")) {
            closeModal();
          }
        });
      });
    }, 100);

    return renderedSections.join("");
  }
}
