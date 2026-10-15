/* Finding a highlighted passage again in a lesson, to pin a tutor answer beside it.

   A pin stores the passage plus a little text before and after it. To find it, the
   lesson's text is indexed with all whitespace removed (a selection across two paragraphs
   comes back with line breaks the page text does not have), every occurrence of the
   passage is scored by how much of the surrounding text matches, and the best one is
   wrapped in <mark>. Lesson HTML is set once through innerHTML, so React never fights
   these edits; they are undone before every re-run. */

/** Text that is not lesson content: figures, controls, notes, and the pins themselves. */
const SKIP = "svg, [data-viz], button, textarea, input, script, style, .fcontrols, .mynotes, .pin-slot, .pin-orphans";

export interface Anchor { prefix: string; suffix: string }
interface Index { text: string; at: { node: Text; off: number }[] }

const squash = (s: string) => s.replace(/\s+/g, "");

function index(root: Element): Index {
  const at: Index["at"] = [];
  let text = "";
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.parentElement?.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) {
    const s = n.data;
    for (let i = 0; i < s.length; i++) {
      if (/\s/.test(s[i])) continue;
      text += s[i];
      at.push({ node: n, off: i });
    }
  }
  return { text, at };
}

/** Where the passage is, as [start, end) in the squashed text; null when it is gone. */
function locate(ix: Index, quote: string, anchor: Anchor): [number, number] | null {
  const q = squash(quote), pre = squash(anchor.prefix), post = squash(anchor.suffix);
  if (!q) return null;
  let best: [number, number] | null = null, bestScore = -1;
  for (let i = ix.text.indexOf(q); i >= 0; i = ix.text.indexOf(q, i + 1)) {
    let score = 0;
    while (score < pre.length && ix.text[i - 1 - score] === pre[pre.length - 1 - score]) score++;
    let k = 0;
    while (k < post.length && ix.text[i + q.length + k] === post[k]) k++;
    if (score + k > bestScore) { bestScore = score + k; best = [i, i + q.length]; }
  }
  return best;
}

/** Wrap the passage in <mark class="pin-mark" data-pin=id>; returns the marks, or [] if not found. */
export function markPassage(root: Element, id: number, quote: string, anchor: Anchor): HTMLElement[] {
  const ix = index(root);
  const span = locate(ix, quote, anchor);
  if (!span) return [];
  const ranges = new Map<Text, [number, number]>();
  for (let i = span[0]; i < span[1]; i++) {
    const { node, off } = ix.at[i];
    const r = ranges.get(node);
    ranges.set(node, r ? [Math.min(r[0], off), Math.max(r[1], off + 1)] : [off, off + 1]);
  }
  const marks: HTMLElement[] = [];
  ranges.forEach(([a, b], node) => {
    let mid = node;
    if (a > 0) mid = mid.splitText(a);
    if (b - a < mid.length) mid.splitText(b - a);
    const mark = document.createElement("mark");
    mark.className = "pin-mark";
    mark.dataset.pin = String(id);
    mid.parentNode!.insertBefore(mark, mid);
    mark.appendChild(mid);
    marks.push(mark);
  });
  return marks;
}

/** Undo markPassage everywhere under root. */
export function unmarkAll(root: Element) {
  root.querySelectorAll("mark.pin-mark").forEach(m => {
    const parent = m.parentNode!;
    while (m.firstChild) parent.insertBefore(m.firstChild, m);
    parent.removeChild(m);
    parent.normalize();
  });
}

/** The text around a selection inside a lesson, saved with a pin to find the right occurrence later. */
export function anchorOf(range: Range, root: Element): Anchor {
  const before = document.createRange(), after = document.createRange();
  before.setStart(root, 0);
  before.setEnd(range.startContainer, range.startOffset);
  after.setStart(range.endContainer, range.endOffset);
  after.setEnd(root, root.childNodes.length);
  return { prefix: before.toString().slice(-60), suffix: after.toString().slice(0, 60) };
}

/** Where a pin's card goes: inside a list item, otherwise straight after the passage's paragraph. */
export function slotAfter(root: Element, mark: HTMLElement): HTMLElement {
  const slot = document.createElement("div");
  slot.className = "pin-slot";
  const block = mark.closest("p, li, dd, pre, blockquote, h1, h2, h3, h4, h5, h6, table, figure, dt");
  if (block && root.contains(block)) {
    if (block.matches("li, dd")) block.appendChild(slot);
    else block.after(slot);
  } else {
    let top: Element = mark;
    while (top.parentElement && top.parentElement !== root) top = top.parentElement;
    top.after(slot);
  }
  return slot;
}
