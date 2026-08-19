import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Everything shipped as one 700KB chunk before this: the browser could not
    // run a single click handler until the whole thing had downloaded, parsed
    // and executed. Splitting the vendor half off lets it cache across deploys
    // and lets the route chunks (see the React.lazy calls in App.tsx) arrive
    // separately instead of gating the homepage on the roast page's code.
    //
    // React itself deliberately stays in the one `vendor` chunk. Giving it its
    // own chunk looks tidier and throws "Cannot read properties of undefined
    // (reading 'PureComponent')" on load: react-helmet is CJS and reads off the
    // React namespace at module scope, and once the two live in sibling chunks
    // the evaluation order stops being guaranteed. The libraries split out
    // below are all reached only from dynamic imports, which run long after
    // vendor has evaluated, so they cannot hit the same ordering trap.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return
          // Only the roast/card screens animate with it, and those are lazy.
          if (id.includes("framer-motion") || id.includes("motion-dom") || id.includes("motion-utils")) {
            return "motion"
          }
          // Export-to-image and confetti are used after a roast finishes, never
          // on first paint.
          if (id.includes("html-to-image") || id.includes("canvas-confetti")) {
            return "card-export"
          }
          if (id.includes("react-markdown") || id.includes("remark") || id.includes("micromark") ||
              id.includes("mdast") || id.includes("hast") || id.includes("unist") ||
              id.includes("unified") || id.includes("vfile")) {
            return "markdown"
          }
          return "vendor"
        },
      },
    },
    // Chunks are split on purpose now; the default 500KB warning only adds noise.
    chunkSizeWarningLimit: 900,
  },
})
