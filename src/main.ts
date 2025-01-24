import { Router } from "./router";
import { HomePage } from "./pages/home";
import { NotesPage } from "./pages/notes";
import { NotePage } from "./pages/note";
import { TagPage } from "./pages/tag";
import { NotFoundPage } from "./pages/notfound";
import { MusicPlayerService } from "./services/player";
import { initTheme } from "./theme";
import { SearchModal } from "./components/search";
import "../styles/main.css";

class App {
  private router: Router;
  private searchModal: SearchModal;

  constructor() {
    this.router = new Router([
      { path: "/", view: HomePage },
      { path: "/notes", view: NotesPage },
      { path: "/note/:dateid", view: NotePage },
      { path: "/tag/:tag", view: TagPage },
    ], NotFoundPage);
    initTheme();
    MusicPlayerService.getInstance().init();
    this.searchModal = new SearchModal();
  }

  init() {
    window.addEventListener("popstate", async () => {
      await this.router.route();
    });

    document.addEventListener(
      "wheel",
      function touchHandler(e) {
        if (e.ctrlKey) {
          e.preventDefault();
        }
      },
      { passive: false }
    );

    window.addEventListener(
      "keydown",
      function (e) {
        if (
          (e.ctrlKey || e.metaKey) &&
          (e.which === 61 ||
            e.which === 107 ||
            e.which === 173 ||
            e.which === 109 ||
            e.which === 187 ||
            e.which === 189)
        ) {
          e.preventDefault();
        }
      },
      false
    );

    // Keyboard shortcuts for search
    window.addEventListener("keydown", (e) => {
      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        this.searchModal.open();
      }
      // Slash key (/) - only if not focused in inputs
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        this.searchModal.open();
      }
    });

    document.addEventListener("DOMContentLoaded", async () => {
      document.body.addEventListener("click", async (e: MouseEvent) => {
        if (e.target instanceof Element) {
          const searchBtn = e.target.closest(".search-trigger-btn");
          if (searchBtn) {
            e.preventDefault();
            this.searchModal.open();
            return;
          }

          const link = e.target.closest("[data-link]");
          if (link instanceof HTMLAnchorElement) {
            e.preventDefault();
            history.pushState(null, "", link.href);
            await this.router.route();
            return;
          }

          // Handle song clicks
          const songItem = e.target.closest(".song-list-item") as HTMLElement;
          if (songItem) {
            const songsData = songItem.getAttribute("data-section-songs");
            const songIndex = parseInt(songItem.getAttribute("data-song-index") || "0");
            if (songsData) {
              const tracks = JSON.parse(songsData.replace(/&apos;/g, "'"));
              MusicPlayerService.getInstance().playQueue(tracks, songIndex);
            }
            return;
          }

          // Handle Play All clicks
          const playAllBtn = e.target.closest(".play-all-btn") as HTMLElement;
          if (playAllBtn) {
            const songsData = playAllBtn.getAttribute("data-section-songs");
            if (songsData) {
              const tracks = JSON.parse(songsData.replace(/&apos;/g, "'"));
              MusicPlayerService.getInstance().playQueue(tracks, 0);
            }
            return;
          }
        }
      });

      await this.router.route();
    });
  }
}

const app = new App();
app.init();
