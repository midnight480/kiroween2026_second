import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const page = (f: string) => fileURLToPath(new URL(f, import.meta.url));

// Three pages, no router: the board, the team and the help page.
export default defineConfig({
  build: {
    rollupOptions: {
      input: { main: page("./index.html"), members: page("./members.html"), help: page("./help.html") },
    },
  },
});
