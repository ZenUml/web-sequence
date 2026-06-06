/// <reference types="vite/client" />
declare const __COMMITHASH__: string;
declare global {
  interface Window {
    IS_EXTENSION?: boolean;
    zenumlDesktop?: boolean;
  }
}
export {};
