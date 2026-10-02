// jsdom lacks a few browser APIs the UI touches; stub them.
Element.prototype.scrollIntoView = function () {};
window.scrollTo = () => {};
// No backend in tests: the store falls back to local mode.
globalThis.fetch = (() => Promise.reject(new Error("offline in tests"))) as typeof fetch;
