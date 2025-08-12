declare module 'marked' {
  interface MarkedOptions {
    gfm?: boolean;
    breaks?: boolean;
    pedantic?: boolean;
    sanitize?: boolean;
    sanitizer?: (text: string) => string;
    mangle?: boolean;
    smartLists?: boolean;
    smartypants?: boolean;
    headerIds?: boolean;
    headerPrefix?: string;
    xhtml?: boolean;
  }

  export function marked(src: string, options?: MarkedOptions): string;
  export { marked };
}