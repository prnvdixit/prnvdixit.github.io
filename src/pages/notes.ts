import { AbstractView } from "../router";
import { NoteService, Note } from "../services/note";

export class NotesPage extends AbstractView {
  private noteService: NoteService;

  constructor(params: any) {
    super(params);
    this.noteService = NoteService.getInstance();
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
                    <span class="reading-time">${note.readingTime}</span>
                    <span class="publish-date">${note.publishDate}</span>
                    ${
                      note.githubLink
                        ? `<a href="${note.githubLink}" class="github-link" target="_blank" aria-label="View on GitHub"></a>`
                        : ""
                    }
                    ${
                      note.links && note.links.length > 0
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
                    ${note.tags
                      .map(
                        (tag) =>
                          `<a href="/tag/${tag}" class="tag" data-link>${tag}</a>`
                      )
                      .join("")}
                </div>
            </div>
        `;

    return card;
  }

  async render(): Promise<HTMLElement> {
    const element = document.createElement("div");
    element.classList.add("notes-page");

    await this.noteService.initialize();
    const notes = this.noteService.getAllNotes();

    element.innerHTML = `
            <div class="container">
                <h1>Notes</h1>
                <div class="notes-grid"></div>
                <button class="back-to-top" aria-label="Back to top">↑</button>
            </div>
        `;

    const notesGrid = element.querySelector(".notes-grid")!;
    notes.forEach((note) => {
      notesGrid.appendChild(this.createNoteCard(note));
    });

    // Add scroll event listener for back-to-top button
    const backToTopBtn = element.querySelector(
      ".back-to-top"
    ) as HTMLButtonElement;
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

    return element;
  }
}
