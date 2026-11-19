import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { fileURLToPath } from "node:url";

const page = (f: string) => fileURLToPath(new URL(f, import.meta.url));

// A few pages, no router: the board, the team, help, the API docs and the privacy policy.
// The Cloudflare plugin runs worker/index.ts (/api/*) next to them, in dev and in the build,
// using cloudflare.config.ts.
export default defineConfig({
  plugins: [cloudflare()],
  environments: {
    // Only the browser build takes the HTML pages as entries; the Worker build has its own entry.
    client: {
      build: {
        rolldownOptions: {
          input: { main: page("./index.html"), members: page("./members.html"), help: page("./help.html"), api: page("./api.html"), privacy: page("./privacy.html") },
        },
      },
    },
  },
});
