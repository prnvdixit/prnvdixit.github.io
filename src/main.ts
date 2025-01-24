import { Router } from "./router";
import { HomePage } from "./pages/home";
import { NotesPage } from "./pages/notes";
import { NotePage } from "./pages/note";
import { TagPage } from "./pages/tag";
import { MusicPlayerService } from "./services/player";
import { initTheme } from "./theme";
import "../styles/main.css";

class App {
  private router: Router;

  constructor() {
    this.router = new Router([
      { path: "/", view: HomePage },
      { path: "/notes", view: NotesPage },
      { path: "/note/:dateid", view: NotePage },
      { path: "/tag/:tag", view: TagPage },
    ]);
    initTheme();
    MusicPlayerService.getInstance().init();
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

    document.addEventListener("DOMContentLoaded", async () => {
      document.body.addEventListener("click", async (e: MouseEvent) => {
        if (e.target instanceof HTMLElement) {
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
