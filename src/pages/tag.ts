import { AbstractView } from "../router";
import { NoteService, Note } from "../services/note";
import { TagCloud } from "../components/tagcloud";

export class TagPage extends AbstractView {
  private noteService: NoteService;
  private selectedTags: string[];

  constructor(params: any) {
    super(params);
    this.noteService = NoteService.getInstance();
    this.selectedTags = params.tag ? params.tag.split("+") : [];
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
                          `<span class="tag ${
                            this.selectedTags.includes(tag) ? "active" : ""
                          }" data-tag="${tag}">${tag}</span>`
                      )
                      .join("")}
                </div>
            </div>
        `;

    return card;
  }

  async render(): Promise<HTMLElement> {
    const element = document.createElement("div");
    element.classList.add("tag-page");

    const notes = await this.noteService.getNotesByTags(this.selectedTags);

    element.innerHTML = `
            <div class="container">
                <a href="/notes" class="back-to-notes floating ${
                  this.selectedTags.length > 0 ? "visible" : ""
                }" data-link>← Back to all notes</a>
                <h1>Notes tagged with ${this.selectedTags
                  .map((tag) => `"${tag}"`)
                  .join(" + ")}</h1>
                <div class="tag-cloud-container">
                  <div class="loading">Loading tags...</div>
                </div>
                <div class="notes-grid"></div>
                <button class="back-to-top" aria-label="Back to top">↑</button>
            </div>
        `;

    const notesGrid = element.querySelector(".notes-grid")!;
    notes.forEach((note) => {
      const noteCard = this.createNoteCard(note);
      const tagElements = noteCard.querySelectorAll(".tag");

      tagElements.forEach((tagElement) => {
        tagElement.addEventListener("click", (e) => {
          e.preventDefault();
          const tag = tagElement.getAttribute("data-tag")!;

          if (this.selectedTags.includes(tag)) {
            this.selectedTags = this.selectedTags.filter((t) => t !== tag);
          } else {
            this.selectedTags.push(tag);
          }

          // Update back-to-notes button visibility
          const backButton = document.querySelector(".back-to-notes");
          if (backButton) {
            if (this.selectedTags.length > 0) {
              backButton.classList.add("visible");
            } else {
              backButton.classList.remove("visible");
            }
          }

          const newUrl =
            this.selectedTags.length > 0
              ? `/tag/${this.selectedTags.join("+")}`
              : "/notes";

          history.pushState(null, "", newUrl);
          this.render().then((newElement) => {
            element.replaceWith(newElement);
          });
        });
      });

      notesGrid.appendChild(noteCard);
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
