// jsdom lacks a few browser APIs the UI touches; stub them.
Element.prototype.scrollIntoView = function () {};
window.scrollTo = () => {};
Range.prototype.getBoundingClientRect = () => ({ x: 300, y: 300, left: 300, top: 300, right: 400, bottom: 320, width: 100, height: 20, toJSON() {} }) as DOMRect;
// No backend in tests: the store falls back to local mode.
globalThis.fetch = (() => Promise.reject(new Error("offline in tests"))) as typeof fetch;
