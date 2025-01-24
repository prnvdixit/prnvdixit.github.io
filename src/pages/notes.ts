import { AbstractView } from "../router";
import { NoteService, Note } from "../services/note";
import { TagCloud } from "../components/tagcloud";

export class NotesPage extends AbstractView {
  private noteService: NoteService;

  constructor(params: any) {
    super(params);
    this.noteService = NoteService.getInstance();
  }

  private createPinnedNoteCard(note: Note): HTMLElement {
    const card = this.createNoteCard(note);
    card.classList.add("pinned-note");

    // Add pin icon to the card
    const pinIcon = document.createElement("span");
    pinIcon.classList.add("pin-icon");
    pinIcon.textContent = "📌";
    card.insertBefore(pinIcon, card.firstChild);

    return card;
  }

  private createNoteCard(note: Note): HTMLElement {
    const card = document.createElement("div");
    card.classList.add("note-card");

    card.innerHTML = `
      <h2><a href="/${this.noteService.getUrlFromNote(
      note
    )}" class="note-link" data-link>${note.title}</a></h2>
      <div class="note-meta">
        <div class="meta-top">
          <span class="reading-time">⌛ ${note.readingTime}</span>
          <span class="publish-date">🗓️ ${note.publishDate}</span>
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
        <div class="note-tags">
          ${(note.tags || [])
        .map(
          (tag) => `<a href="/tag/${tag}" class="tag" data-link>${tag}</a>`
        )
        .join("")}
        </div>
      </div>
    `;

    return card;
  }

  private setupCarousel(container: HTMLElement, notes: Note[]): void {
    let currentIndex = 0;
    const totalNotes = notes.length;

    const updateCarousel = () => {
      const offset = -currentIndex * 100;
      const notesContainer = container.querySelector(
        ".pinned-notes-container"
      ) as HTMLElement;
      if (notesContainer) {
        notesContainer.style.transform = `translateX(${offset}%)`;
      }

      // Update active dot
      const dots = container.querySelectorAll(".carousel-dot");
      dots.forEach((dot, index) => {
        if (index === currentIndex) {
          dot.classList.add("active");
        } else {
          dot.classList.remove("active");
        }
      });
    };

    const nextSlide = () => {
      currentIndex = (currentIndex + 1) % totalNotes;
      updateCarousel();
    };

    const prevSlide = () => {
      currentIndex = (currentIndex - 1 + totalNotes) % totalNotes;
      updateCarousel();
    };

    // Create carousel structure
    container.innerHTML = `
      <div class="carousel-container">
        <button class="carousel-arrow prev" aria-label="Previous note">❮</button>
        <div class="pinned-notes-viewport">
          <div class="pinned-notes-container">
            ${notes
        .map((note) => this.createPinnedNoteCard(note).outerHTML)
        .join("")}
          </div>
        </div>
        <button class="carousel-arrow next" aria-label="Next note">❯</button>
        <div class="carousel-dots">
          ${notes
        .map(
          (_, i) =>
            `<button class="carousel-dot${i === 0 ? " active" : ""
            }" aria-label="Go to note ${i + 1}"></button>`
        )
        .join("")}
        </div>
      </div>
    `;

    // Add event listeners
    const prevButton = container.querySelector(".carousel-arrow.prev");
    const nextButton = container.querySelector(".carousel-arrow.next");
    const dots = container.querySelectorAll(".carousel-dot");

    prevButton?.addEventListener("click", prevSlide);
    nextButton?.addEventListener("click", nextSlide);

    dots.forEach((dot, index) => {
      dot.addEventListener("click", () => {
        currentIndex = index;
        updateCarousel();
      });
    });

    // Auto-scroll functionality
    let autoScrollInterval: number | null = null;
    const startAutoScroll = () => {
      if (!autoScrollInterval) {
        autoScrollInterval = window.setInterval(nextSlide, 5000);
      }
    };

    const stopAutoScroll = () => {
      if (autoScrollInterval) {
        clearInterval(autoScrollInterval);
        autoScrollInterval = null;
      }
    };

    const carouselContainer = container.querySelector(
      ".carousel-container"
    ) as HTMLElement;
    carouselContainer?.addEventListener("mouseenter", stopAutoScroll);
    carouselContainer?.addEventListener("mouseleave", startAutoScroll);

    // Start auto-scroll
    startAutoScroll();
  }

  async render(): Promise<HTMLElement> {
    const element = document.createElement("div");
    element.classList.add("notes-page");

    await this.noteService.initialize();
    // Fetch all notes, including hidden ones, to check for pinned hidden notes
    const allNotes = this.noteService.getAllNotes(true);
    const pinnedNotes = allNotes.filter((note) => note.pinned);
    // For the main grid, we only want visible notes (unless they are pinned? No, usually grid is just visible ones)
    // Actually, if a note is pinned but hidden, it should appear in pinned carousel but NOT in the main grid.
    const gridNotes = allNotes.filter((note) => !note.hidden);

    element.innerHTML = `
      <div class="container">
        <h1>Notes</h1>
        <div class="tag-cloud-container">
          <div class="loading">Loading tags...</div>
        </div>
        ${pinnedNotes.length > 0 ? '<div class="pinned-notes-bar"></div>' : ""}
        <div class="notes-grid"></div>
        <button class="back-to-top" aria-label="Back to top">↑</button>
      </div>
    `;

    // Setup carousel for pinned notes
    const pinnedNotesBar = element.querySelector(
      ".pinned-notes-bar"
    ) as HTMLElement;
    if (pinnedNotesBar && pinnedNotes.length > 0) {
      this.setupCarousel(pinnedNotesBar, pinnedNotes);
    }

    // Add visible notes to the grid
    const notesGrid = element.querySelector(".notes-grid")!;
    gridNotes.forEach((note) => {
      notesGrid.appendChild(this.createNoteCard(note));
    });

    // Add scroll event listener for back-to-top button
    const backToTopBtn = element.querySelector(
      ".back-to-top"
    ) as HTMLButtonElement;
    if (backToTopBtn && backToTopBtn.checkVisibility()) {
      window.addEventListener("scroll", () => {
        if (window.scrollY > 300) {
          backToTopBtn.classList.add("visible");
        } else {
          backToTopBtn.classList.remove("visible");
        }
      });
      backToTopBtn.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    // Setup tag cloud asynchronously after main content is rendered
    setTimeout(async () => {
      try {
        const cloudContainer = element.querySelector(
          ".tag-cloud-container"
        ) as HTMLElement;
        if (cloudContainer && cloudContainer.checkVisibility()) {
          const tagFrequencies = await this.noteService.getTagFrequencies();
          const tagCloud = new TagCloud(
            cloudContainer,
            cloudContainer.clientWidth,
            200,
            (tag: string) => {
              window.location.href = `/tag/${tag}`;
            }
          );
          await tagCloud.render(tagFrequencies);
        }
      } catch (error) {
        console.error("Error setting up tag cloud:", error);
        const cloudContainer = element.querySelector(".tag-cloud-container");
        if (cloudContainer) {
          cloudContainer.innerHTML =
            '<div class="error">Failed to load tags</div>';
        }
      }
    }, 0);

    return element;
  }
}
