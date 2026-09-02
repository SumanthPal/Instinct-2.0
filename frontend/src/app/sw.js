import { defaultCache } from "@serwist/next/worker";
import { Serwist } from "serwist";

// Injected at build time by @serwist/next.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
