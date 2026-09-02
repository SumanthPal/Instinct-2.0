import { serwist } from "@serwist/next/config";

// Configurator mode: the service worker is built by `serwist build` after
// `next build`, which keeps Turbopack (the Next.js 16 default) usable.
// See https://serwist.pages.dev/docs/next/config
export default await serwist({
  swSrc: "src/app/sw.js",
  swDest: "public/sw.js",
  globDirectory: ".",
});
