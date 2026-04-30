export {};

declare global {
  interface Window {
    __JOURNAL_SYNC_IN_PROGRESS__?: boolean;
  }
}
