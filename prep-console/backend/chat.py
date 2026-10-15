"""The page tutor: answers questions about what is on the page, through any
OpenAI-compatible chat API (OpenAI, OpenRouter, Ollama, LM Studio, vLLM, ...).

The browser sends only an item id, the highlighted text and the question. The topic
text comes from content/ on this server, so the model always sees the real lesson and
never anything the page could have been tampered with to include.

Providers (LLM_PROVIDER):
  openai   POST {LLM_BASE_URL}/chat/completions with stream=true. The default whenever
           LLM_BASE_URL is set.
  fake     a canned, streamed answer that names the topic and the question. For tests
           and for trying the UI without an API key.
  (empty)  chat is switched off; the UI says so.
"""
from __future__ import annotations

import json
import re
import time
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterator

import requests

MAX_QUESTION = 4_000
MAX_SELECTION = 4_000
MAX_CONTEXT_CHARS = 80_000      # ~20k tokens: every current lesson fits; longer ones are cut with a marker
HISTORY_TURNS = 10              # earlier messages sent along with a follow-up

SYSTEM = """You are the tutor inside Prep Console, a study app for AI-engineer and software-engineer interviews.
The learner is reading a page of the course and asks you about it, often about a passage they highlighted.

How to answer:
- Start with the direct answer, then the mechanism: why it works, what would break without it.
- Use the course page below as your main source and keep its terminology. When the question goes beyond the page, answer from general knowledge and say so in one short clause.
- Be precise but plain. Define a term the first time you use it if the page has not.
- Prefer a small concrete example (numbers, a few lines of code, a tiny scenario) over abstract description.
- Keep it short: about 120-300 words unless the learner asks for more depth. No preamble, no restating the question.
- When it helps, end with one line on how this tends to come up in interviews.
- Format with Markdown: short paragraphs, bullet lists, **bold** for key terms, fenced code blocks with a language tag.
- If the highlighted text looks wrong or outdated, say so and give the correct version."""


# ---------------------------------------------------------------- content index

class _Text(HTMLParser):
    """Lesson HTML to readable plain text: paragraphs, bullets and code blocks survive."""
    BLOCK = {"p", "div", "section", "figure", "figcaption", "table", "tr", "blockquote", "dl", "dt", "dd",
             "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "details", "summary"}
    SKIP = {"script", "style", "svg", "button"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self.skip = 0
        self.pre = 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.skip += 1
        elif tag == "pre":
            self.pre += 1
            self.out.append("\n```\n")
        elif tag == "li":
            self.out.append("\n- ")
        elif tag == "br":
            self.out.append("\n")
        elif tag in ("td", "th"):
            self.out.append(" | ")
        elif tag in self.BLOCK:
            self.out.append("\n\n" + ("#" * int(tag[1]) + " " if re.fullmatch(r"h[1-6]", tag) else ""))

    def handle_endtag(self, tag):
        if tag in self.SKIP:
            self.skip = max(0, self.skip - 1)
        elif tag == "pre":
            self.pre = max(0, self.pre - 1)
            self.out.append("\n```\n")
        elif tag in self.BLOCK:
            self.out.append("\n\n")

    def handle_data(self, data):
        if self.skip:
            return
        self.out.append(data if self.pre else re.sub(r"\s+", " ", data))


def html_to_text(html: str) -> str:
    p = _Text()
    p.feed(html or "")
    text = "".join(p.out)
    text = re.sub(r"[ \t]+\n", "\n", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _item_text(it: dict) -> str:
    """A topic or design case in reading order, as the page shows it."""
    parts: list[str] = []
    add = lambda head, html: html and parts.append(f"## {head}\n{html_to_text(html)}")  # noqa: E731
    add("Why it matters", it.get("why"))
    add("Primer", it.get("primer"))
    add("Lesson", it.get("body"))
    add("Going deeper", it.get("deep"))
    add("In production", it.get("prod"))
    if it.get("myths"):
        parts.append("## Misconceptions\n" + "\n".join(
            f"- Myth: {html_to_text(m)}\n  Reality: {html_to_text(r)}" for m, r in it["myths"]))
    add("Hands-on lab", it.get("lab"))
    if it.get("recap"):
        parts.append("## Recap\n" + "\n".join(f"- {html_to_text(r)}" for r in it["recap"]))
    if it.get("glossary"):
        parts.append("## Glossary\n" + "\n".join(f"- {t}: {html_to_text(d)}" for t, d in it["glossary"]))
    add("Exercise", it.get("drill"))
    if it.get("qa"):
        parts.append("## Interview questions on this page\n" + "\n".join(
            f"- Q: {html_to_text(q[1])}\n  A: {html_to_text(q[2])}" for q in it["qa"]))
    return "\n\n".join(parts)


class ContentIndex:
    """Every askable thing on the site, by the id its card carries in the page."""

    def __init__(self, content_dir: Path) -> None:
        self.dir = content_dir
        self._items: dict[str, dict] | None = None

    def _load(self) -> dict[str, dict]:
        items: dict[str, dict] = {}
        read = lambda p: json.loads(p.read_text(encoding="utf-8"))  # noqa: E731
        for group in ("tracks", "designs"):
            for f in sorted((self.dir / group).glob("*.json")):
                for it in read(f):
                    items[it["id"]] = {"title": it["t"], "view": f.stem, "raw": it, "kind": "item"}
        if (self.dir / "patterns.json").exists():
            for p in read(self.dir / "patterns.json"):
                items[f"pat-{p['k']}"] = {"title": f"DSA pattern: {p['n']}", "view": "dsa", "raw": p, "kind": "pattern"}
        if (self.dir / "dsa.json").exists():
            for q in read(self.dir / "dsa.json"):
                items[q["id"]] = {"title": f"DSA problem: {q['t']}", "view": "dsa", "raw": q, "kind": "problem"}
        if (self.dir / "bank.json").exists():
            for b in read(self.dir / "bank.json"):
                items[b["id"]] = {"title": f"Interview question: {html_to_text(b['q'])}", "view": "bank", "raw": b, "kind": "bank"}
        return items

    @property
    def items(self) -> dict[str, dict]:
        if self._items is None:
            self._items = self._load()
        return self._items

    def resolve(self, item_id: str) -> str | None:
        """The id that has content: question-bank entries derived from a topic ("qa-ml3-2") map to the topic."""
        if item_id in self.items:
            return item_id
        m = re.fullmatch(r"qa-(.+)-\d+", item_id or "")
        return m.group(1) if m and m.group(1) in self.items else None

    def title(self, item_id: str) -> str:
        return self.items[item_id]["title"]

    def text(self, item_id: str) -> str:
        e = self.items[item_id]
        r = e["raw"]
        if e["kind"] == "item":
            body = _item_text(r)
        elif e["kind"] == "pattern":
            body = "\n\n".join(f"## {h}\n{html_to_text(r.get(k) or '')}" for h, k in
                               (("When to use it", "when"), ("Complexity", "cx"), ("Template", "tpl"),
                                ("Common trap", "trap"), ("Lesson", "learn")) if r.get(k))
        elif e["kind"] == "problem":
            body = f"Pattern: {r.get('p')}\nDifficulty: {r.get('d')}\nAsked at: {r.get('c')}\nKey idea: {r.get('k')}"
        else:
            body = f"Question: {html_to_text(r['q'])}\n\nModel answer: {html_to_text(r['a'])}"
        if len(body) > MAX_CONTEXT_CHARS:
            body = body[:MAX_CONTEXT_CHARS] + "\n\n[The rest of this page is not included.]"
        return body


# ---------------------------------------------------------------- prompt

def build_messages(index: ContentIndex, item_id: str | None, page_title: str,
                   history: list[dict], question: str, selection: str) -> list[dict]:
    """System prompt first and stable per topic, so providers that cache prompt prefixes
    (OpenAI does automatically above ~1k tokens) reuse it for every follow-up."""
    if item_id:
        context = f"<course_page title=\"{index.title(item_id)}\">\n{index.text(item_id)}\n</course_page>"
    elif page_title:
        context = f"The learner is on the \"{page_title}\" page, which has no lesson text attached."
    else:
        context = "No course page is attached to this question."
    msgs = [{"role": "system", "content": f"{SYSTEM}\n\n{context}"}]
    msgs += [{"role": m["role"], "content": m["content"]} for m in history[-HISTORY_TURNS:]]
    msgs.append({"role": "user", "content": user_turn(question, selection)})
    return msgs


def user_turn(question: str, selection: str) -> str:
    if not selection:
        return question
    quoted = "\n".join(f"> {line}" for line in selection.splitlines())
    return f"About this passage from the page:\n{quoted}\n\n{question}"


# ---------------------------------------------------------------- providers

class ProviderError(Exception):
    """A failure worth showing to the learner, with nothing secret in it."""


def provider_name(cfg: dict) -> str:
    p = (cfg.get("LLM_PROVIDER") or "").strip().lower()
    if p:
        return p
    return "openai" if cfg.get("LLM_BASE_URL") else ""


def is_enabled(cfg: dict) -> bool:
    p = provider_name(cfg)
    return p == "fake" or (p == "openai" and bool(cfg.get("LLM_BASE_URL")) and bool(cfg.get("LLM_MODEL")))


def stream_answer(cfg: dict, messages: list[dict]) -> Iterator[str]:
    """Yield the answer in pieces as the provider produces them."""
    p = provider_name(cfg)
    if p == "fake":
        yield from _fake(messages)
    elif p == "openai":
        yield from _openai(cfg, messages)
    else:
        raise ProviderError("The tutor is not configured on this server.")


def _fake(messages: list[dict]) -> Iterator[str]:
    m = re.search(r'<course_page title="([^"]*)"', messages[0]["content"])
    topic = m.group(1) if m else "this page"
    question = messages[-1]["content"].splitlines()[-1]
    answer = (f"**Fake tutor** (set `LLM_BASE_URL` to use a real model).\n\n"
              f"You asked about *{topic}*: {question}\n\n"
              f"- This answer streams in pieces, like a real one.\n"
              f"- The conversation has {len(messages) - 1} message(s) so far.\n\n"
              f"```python\nprint('hello from the tutor')\n```")
    for i in range(0, len(answer), 24):
        yield answer[i:i + 24]
        time.sleep(0.01)


def _openai(cfg: dict, messages: list[dict]) -> Iterator[str]:
    url = cfg["LLM_BASE_URL"].rstrip("/") + "/chat/completions"
    headers = {"Content-Type": "application/json"}
    if cfg.get("LLM_API_KEY"):
        headers["Authorization"] = f"Bearer {cfg['LLM_API_KEY']}"
    body: dict = {"model": cfg["LLM_MODEL"], "messages": messages, "stream": True}
    if cfg.get("LLM_MAX_TOKENS"):
        body["max_tokens"] = int(cfg["LLM_MAX_TOKENS"])
    try:
        r = requests.post(url, headers=headers, json=body, stream=True, timeout=(10, 120))
    except requests.RequestException as e:
        raise ProviderError(f"Could not reach the model server ({type(e).__name__}).") from e
    with r:
        if r.status_code != 200:
            raise ProviderError(_error_message(r))
        for line in _lines(r):
            if not line.startswith("data:"):
                continue
            data = line[5:].strip()
            if data == "[DONE]":
                return
            try:
                chunk = json.loads(data)
            except json.JSONDecodeError:
                continue
            if chunk.get("error"):
                raise ProviderError(str(chunk["error"].get("message") if isinstance(chunk["error"], dict) else chunk["error"])[:300])
            for choice in chunk.get("choices") or []:
                piece = (choice.get("delta") or {}).get("content")
                if piece:
                    yield piece


def _lines(r: requests.Response) -> Iterator[str]:
    """Lines of a streamed body as soon as each one is complete. iter_lines() either waits for
    512 bytes (several tokens) or, without a size, for the whole body when the server does not
    use chunked encoding; read1 returns whatever has arrived."""
    buf = b""
    while chunk := r.raw.read1(8192, decode_content=True):
        buf += chunk
        *done, buf = buf.split(b"\n")
        for line in done:
            yield line.rstrip(b"\r").decode("utf-8", "replace")
    if buf:
        yield buf.decode("utf-8", "replace")


def _error_message(r: requests.Response) -> str:
    try:
        err = r.json().get("error")
        detail = err.get("message") if isinstance(err, dict) else err
    except ValueError:
        detail = None
    hint = {401: "check LLM_API_KEY", 403: "check LLM_API_KEY", 404: "check LLM_BASE_URL and LLM_MODEL",
            429: "rate limited or out of credit"}.get(r.status_code, "")
    msg = f"The model server returned {r.status_code}"
    msg += f" ({hint})" if hint else ""
    return msg + (f": {str(detail)[:300]}" if detail else ".")
