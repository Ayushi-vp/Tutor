// @ts-nocheck
/* Chart toolkit and concept figures, carried over unchanged from the
   single-file console (src/parts p03, p09, p10, p10b). Each figure is
   { html(): string, init?(el) } — the <Viz> component mounts them. */
const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
export const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = n => n >= 1e9 ? (n/1e9).toFixed(n>=1e10?0:1)+"B" : n >= 1e6 ? (n/1e6).toFixed(n>=1e7?0:1)+"M" : n >= 1e3 ? (n/1e3).toFixed(n>=1e4?0:1)+"k" : String(n);

/* ===== p03.html ===== */

/* ============================================================
   Chart toolkit — hand-built SVG, theme tokens only.
   Every data chart ships a legend (2+ series), selective direct
   labels, a hover tooltip and a "show values" table twin.
   ============================================================ */
const SER = ["var(--s1)","var(--s2)","var(--s3)","var(--s4)","var(--s5)","var(--s6)","var(--s7)","var(--s8)"];
const SEQ = ["var(--seq-1)","var(--seq-2)","var(--seq-3)","var(--seq-4)","var(--seq-5)","var(--seq-6)","var(--seq-7)"];

function scale(dom, rng, log){
  const d0 = dom[0], d1 = dom[1], r0 = rng[0], r1 = rng[1];
  if (log){
    const l0 = Math.log10(d0), l1 = Math.log10(d1);
    return v => r0 + (Math.log10(Math.max(v, 1e-12)) - l0) / (l1 - l0) * (r1 - r0);
  }
  return v => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
}
function rrRight(x, y, w, h, r){
  r = Math.min(r, h / 2, Math.max(w, 0));
  if (w <= 0.5) return `M${x} ${y}h0.5v${h}h-0.5z`;
  return `M${x} ${y}h${w - r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - r)}z`;
}
function rrTop(x, y, w, h, r){
  r = Math.min(r, w / 2, Math.max(h, 0));
  if (h <= 0.5) return `M${x} ${y}h${w}v0.5h${-w}z`;
  return `M${x} ${y + h}v${-(h - r)}a${r} ${r} 0 0 1 ${r} ${-r}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - r}z`;
}

/* Keep a data label inside the drawing: estimate its width from the mono
   label font and flip the anchor rather than letting it clip the edge. */
function place(x, text, dx, anchor, w, padL){
  const tw = String(text).length * 6.3;
  let px = x + dx, a = anchor;
  if (a === "start" && px + tw > w - 3){ px = x - Math.abs(dx); a = "end"; }
  else if (a === "end" && px - tw < padL + 3){ px = x + Math.abs(dx); a = "start"; }
  return { x: Math.round(clamp(px, padL + 2, w - 3) * 10) / 10, a };
}

/* ---- figure wrapper ---- */
let figN = 0;
function fig(o){
  const id = "f" + (++figN);
  const legend = o.legend ? `<div class="legend">${o.legend.map(l =>
    `<span><i class="${l.sq ? "sq" : ""}" style="background:${l.color}"></i>${esc(l.name)}</span>`).join("")}</div>` : "";
  const tbl = o.table ? `<div class="vtable" id="vt-${id}" hidden>${o.table}</div>` : "";
  const ctl = (o.controls || o.table) ? `<div class="fx">${o.controls || ""}${o.table ?
    `<button class="vtoggle" type="button" data-vt="${id}" aria-expanded="false">Show values</button>` : ""}</div>` : "";
  return `<figure${o.fid ? ` id="${o.fid}"` : ""}>
    <figcaption><span class="ft">${esc(o.title)}</span>${o.sub ? `<span class="fs">${o.sub}</span>` : ""}</figcaption>
    <div class="plot"${o.pid ? ` id="${o.pid}"` : ""}>${o.body}</div>
    ${legend}${ctl}${tbl}</figure>`;
}
function tableOf(head, rows){
  return `<table><thead><tr>${head.map((h, i) => `<th class="${i ? "num" : ""}">${esc(h)}</th>`).join("")}</tr></thead>
  <tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td class="${i ? "num" : ""}">${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

/* ---- line / area chart ---- */
function lineChart(o){
  const w = o.w || 660, h = o.h || 250;
  const p = Object.assign({ l: 48, r: 20, t: 14, b: 36 }, o.pad);
  const X = scale(o.x.dom, [p.l, w - p.r], o.x.log);
  const Y = scale(o.y.dom, [h - p.b, p.t], o.y.log);
  let s = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(o.title || "chart")}">`;
  // grid + y ticks
  (o.y.ticks || []).forEach(t => {
    const y = Y(t.v !== undefined ? t.v : t);
    const lb = t.l !== undefined ? t.l : t;
    s += `<line x1="${p.l}" y1="${y}" x2="${w - p.r}" y2="${y}" stroke="var(--grid)" stroke-width="1"/>`;
    s += `<text class="axt" x="${p.l - 7}" y="${y + 3.5}" text-anchor="end">${esc(lb)}</text>`;
  });
  // x ticks
  (o.x.ticks || []).forEach(t => {
    const v = t.v !== undefined ? t.v : t, lb = t.l !== undefined ? t.l : t;
    const x = X(v);
    s += `<line x1="${x}" y1="${h - p.b}" x2="${x}" y2="${h - p.b + 4}" stroke="var(--axis)" stroke-width="1"/>`;
    s += `<text class="axt" x="${x}" y="${h - p.b + 15}" text-anchor="middle">${esc(lb)}</text>`;
  });
  s += `<line x1="${p.l}" y1="${h - p.b}" x2="${w - p.r}" y2="${h - p.b}" stroke="var(--axis)" stroke-width="1"/>`;
  // bands (shaded regions)
  (o.bands || []).forEach(b => {
    s += `<rect x="${X(b.x0)}" y="${p.t}" width="${Math.max(0, X(b.x1) - X(b.x0))}" height="${h - p.b - p.t}" fill="${b.fill || "var(--surface-3)"}" opacity="${b.op || .5}"/>`;
    if (b.label) s += `<text class="axl" x="${(X(b.x0) + X(b.x1)) / 2}" y="${p.t + 12}" text-anchor="middle" fill="var(--muted)">${esc(b.label)}</text>`;
  });
  // series
  (o.series || []).forEach((se, i) => {
    const col = se.color || SER[i % 8];
    const d = se.pts.map((pt, j) => `${j ? "L" : "M"}${X(pt[0]).toFixed(1)} ${Y(pt[1]).toFixed(1)}`).join(" ");
    if (se.area){
      const base = Y(o.y.dom[0]);
      s += `<path d="${d} L${X(se.pts[se.pts.length - 1][0]).toFixed(1)} ${base} L${X(se.pts[0][0]).toFixed(1)} ${base} Z" fill="${col}" opacity=".10"/>`;
    }
    s += `<path d="${d}" fill="none" stroke="${col}" stroke-width="${se.wid || 2}" stroke-linecap="round" stroke-linejoin="round"${se.dash ? ` stroke-dasharray="${se.dash}"` : ""}/>`;
    if (se.dot) se.pts.forEach(pt => { s += `<circle cx="${X(pt[0])}" cy="${Y(pt[1])}" r="3.2" fill="${col}" stroke="var(--surface)" stroke-width="2"/>`; });
    if (se.label){
      const last = se.pts[se.pts.length - 1];
      const L = place(X(last[0]), se.label, 6, se.anchor || "start", w, p.l);
      s += `<text class="dlab" x="${L.x}" y="${Y(last[1]) + (se.dy || 0) + 3.5}" fill="${col}" text-anchor="${L.a}">${esc(se.label)}</text>`;
    }
  });
  // point markers
  (o.marks || []).forEach(m => {
    s += `<circle cx="${X(m.x)}" cy="${Y(m.y)}" r="4.5" fill="${m.color || "var(--ink)"}" stroke="var(--surface)" stroke-width="2"/>`;
    if (m.text){
      const L = place(X(m.x), m.text, m.dx === undefined ? 8 : m.dx, m.anchor || "start", w, p.l);
      s += `<text class="dlab" x="${L.x}" y="${Y(m.y) + (m.dy === undefined ? -7 : m.dy)}" fill="${m.color || "var(--ink)"}" text-anchor="${L.a}">${esc(m.text)}</text>`;
    }
  });
  // axis titles
  if (o.x.label) s += `<text class="axl" x="${(p.l + w - p.r) / 2}" y="${h - 3}" text-anchor="middle">${esc(o.x.label)}</text>`;
  if (o.y.label) s += `<text class="axl" x="${-(p.t + h - p.b) / 2}" y="11" text-anchor="middle" transform="rotate(-90)">${esc(o.y.label)}</text>`;
  // hover columns
  if (o.hover !== false && o.series && o.series.length){
    const xs = o.hoverX || o.series[0].pts.map(pt => pt[0]);
    xs.forEach((xv, i) => {
      const x0 = i === 0 ? p.l : (X(xs[i - 1]) + X(xv)) / 2;
      const x1 = i === xs.length - 1 ? w - p.r : (X(xv) + X(xs[i + 1])) / 2;
      const lines = o.series.map((se, si) => {
        const pt = se.pts[i] || se.pts.find(q => q[0] === xv);
        if (!pt) return "";
        return `${se.name || "s" + si}: ${o.fmtY ? o.fmtY(pt[1]) : pt[1]}`;
      }).filter(Boolean).join("\n");
      const tip = `${o.xName || o.x.label || "x"} ${o.fmtX ? o.fmtX(xv) : xv}~|~${lines}`;
      s += `<rect x="${x0}" y="${p.t}" width="${Math.max(1, x1 - x0)}" height="${h - p.b - p.t}" fill="transparent" tabindex="0" data-tip="${esc(tip)}" data-cx="${X(xv)}"/>`;
    });
  }
  return s + "</svg>";
}

/* ---- horizontal bars ---- */
function barsH(o){
  const rows = o.rows, n = rows.length;
  const w = o.w || 660, rh = o.rh || 30, gap = o.gap || 9;
  const p = Object.assign({ l: o.labelW || 120, r: 54, t: 6, b: 20 }, o.pad);
  const h = p.t + p.b + n * rh + (n - 1) * gap;
  const max = o.max || Math.max.apply(null, rows.map(r => r.max !== undefined ? r.max : r.value)) || 1;
  const X = scale([0, max], [p.l, w - p.r]);
  let s = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(o.title || "bar chart")}">`;
  (o.ticks || []).forEach(t => {
    s += `<line x1="${X(t)}" y1="${p.t}" x2="${X(t)}" y2="${h - p.b}" stroke="var(--grid)" stroke-width="1"/>`;
    s += `<text class="axt" x="${X(t)}" y="${h - p.b + 13}" text-anchor="middle">${esc(o.fmtT ? o.fmtT(t) : t)}</text>`;
  });
  rows.forEach((r, i) => {
    const y = p.t + i * (rh + gap);
    const full = r.max !== undefined ? r.max : max;
    s += `<text class="axt" x="${p.l - 9}" y="${y + rh / 2 + 4}" text-anchor="end" fill="var(--ink-2)" style="font-size:11.5px">${esc(r.label)}</text>`;
    s += `<path d="${rrRight(p.l, y + 3, Math.max(0, X(full) - p.l), rh - 6, 4)}" fill="var(--surface-3)"/>`;
    const bw = Math.max(0, X(r.value) - p.l);
    s += `<path d="${rrRight(p.l, y + 3, bw, rh - 6, 4)}" fill="${r.color || SER[0]}" tabindex="0" data-tip="${esc(r.label + "~|~" + (r.tip || (r.value + " of " + full)))}"/>`;
    s += `<text class="dlab" x="${w - p.r + 8}" y="${y + rh / 2 + 4}" fill="var(--ink)" text-anchor="start">${esc(r.right !== undefined ? r.right : r.value)}</text>`;
  });
  s += `<line x1="${p.l}" y1="${p.t}" x2="${p.l}" y2="${h - p.b}" stroke="var(--axis)" stroke-width="1"/>`;
  return s + "</svg>";
}

/* ---- vertical bars (single or grouped) ---- */
function barsV(o){
  const w = o.w || 660, h = o.h || 250;
  const p = Object.assign({ l: 50, r: 16, t: 16, b: 42 }, o.pad);
  const cats = o.cats, groups = o.groups || [{ name: o.name || "", values: o.values }];
  const max = o.max || Math.max.apply(null, groups.flatMap(g => g.values)) * 1.08;
  const Y = scale([0, max], [h - p.b, p.t]);
  const band = (w - p.l - p.r) / cats.length;
  const gw = Math.min(o.barW || 42, (band - 14) / groups.length);
  let s = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(o.title || "bar chart")}">`;
  (o.ticks || []).forEach(t => {
    s += `<line x1="${p.l}" y1="${Y(t)}" x2="${w - p.r}" y2="${Y(t)}" stroke="var(--grid)" stroke-width="1"/>`;
    s += `<text class="axt" x="${p.l - 7}" y="${Y(t) + 3.5}" text-anchor="end">${esc(o.fmtT ? o.fmtT(t) : t)}</text>`;
  });
  cats.forEach((c, i) => {
    const cx = p.l + band * i + band / 2;
    const total = groups.length * gw + (groups.length - 1) * 2;
    groups.forEach((g, gi) => {
      const v = g.values[i];
      const x = cx - total / 2 + gi * (gw + 2);
      const y = Y(v), bh = (h - p.b) - y;
      const col = g.color || SER[gi % 8];
      s += `<path d="${rrTop(x, y, gw, bh, 4)}" fill="${col}" tabindex="0" data-tip="${esc(c + "~|~" + (g.name ? g.name + ": " : "") + (o.fmtV ? o.fmtV(v) : v))}"/>`;
      if (o.labelBars) s += `<text class="dlab" x="${x + gw / 2}" y="${y - 6}" fill="var(--ink)" text-anchor="middle">${esc(o.fmtV ? o.fmtV(v) : v)}</text>`;
    });
    (String(c).split("|")).forEach((ln, li) => {
      s += `<text class="axt" x="${cx}" y="${h - p.b + 15 + li * 12}" text-anchor="middle">${esc(ln)}</text>`;
    });
  });
  s += `<line x1="${p.l}" y1="${h - p.b}" x2="${w - p.r}" y2="${h - p.b}" stroke="var(--axis)" stroke-width="1"/>`;
  if (o.y && o.y.label) s += `<text class="axl" x="${-(p.t + h - p.b) / 2}" y="11" text-anchor="middle" transform="rotate(-90)">${esc(o.y.label)}</text>`;
  return s + "</svg>";
}

/* ---- heatmap / matrix ---- */
function heat(o){
  const cols = o.cols, rows = o.rows, cell = o.cell || 26, gap = 2;
  const p = Object.assign({ l: o.labelW || 64, r: 10, t: o.topH || 22, b: 12 }, o.pad);
  const w = p.l + p.r + cols.length * (cell + gap);
  const h = p.t + p.b + rows.length * (cell + gap);
  const max = o.max || Math.max.apply(null, o.values.flat()) || 1;
  let s = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(o.title || "heatmap")}">`;
  cols.forEach((c, j) => {
    if (c === "") return;
    s += `<text class="axt" x="${p.l + j * (cell + gap) + cell / 2}" y="${p.t - 7}" text-anchor="middle">${esc(c)}</text>`;
  });
  rows.forEach((r, i) => {
    if (r !== "") s += `<text class="axt" x="${p.l - 7}" y="${p.t + i * (cell + gap) + cell / 2 + 4}" text-anchor="end">${esc(r)}</text>`;
    cols.forEach((c, j) => {
      const v = o.values[i][j];
      const t = max ? clamp(v / max, 0, 1) : 0;
      const idx = v === 0 && o.zeroBlank ? -1 : Math.round(t * (SEQ.length - 1));
      const fill = idx < 0 ? "var(--surface-3)" : SEQ[Math.max(0, idx)];
      const tip = o.tip ? o.tip(i, j, v) : `${r} → ${c}~|~${v}`;
      s += `<rect x="${p.l + j * (cell + gap)}" y="${p.t + i * (cell + gap)}" width="${cell}" height="${cell}" rx="${o.rx === undefined ? 3 : o.rx}" fill="${fill}" tabindex="0" data-tip="${esc(tip)}"/>`;
      if (o.showVal && v > 0) s += `<text class="dlab" x="${p.l + j * (cell + gap) + cell / 2}" y="${p.t + i * (cell + gap) + cell / 2 + 3.5}" text-anchor="middle" fill="${t > .55 ? "var(--surface)" : "var(--ink)"}" style="font-size:9.5px;pointer-events:none">${esc(o.fmtV ? o.fmtV(v) : v)}</text>`;
    });
  });
  return s + "</svg>";
}
function seqLegend(lo, hi, label){
  return `<div class="legend"><span style="gap:8px">${esc(label || "")}
    <i class="sq" style="background:var(--surface-3)"></i>${esc(lo)}
    ${SEQ.map(c => `<i class="sq" style="background:${c}"></i>`).join("")}${esc(hi)}</span></div>`;
}

/* ---- tooltip + table-view delegation ---- */
(function chartInteractions(){
  function tipFor(plot){
    let t = plot.querySelector(":scope > .tip");
    if (!t){ t = document.createElement("div"); t.className = "tip"; plot.appendChild(t); }
    return t;
  }
  function show(e, el){
    const plot = el.closest(".plot"); if (!plot) return;
    const t = tipFor(plot);
    const raw = el.getAttribute("data-tip").split("~|~");
    t.innerHTML = `<b>${esc(raw[0])}</b>${esc(raw[1] || "").replace(/\n/g, "<br>")}`;
    t.classList.add("on");
    const pr = plot.getBoundingClientRect(), br = el.getBoundingClientRect();
    const cx = (br.left + br.width / 2) - pr.left;
    const cy = br.top - pr.top;
    t.style.left = clamp(cx - t.offsetWidth / 2, 4, Math.max(4, pr.width - t.offsetWidth - 4)) + "px";
    t.style.top = Math.max(2, cy - t.offsetHeight - 8) + "px";
  }
  function hide(el){
    const plot = el && el.closest(".plot"); if (!plot) return;
    const t = plot.querySelector(":scope > .tip"); if (t) t.classList.remove("on");
  }
  document.addEventListener("mouseover", e => { const el = e.target.closest && e.target.closest("[data-tip]"); if (el) show(e, el); });
  document.addEventListener("mouseout",  e => { const el = e.target.closest && e.target.closest("[data-tip]"); if (el) hide(el); });
  document.addEventListener("focusin",   e => { const el = e.target.closest && e.target.closest("[data-tip]"); if (el) show(e, el); });
  document.addEventListener("focusout",  e => { const el = e.target.closest && e.target.closest("[data-tip]"); if (el) hide(el); });
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-vt]"); if (!b) return;
    const box = document.getElementById("vt-" + b.getAttribute("data-vt")); if (!box) return;
    const open = box.hidden;
    box.hidden = !open;
    b.setAttribute("aria-expanded", String(open));
    b.textContent = open ? "Hide values" : "Show values";
  });
})();

/* ===== p09.html ===== */

/* ============================================================
   CONCEPT VISUALISATIONS
   ============================================================ */
const VIZ = {};
const r2 = n => Math.round(n * 100) / 100;
const normCdf = z => { const t = 1 / (1 + 0.2316419 * Math.abs(z)); const d = 0.3989423 * Math.exp(-z * z / 2);
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
const erf = x => { const s = x < 0 ? -1 : 1; x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y; };

/* ---------- bias–variance ---------- */
VIZ.biasVariance = { html(){
  const xs = []; for (let x = 1; x <= 10; x += 0.25) xs.push(x);
  const b2 = x => 10 / Math.pow(x, 1.3), va = x => 0.18 * Math.pow(x, 1.6), noise = 0.9;
  const B = xs.map(x => [x, b2(x)]), V = xs.map(x => [x, va(x)]), T = xs.map(x => [x, b2(x) + va(x) + noise]);
  let best = T[0]; T.forEach(p => { if (p[1] < best[1]) best = p; });
  const ints = [1,2,3,4,5,6,7,8,9,10];
  return fig({ title:"Test error decomposes into bias, variance and noise",
    sub:"Model complexity on the x-axis. The sum is U-shaped, so there is a capacity that minimises total error.",
    body: lineChart({ w:660, h:250, x:{ dom:[1,10], ticks:ints, label:"Model complexity →" },
      y:{ dom:[0,12], ticks:[0,3,6,9,12], label:"Expected error" },
      series:[ { name:"Total error", pts:T, color:"var(--s1)", wid:2.5, label:"Total", dy:-8 },
               { name:"Bias²", pts:B, color:"var(--s2)", label:"Bias²" },
               { name:"Variance", pts:V, color:"var(--s3)", label:"Variance" } ],
      marks:[{ x:best[0], y:best[1], text:"sweet spot", color:"var(--ink)", dx:-6, dy:-12, anchor:"end" }],
      hoverX:ints, fmtY:v => r2(v), xName:"Complexity" }),
    legend:[{name:"Total error",color:"var(--s1)"},{name:"Bias²",color:"var(--s2)"},{name:"Variance",color:"var(--s3)"}],
    table: tableOf(["Complexity","Bias²","Variance","Total"], ints.map(x => [x, r2(b2(x)), r2(va(x)), r2(b2(x)+va(x)+noise)])) });
} };

/* ---------- L1 vs L2 geometry ---------- */
VIZ.regularization = { html(){
  const panel = (cx, title, shape) => {
    let s = `<text class="axl" x="${cx}" y="18" text-anchor="middle" fill="var(--ink)" style="font-size:12px;font-weight:600">${title}</text>`;
    // axes
    s += `<line x1="${cx-100}" y1="150" x2="${cx+100}" y2="150" stroke="var(--axis)" stroke-width="1"/>`;
    s += `<line x1="${cx}" y1="42" x2="${cx}" y2="248" stroke="var(--axis)" stroke-width="1"/>`;
    s += `<text class="axl" x="${cx+104}" y="154" fill="var(--muted)">w₁</text><text class="axl" x="${cx+5}" y="40" fill="var(--muted)">w₂</text>`;
    // loss contours (ellipses centred on the OLS solution)
    const ox = cx + 62, oy = 92;
    [1, 1.75, 2.5].forEach((k, i) => {
      s += `<ellipse cx="${ox}" cy="${oy}" rx="${28*k}" ry="${17*k}" transform="rotate(-28 ${ox} ${oy})" fill="none" stroke="var(--s2)" stroke-width="1.4" opacity="${0.85 - i*0.2}"/>`;
    });
    s += `<circle cx="${ox}" cy="${oy}" r="3.5" fill="var(--s2)"/><text class="dlab" x="${ox+8}" y="${oy-6}" fill="var(--s2)">OLS fit</text>`;
    // constraint region
    if (shape === "l1") s += `<path d="M${cx} 92 L${cx+58} 150 L${cx} 208 L${cx-58} 150 Z" fill="var(--s1)" opacity=".14" stroke="var(--s1)" stroke-width="1.8"/>`;
    else s += `<circle cx="${cx}" cy="150" r="58" fill="var(--s1)" opacity=".14" stroke="var(--s1)" stroke-width="1.8"/>`;
    // contact point
    const px = shape === "l1" ? cx : cx + 47, py = shape === "l1" ? 92 : 117;
    s += `<circle cx="${px}" cy="${py}" r="5" fill="var(--ink)" stroke="var(--surface)" stroke-width="2"/>`;
    s += `<text class="dlab" x="${px + (shape==="l1" ? -9 : 10)}" y="${py - 9}" fill="var(--ink)" text-anchor="${shape==="l1"?"end":"start"}">${shape === "l1" ? "w₁ = 0" : "both ≠ 0"}</text>`;
    s += `<text class="axl" x="${cx}" y="268" text-anchor="middle" fill="var(--muted)">${shape === "l1" ? "corner on the axis → exact zero" : "smooth boundary → shrinkage only"}</text>`;
    return s;
  };
  const svg = `<svg viewBox="0 0 660 285" role="img" aria-label="L1 and L2 constraint regions against elliptical loss contours">
    ${panel(165, "L1  (lasso)  ‖w‖₁ ≤ t", "l1")}${panel(495, "L2  (ridge)  ‖w‖₂ ≤ t", "l2")}</svg>`;
  return fig({ title:"Why L1 produces zeros and L2 does not",
    sub:"The loss contours grow until they touch the constraint region. A diamond's corners sit on the axes; a circle has none.",
    body: svg });
} };

/* ---------- loss functions ---------- */
VIZ.lossFns = { html(){
  const xs = []; for (let x = -3; x <= 3.001; x += 0.1) xs.push(r2(x));
  const hub = e => Math.abs(e) <= 1 ? 0.5 * e * e : Math.abs(e) - 0.5;
  const ticks = [-3,-2,-1,0,1,2,3];
  return fig({ title:"What each regression loss punishes",
    sub:"Error on the x-axis, penalty on the y. MSE's penalty accelerates, so one outlier can dominate the gradient.",
    body: lineChart({ w:660, h:240, x:{ dom:[-3,3], ticks, label:"Prediction error" }, y:{ dom:[0,9], ticks:[0,3,6,9], label:"Loss" },
      series:[ { name:"MSE", pts:xs.map(e => [e, e*e]), color:"var(--s1)", label:"MSE", dy:6 },
               { name:"MAE", pts:xs.map(e => [e, Math.abs(e)]), color:"var(--s2)", label:"MAE", dy:-4 },
               { name:"Huber δ=1", pts:xs.map(e => [e, hub(e)]), color:"var(--s3)", label:"Huber", dy:12 } ],
      hoverX:ticks, fmtY:v => r2(v), xName:"Error" }),
    legend:[{name:"MSE — conditional mean",color:"var(--s1)"},{name:"MAE — conditional median",color:"var(--s2)"},{name:"Huber δ=1 — robust and smooth",color:"var(--s3)"}],
    table: tableOf(["Error","MSE","MAE","Huber"], ticks.map(e => [e, r2(e*e), r2(Math.abs(e)), r2(hub(e))])) });
} };

/* ---------- sigmoid + saturation ---------- */
VIZ.sigmoid = { html(){
  const xs = []; for (let x = -8; x <= 8.001; x += 0.2) xs.push(r2(x));
  const sg = z => 1 / (1 + Math.exp(-z));
  const ticks = [-8,-6,-4,-2,0,2,4,6,8];
  return fig({ title:"The sigmoid and its derivative",
    sub:"Outside roughly |z| > 4 the derivative is near zero — the saturation that stalls learning in deep sigmoid stacks.",
    body: lineChart({ w:660, h:230, x:{ dom:[-8,8], ticks, label:"z = wᵀx + b" }, y:{ dom:[0,1], ticks:[0,0.25,0.5,0.75,1], label:"" },
      bands:[{ x0:-8, x1:-4, label:"saturated" }, { x0:4, x1:8, label:"saturated" }],
      series:[ { name:"σ(z)", pts:xs.map(z => [z, sg(z)]), color:"var(--s1)", label:"σ(z)", dy:-6 },
               { name:"σ′(z)", pts:xs.map(z => [z, sg(z)*(1-sg(z))]), color:"var(--s2)", label:"σ′(z)", dy:14 } ],
      hoverX:ticks, fmtY:v => r2(v), xName:"z" }),
    legend:[{name:"σ(z) — probability",color:"var(--s1)"},{name:"σ′(z) — gradient",color:"var(--s2)"}],
    table: tableOf(["z","σ(z)","σ′(z)"], ticks.map(z => [z, r2(sg(z)), r2(sg(z)*(1-sg(z)))])) });
} };

/* ---------- bagging vs boosting ---------- */
VIZ.ensembles = { html(){
  const xs = []; for (let n = 1; n <= 500; n += 5) xs.push(n);
  const rf = n => 0.155 + 0.155 * Math.exp(-n / 45);
  const gb = n => 0.113 + 0.36 * Math.exp(-n / 60) + 0.00006 * Math.max(0, n - 260);
  const ticks = [1,100,200,300,400,500];
  return fig({ title:"Bagging plateaus, boosting overshoots",
    sub:"Held-out error against ensemble size. Adding trees to a forest is safe; adding trees to a boosted model eventually overfits.",
    body: lineChart({ w:660, h:240, x:{ dom:[1,500], ticks, label:"Trees in the ensemble" },
      y:{ dom:[0.08,0.5], ticks:[{v:0.1,l:"0.10"},{v:0.2,l:"0.20"},{v:0.3,l:"0.30"},{v:0.4,l:"0.40"},{v:0.5,l:"0.50"}], label:"Validation error" },
      series:[ { name:"Random forest", pts:xs.map(n => [n, rf(n)]), color:"var(--s1)", label:"Forest", dy:-6 },
               { name:"Gradient boosting", pts:xs.map(n => [n, gb(n)]), color:"var(--s2)", label:"Boosting", dy:10 },
               { name:"Single deep tree", pts:[[1,0.30],[500,0.30]], color:"var(--s3)", dash:"5 4", label:"One tree", dy:-6 } ],
      marks:[{ x:260, y:gb(260), text:"early stop", color:"var(--ink)", dx:-8, dy:-10, anchor:"end" }],
      hoverX:ticks, fmtY:v => r2(v), xName:"Trees" }),
    legend:[{name:"Random forest (variance ↓)",color:"var(--s1)"},{name:"Gradient boosting (bias ↓)",color:"var(--s2)"},{name:"Single deep tree",color:"var(--s3)"}],
    table: tableOf(["Trees","Forest","Boosting"], ticks.map(n => [n, r2(rf(n)), r2(gb(n))])) });
} };

/* ---------- curse of dimensionality ---------- */
VIZ.curse = { html(){
  const ds = [1,2,3,5,8,12,20,35,60,100,160,250];
  const ratio = d => 3.2 / Math.pow(d, 0.62);
  return fig({ title:"Distances stop discriminating as dimension grows",
    sub:"Relative spread (farthest − nearest) ÷ nearest, for uniformly sampled points. Below ~0.2 the notion of “nearest” carries almost no information.",
    body: lineChart({ w:660, h:230, x:{ dom:[1,250], log:true, ticks:[{v:1,l:"1"},{v:3,l:"3"},{v:10,l:"10"},{v:30,l:"30"},{v:100,l:"100"},{v:250,l:"250"}], label:"Dimensions" },
      y:{ dom:[0,3.4], ticks:[0,1,2,3], label:"Relative distance spread" },
      series:[{ name:"Spread", pts:ds.map(d => [d, ratio(d)]), color:"var(--s1)", dot:true, area:true }],
      bands:[{ x0:60, x1:250, label:"neighbours indistinguishable", fill:"var(--crit)", op:.07 }],
      hoverX:ds, fmtY:v => r2(v), xName:"d =" }),
    table: tableOf(["Dimensions","Relative spread"], ds.map(d => [d, r2(ratio(d))])) });
} };

/* ---------- PCA ---------- */
VIZ.pca = { html(){
  let seed = 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const pts = []; for (let i = 0; i < 90; i++){
    const u = (rnd() + rnd() + rnd() - 1.5) * 2.2, v = (rnd() + rnd() + rnd() - 1.5) * 0.75;
    pts.push([u * 0.94 - v * 0.34, u * 0.34 + v * 0.94]);
  }
  const X = scale([-4,4],[52,608]), Y = scale([-3,3],[212,24]);
  let s = `<svg viewBox="0 0 660 240" role="img" aria-label="Scatter of correlated data with principal component axes">`;
  s += `<line x1="52" y1="${Y(0)}" x2="608" y2="${Y(0)}" stroke="var(--grid)"/><line x1="${X(0)}" y1="24" x2="${X(0)}" y2="212" stroke="var(--grid)"/>`;
  pts.forEach(p => { s += `<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="3" fill="var(--s1)" opacity=".62"/>`; });
  const arrow = (dx, dy, len, col, lab, pctv) => {
    const x2 = X(dx * len), y2 = Y(dy * len);
    return `<line x1="${X(0)}" y1="${Y(0)}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="2.5" marker-end="url(#ah)"/>
      <text class="dlab" x="${x2 + 8}" y="${y2 - 6}" fill="${col}">${lab} · ${pctv}</text>`;
  };
  s += `<defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="context-stroke"/></marker></defs>`;
  s += arrow(0.94, 0.34, 3.1, "var(--s2)", "PC1", "88% var");
  s += arrow(-0.34, 0.94, 1.15, "var(--s4)", "PC2", "12% var");
  s += `<text class="axl" x="330" y="234" text-anchor="middle">feature 1 (centred)</text>`;
  s += `</svg>`;
  return fig({ title:"PCA finds the axes of greatest variance",
    sub:"PC1 follows the direction the data actually spreads along; PC2 is orthogonal to it. Keeping PC1 alone retains 88% of the variance.",
    body:s, legend:[{name:"observations",color:"var(--s1)",sq:true},{name:"PC1",color:"var(--s2)"},{name:"PC2",color:"var(--s4)"}] });
} };

/* ---------- activations ---------- */
VIZ.activations = { html(){
  const xs = []; for (let x = -4; x <= 4.001; x += 0.1) xs.push(r2(x));
  const gelu = z => 0.5 * z * (1 + erf(z / Math.SQRT2));
  const silu = z => z / (1 + Math.exp(-z));
  const ticks = [-4,-2,0,2,4];
  return fig({ title:"Activation functions compared",
    sub:"ReLU's kink passes gradient undiminished but kills negative units; GELU and SiLU keep a small negative response and are smooth everywhere.",
    body: lineChart({ w:660, h:240, x:{ dom:[-4,4], ticks, label:"z" }, y:{ dom:[-1.2,4], ticks:[-1,0,1,2,3,4], label:"activation" },
      series:[ { name:"ReLU", pts:xs.map(z => [z, Math.max(0,z)]), color:"var(--s1)", label:"ReLU", dy:-4 },
               { name:"GELU", pts:xs.map(z => [z, gelu(z)]), color:"var(--s2)", label:"GELU", dy:10 },
               { name:"SiLU/Swish", pts:xs.map(z => [z, silu(z)]), color:"var(--s3)", label:"SiLU", dy:22 },
               { name:"tanh", pts:xs.map(z => [z, Math.tanh(z)]), color:"var(--s4)", label:"tanh", dy:-14 } ],
      hoverX:ticks, fmtY:v => r2(v), xName:"z" }),
    legend:[{name:"ReLU",color:"var(--s1)"},{name:"GELU",color:"var(--s2)"},{name:"SiLU / Swish",color:"var(--s3)"},{name:"tanh",color:"var(--s4)"}],
    table: tableOf(["z","ReLU","GELU","SiLU","tanh"], ticks.map(z => [z, r2(Math.max(0,z)), r2(gelu(z)), r2(silu(z)), r2(Math.tanh(z))])) });
} };

/* ---------- vanishing gradients ---------- */
VIZ.vanishing = { html(){
  const layers = [1,2,3,4,5,6,7,8];
  const plain = layers.map(l => Math.pow(0.42, l - 1));
  const res = layers.map(l => 1 - 0.03 * (l - 1));
  return fig({ title:"What a residual connection does to the gradient",
    sub:"Gradient norm reaching each layer, measured backwards from the loss. Without a skip path the signal decays geometrically with depth.",
    body: barsV({ w:660, h:250, cats:layers.map(l => "L" + l), ticks:[0,0.25,0.5,0.75,1],
      groups:[ { name:"Plain stack", values:plain, color:"var(--s2)" }, { name:"With residuals", values:res, color:"var(--s1)" } ],
      max:1.08, barW:22, fmtV:v => v.toFixed(3), y:{ label:"relative gradient norm" } }),
    legend:[{name:"Plain stack",color:"var(--s2)",sq:true},{name:"With residual connections",color:"var(--s1)",sq:true}],
    table: tableOf(["Layer","Plain","Residual"], layers.map((l,i) => ["L"+l, plain[i].toFixed(4), res[i].toFixed(3)])) });
} };

/* ---------- optimisers ---------- */
VIZ.optimizers = { html(){
  const xs = []; for (let s = 0; s <= 200; s += 5) xs.push(s);
  const sgd = s => 0.35 + 2.4 * Math.exp(-s / 70) + 0.05 * Math.sin(s / 7) * Math.exp(-s / 90);
  const mom = s => 0.28 + 2.4 * Math.exp(-s / 42);
  const adam = s => 0.22 + 2.4 * Math.exp(-s / 26);
  const ticks = [0,50,100,150,200];
  return fig({ title:"Optimiser convergence on the same problem",
    sub:"Momentum damps the oscillation SGD shows across a ravine; Adam's per-parameter step sizes get there sooner still.",
    body: lineChart({ w:660, h:240, x:{ dom:[0,200], ticks, label:"Optimisation step" }, y:{ dom:[0,3], ticks:[0,1,2,3], label:"Training loss" },
      series:[ { name:"SGD", pts:xs.map(s => [s, sgd(s)]), color:"var(--s2)", label:"SGD", dy:-6 },
               { name:"+ Momentum", pts:xs.map(s => [s, mom(s)]), color:"var(--s4)", label:"Momentum", dy:6 },
               { name:"Adam", pts:xs.map(s => [s, adam(s)]), color:"var(--s1)", label:"Adam", dy:16 } ],
      hoverX:ticks, fmtY:v => r2(v), xName:"Step" }),
    legend:[{name:"SGD",color:"var(--s2)"},{name:"SGD + momentum",color:"var(--s4)"},{name:"Adam",color:"var(--s1)"}],
    table: tableOf(["Step","SGD","Momentum","Adam"], ticks.map(s => [s, r2(sgd(s)), r2(mom(s)), r2(adam(s))])) });
} };

/* ---------- KV cache growth ---------- */
VIZ.kvcache = { html(){
  const lens = [1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072];
  const gb = (kvHeads, n) => 2 * 80 * kvHeads * 128 * n * 2 / 1e9;   // 80 layers, head_dim 128, fp16
  const mk = k => lens.map(n => [n, gb(k, n)]);
  const ticks = [{v:1024,l:"1k"},{v:4096,l:"4k"},{v:16384,l:"16k"},{v:65536,l:"64k"},{v:131072,l:"128k"}];
  return fig({ title:"KV cache per sequence — 70B-class model, fp16",
    sub:"80 layers, head dim 128. Grouped-query attention is the architectural lever: 8 KV heads instead of 64 is an 8× cut.",
    body: lineChart({ w:660, h:250, x:{ dom:[1024,131072], log:true, ticks, label:"Context length (tokens)" },
      y:{ dom:[0.1,400], log:true, ticks:[{v:0.1,l:"0.1"},{v:1,l:"1"},{v:10,l:"10"},{v:100,l:"100"},{v:400,l:"400"}], label:"GB per sequence" },
      series:[ { name:"MHA (64 KV heads)", pts:mk(64), color:"var(--s2)", dot:true, label:"MHA" },
               { name:"GQA (8 KV heads)", pts:mk(8), color:"var(--s1)", dot:true, label:"GQA" },
               { name:"MQA (1 KV head)", pts:mk(1), color:"var(--s3)", dot:true, label:"MQA" } ],
      bands:[{ x0:1024, x1:131072, fill:"transparent", op:0 }],
      hoverX:lens, fmtY:v => v.toFixed(2) + " GB", fmtX:v => v >= 1024 ? (v/1024) + "k" : v, xName:"Context" }),
    legend:[{name:"MHA — 64 KV heads",color:"var(--s2)"},{name:"GQA — 8 KV heads",color:"var(--s1)"},{name:"MQA — 1 KV head",color:"var(--s3)"}],
    table: tableOf(["Context","MHA (GB)","GQA (GB)","MQA (GB)"], lens.map(n => [(n/1024)+"k", gb(64,n).toFixed(2), gb(8,n).toFixed(2), gb(1,n).toFixed(3)])) });
} };

/* ---------- scaling laws ---------- */
VIZ.scaling = { html(){
  // Chinchilla parametric form: L(N,D) = E + A/N^α + B/D^β
  const E = 1.69, A = 406.4, al = 0.34, B = 410.7, be = 0.28;
  const L = (N, D) => E + A / Math.pow(N, al) + B / Math.pow(D, be);
  const Ds = []; for (let e = 10; e <= 13.6; e += 0.15) Ds.push(Math.pow(10, e));
  const sizes = [[1e9,"1B","var(--s4)"],[7e9,"7B","var(--s2)"],[7e10,"70B","var(--s1)"]];
  const ticks = [{v:1e10,l:"10B"},{v:1e11,l:"100B"},{v:1e12,l:"1T"},{v:1e13,l:"10T"}];
  return fig({ title:"Chinchilla scaling: loss against tokens seen",
    sub:"Each curve is one model size. Bigger models start lower but every curve flattens — at that point more data is wasted and you should have trained a larger model.",
    body: lineChart({ w:660, h:255, x:{ dom:[1e10,4e13], log:true, ticks, label:"Training tokens" },
      y:{ dom:[1.8,3.2], ticks:[{v:1.8,l:"1.8"},{v:2.2,l:"2.2"},{v:2.6,l:"2.6"},{v:3.0,l:"3.0"}], label:"Loss (nats/token)" },
      series: sizes.map(s => ({ name:s[1], pts:Ds.map(d => [d, L(s[0], d)]), color:s[2], label:s[1], dy:-5 })),
      marks:[{ x:2e10, y:L(1e9,2e10), text:"20 tokens/param", color:"var(--muted)", dx:6, dy:-9 },
             { x:1.4e11, y:L(7e9,1.4e11), color:"var(--muted)" },
             { x:1.4e12, y:L(7e10,1.4e12), color:"var(--muted)" }],
      hoverX:[1e10,1e11,1e12,1e13], fmtY:v => v.toFixed(3), fmtX:v => fmt(v), xName:"Tokens" }),
    legend: sizes.map(s => ({ name:s[1] + " parameters", color:s[2] })),
    table: tableOf(["Tokens","1B loss","7B loss","70B loss"],
      [1e10,1e11,1e12,1e13].map(d => [fmt(d), L(1e9,d).toFixed(3), L(7e9,d).toFixed(3), L(7e10,d).toFixed(3)])) });
} };

/* ---------- quantisation ---------- */
VIZ.quant = { html(){
  const cats = ["FP32|4 bytes","BF16|2 bytes","INT8|1 byte","INT4|0.5 byte"];
  const vals = [280, 140, 70, 35];
  return fig({ title:"Weight memory for a 70B model by precision",
    sub:"Weights only — KV cache and activations sit on top. The dashed line is one 80 GB accelerator.",
    body: (function(){
      let s = barsV({ w:660, h:250, cats, values:vals, color:"var(--s1)", ticks:[0,70,140,210,280],
        max:300, barW:56, labelBars:true, fmtV:v => v + " GB", y:{ label:"GB" }, fmtT:v => v });
      // 80 GB reference line, drawn into the same coordinate space
      const Y = scale([0,300],[250-42,16]);
      s = s.replace("</svg>", `<line x1="50" y1="${Y(80)}" x2="644" y2="${Y(80)}" stroke="var(--crit)" stroke-width="1.5" stroke-dasharray="6 4"/>
        <text class="dlab" x="644" y="${Y(80)-6}" text-anchor="end" fill="var(--crit)">80 GB — one H100</text></svg>`);
      return s;
    })(),
    legend:[{name:"weights",color:"var(--s1)",sq:true},{name:"single-GPU limit",color:"var(--crit)"}],
    table: tableOf(["Precision","70B","13B","7B"], [["FP32","280 GB","52 GB","28 GB"],["BF16","140 GB","26 GB","14 GB"],["INT8","70 GB","13 GB","7 GB"],["INT4","35 GB","6.5 GB","3.5 GB"]]) });
} };

/* ---------- LoRA memory ---------- */
VIZ.lora = { html(){
  const rows = [
    { label:"Full fine-tune", value:108, right:"108 GB", color:"var(--s2)", tip:"14 weights + 14 grads + 54 Adam states + 27 fp32 master" },
    { label:"LoRA r=16", value:14.2, right:"14.2 GB", color:"var(--s1)", tip:"frozen bf16 base + 16.8M trainable params" },
    { label:"QLoRA r=16", value:3.9, right:"3.9 GB", color:"var(--s3)", tip:"NF4 base + bf16 adapters + paged optimiser" }
  ];
  return fig({ title:"Training memory for a 7B model",
    sub:"Adam keeps two fp32 moments per trainable parameter, so freezing the base removes almost all of the optimiser state.",
    body: barsH({ w:660, rh:32, labelW:128, rows, max:115, ticks:[0,25,50,75,100], fmtT:t => t + " GB" }),
    table: tableOf(["Method","Trainable params","% of model","Memory"],
      [["Full fine-tune","6.74 B","100%","≈108 GB"],["LoRA r=8","8.4 M","0.12%","≈14.1 GB"],["LoRA r=16","16.8 M","0.25%","≈14.2 GB"],["LoRA r=64","67.1 M","1.0%","≈14.8 GB"],["QLoRA r=16","16.8 M","0.25%","≈3.9 GB"]]) });
} };

/* ---------- latency budget ---------- */
VIZ.latency = { html(){
  const cats = ["Queue|wait","Prefill|prompt","Decode|generation","Network|transport"];
  const before = [1200, 900, 5600, 300], after = [150, 320, 1350, 180];
  return fig({ title:"Where an 8-second p95 actually goes",
    sub:"Decode dominates, so continuous batching and speculative decoding move the number; optimising prefill alone cannot.",
    body: barsV({ w:660, h:250, cats, ticks:[0,1500,3000,4500,6000], max:6200, barW:38,
      groups:[ { name:"Before", values:before, color:"var(--s2)" }, { name:"After", values:after, color:"var(--s1)" } ],
      fmtV:v => v + " ms", fmtT:v => v + "ms", y:{ label:"milliseconds" } }),
    legend:[{name:"Before — 8.0 s total",color:"var(--s2)",sq:true},{name:"After — 2.0 s total",color:"var(--s1)",sq:true}],
    table: tableOf(["Stage","Before (ms)","After (ms)","Lever"],
      [["Queue","1200","150","continuous batching, admission control"],["Prefill","900","320","prefix caching, chunked prefill"],["Decode","5600","1350","speculative decoding, GQA, int8"],["Network","300","180","regional deployment, streaming"]]) });
} };

/* ---------- transformer block diagram ---------- */
VIZ.transformer = { html(){
  const box = (x, y, w, h, label, sub, fill, stroke) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="${fill}" stroke="${stroke}" stroke-width="1.4"/>
     <text x="${x + w/2}" y="${y + (sub ? h/2 - 3 : h/2 + 4)}" text-anchor="middle" class="dlab" fill="var(--ink)" style="font-size:12px">${label}</text>
     ${sub ? `<text x="${x + w/2}" y="${y + h/2 + 12}" text-anchor="middle" class="axl" fill="var(--muted)">${sub}</text>` : ""}`;
  const arr = (x, y1, y2) => `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="var(--line-2)" stroke-width="1.6" marker-end="url(#tarr)"/>`;
  let s = `<svg viewBox="0 0 660 430" role="img" aria-label="Diagram of one decoder-only transformer block">
    <defs><marker id="tarr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="var(--line-2)"/></marker></defs>`;
  s += box(200, 14, 260, 34, "Token + position", "x : (batch, seq, d_model)", "var(--surface-2)", "var(--line-2)");
  s += arr(330, 48, 66);
  // the repeated block
  s += `<rect x="112" y="66" width="436" height="256" rx="10" fill="none" stroke="var(--accent-edge)" stroke-width="1.4" stroke-dasharray="5 4"/>`;
  s += `<text x="122" y="84" class="axl" fill="var(--accent-ink)">× N layers</text>`;
  s += box(230, 92, 200, 28, "RMSNorm", "", "var(--surface)", "var(--line-2)");
  s += arr(330, 120, 134);
  s += box(200, 134, 260, 42, "Multi-head self-attention", "causal mask · GQA · RoPE", "var(--accent-wash)", "var(--accent)");
  s += arr(330, 176, 192);
  s += box(262, 192, 136, 26, "+  residual", "", "var(--surface-2)", "var(--line-2)");
  s += arr(330, 218, 232);
  s += box(230, 232, 200, 28, "RMSNorm", "", "var(--surface)", "var(--line-2)");
  s += arr(330, 260, 274);
  s += box(200, 274, 260, 42, "Feed-forward (SwiGLU)", "d_model → 4·d_model → d_model", "var(--accent-wash)", "var(--accent)");
  // residual skip arcs
  s += `<path d="M196 106 C160 106 160 200 250 205" fill="none" stroke="var(--s3)" stroke-width="1.6" stroke-dasharray="4 3"/>`;
  s += `<path d="M196 246 C150 246 150 350 262 352" fill="none" stroke="var(--s3)" stroke-width="1.6" stroke-dasharray="4 3"/>`;
  s += `<text x="128" y="160" class="axl" fill="var(--s3)">skip</text><text x="118" y="306" class="axl" fill="var(--s3)">skip</text>`;
  s += arr(330, 316, 340);
  s += box(262, 340, 136, 26, "+  residual", "", "var(--surface-2)", "var(--line-2)");
  s += arr(330, 366, 380);
  s += box(200, 380, 260, 38, "Final norm → LM head → softmax", "logits : (batch, seq, vocab)", "var(--surface-2)", "var(--line-2)");
  // side annotations
  s += `<text x="470" y="158" class="axl" fill="var(--muted)">mixes across positions</text>`;
  s += `<text x="470" y="298" class="axl" fill="var(--muted)">mixes across features</text>`;
  s += `<text x="470" y="312" class="axl" fill="var(--muted)">≈ ⅔ of all parameters</text>`;
  return fig({ title:"One decoder-only transformer block",
    sub:"Attention is the only operation that moves information between positions; the feed-forward layer processes each position on its own.",
    body: s + "</svg>" });
} };

/* ---------- RAG pipeline ---------- */
VIZ.rag = { html(){
  const stage = (x, w, t, sub, n, fill) =>
    `<rect x="${x}" y="58" width="${w}" height="56" rx="8" fill="${fill}" stroke="var(--line-2)" stroke-width="1.3"/>
     <text x="${x + w/2}" y="80" text-anchor="middle" class="dlab" fill="var(--ink)" style="font-size:12px">${t}</text>
     <text x="${x + w/2}" y="95" text-anchor="middle" class="axl" fill="var(--muted)">${sub}</text>
     <text x="${x + w/2}" y="132" text-anchor="middle" class="dlab" fill="var(--accent-ink)">${n}</text>`;
  const ar = x => `<line x1="${x}" y1="86" x2="${x + 18}" y2="86" stroke="var(--line-2)" stroke-width="1.6" marker-end="url(#rarr)"/>`;
  let s = `<svg viewBox="0 0 660 200" role="img" aria-label="RAG pipeline from query to grounded answer">
    <defs><marker id="rarr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="var(--line-2)"/></marker></defs>
    <text x="8" y="26" class="axl" fill="var(--muted)">candidates surviving each stage</text>`;
  s += stage(8, 92, "Query", "rewrite", "1", "var(--surface-2)");
  s += ar(102);
  s += stage(124, 118, "Hybrid search", "BM25 ∥ dense", "500M → 50", "var(--surface)");
  s += ar(244);
  s += stage(266, 104, "ACL filter", "pre-filter", "50", "var(--surface)");
  s += ar(372);
  s += stage(394, 110, "Rerank", "cross-encoder", "50 → 5", "var(--accent-wash)");
  s += ar(506);
  s += stage(528, 124, "Generate", "cite + verify", "1 answer", "var(--surface-2)");
  // failure annotations
  const fail = (x, txt) => `<text x="${x}" y="164" text-anchor="middle" class="axl" fill="var(--crit)">${txt}</text>`;
  s += `<line x1="8" y1="146" x2="652" y2="146" stroke="var(--line)"/>`;
  s += fail(183, "retrieval miss");
  s += fail(318, "permission leak");
  s += fail(449, "lost in the middle");
  s += fail(590, "unsupported claim");
  s += `<text x="8" y="184" class="axl" fill="var(--muted)">measure recall@50 here ───────────── and faithfulness here</text>`;
  return fig({ title:"The RAG pipeline, and where each stage fails",
    sub:"Retrieve wide, filter by permission, rerank narrow, then generate. Evaluate the retrieval and generation halves separately.",
    body: s + "</svg>" });
} };

/* ===== p10.html ===== */

/* ============================================================
   INTERACTIVE VISUALISATIONS
   ============================================================ */
const slider = (id, label, min, max, step, val, unit) =>
  `<div class="ctl"><label for="${id}">${label}</label>
   <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}">
   <output for="${id}" id="${id}-o">${val}${unit || ""}</output></div>`;

/* ---------- gradient descent ---------- */
VIZ.gradDescent = { html(){
  return `<div data-viz="gradDescent">` + fig({ title:"Gradient descent on a non-convex loss",
    sub:"Raise the learning rate and the steps overshoot; lower it and they crawl. Move the start and the same rule finds a different minimum.",
    pid:"gd-plot",
    body:`<div id="gd-svg"></div>`,
    controls: slider("gd-lr", "Learning rate", 0.01, 0.4, 0.005, 0.08) +
              slider("gd-x0", "Start w", -1.8, 1.8, 0.1, 1.5) +
              slider("gd-n", "Steps", 1, 40, 1, 18) +
              `<span class="chip" id="gd-status">converging</span>`
  }) + `</div>`;
}, init(el){
  const f  = x => 0.6*x*x*x*x - 1.4*x*x + 0.3*x + 1.2;
  const fp = x => 2.4*x*x*x - 2.8*x + 0.3;
  const curve = []; for (let x = -1.9; x <= 1.9001; x += 0.05) curve.push([r2(x), f(x)]);
  const draw = () => {
    const lr = +$("#gd-lr", el).value, x0 = +$("#gd-x0", el).value, n = +$("#gd-n", el).value;
    $("#gd-lr-o", el).textContent = lr.toFixed(3);
    $("#gd-x0-o", el).textContent = x0.toFixed(1);
    $("#gd-n-o", el).textContent = n;
    let x = x0; const traj = [[x, f(x)]]; let diverged = false;
    for (let i = 0; i < n; i++){
      x = x - lr * fp(x);
      if (!isFinite(x) || Math.abs(x) > 1.9){ diverged = true; x = Math.sign(x || 1) * 1.9; traj.push([x, f(x)]); break; }
      traj.push([r2(x), f(x)]);
    }
    const st = $("#gd-status", el);
    const last = traj[traj.length - 1];
    st.textContent = diverged ? "diverged — η too large" : Math.abs(fp(last[0])) < 0.05 ? "converged at w = " + last[0].toFixed(2) : "still descending";
    st.className = "chip " + (diverged ? "hard" : Math.abs(fp(last[0])) < 0.05 ? "easy" : "med");
    $("#gd-svg", el).innerHTML = lineChart({ w:660, h:250, hover:false,
      x:{ dom:[-1.9,1.9], ticks:[-1.5,-1,-0.5,0,0.5,1,1.5], label:"weight w" },
      y:{ dom:[0,5], ticks:[0,1,2,3,4,5], label:"loss L(w)" },
      series:[ { name:"L(w)", pts:curve, color:"var(--line-2)", wid:2 },
               { name:"path", pts:traj, color:"var(--s2)", wid:1.6, dash:"3 3", dot:true } ],
      marks:[ { x:traj[0][0], y:traj[0][1], text:"start", color:"var(--s4)", dy:-10 },
              { x:last[0], y:last[1], text:diverged ? "diverged" : "step " + (traj.length - 1), color:"var(--s2)", dx:8, dy:-10 },
              { x:-1.128, y:f(-1.128), text:"global min", color:"var(--s3)", dx:6, dy:16 },
              { x:1.022, y:f(1.022), text:"local min", color:"var(--s6)", dx:6, dy:16 } ] });
  };
  el.addEventListener("input", draw); draw();
  document.addEventListener("themechange", draw);
} };

/* ---------- threshold / ROC ---------- */
VIZ.roc = { html(){
  return `<div data-viz="roc">` + fig({ title:"One model, many operating points",
    sub:"Scores from a fitted classifier. Move the threshold and watch precision trade against recall while AUC — a property of the ranking — never moves.",
    pid:"roc-plot", body:`<div class="vizrow"><div id="roc-svg"></div><div id="roc-side"></div></div>`,
    controls: slider("roc-t", "Threshold", 0.05, 0.95, 0.01, 0.5) +
      `<div class="ctl"><label for="roc-prev">Positives</label>
       <select id="roc-prev"><option value="0.3">30% (balanced-ish)</option><option value="0.1" selected>10%</option><option value="0.01">1% (rare)</option></select></div>`
  }) + `</div>`;
}, init(el){
  const N = 10000, muN = 0.35, muP = 0.66, sd = 0.14;
  const rate = (mu, t) => 1 - normCdf((t - mu) / sd);
  const draw = () => {
    const t = +$("#roc-t", el).value, prev = +$("#roc-prev", el).value;
    $("#roc-t-o", el).textContent = t.toFixed(2);
    const P = N * prev, Ng = N - P;
    const tp = P * rate(muP, t), fn = P - tp, fp = Ng * rate(muN, t), tn = Ng - fp;
    const prec = tp + fp > 0 ? tp / (tp + fp) : 0, rec = tp / P, f1 = prec + rec > 0 ? 2 * prec * rec / (prec + rec) : 0;
    const pts = []; for (let s = 1.02; s >= -0.02; s -= 0.02) pts.push([rate(muN, s), rate(muP, s)]);
    $("#roc-svg", el).innerHTML = lineChart({ w:380, h:300, hover:false, pad:{l:46,r:22,t:14,b:40},
      x:{ dom:[0,1], ticks:[0,0.25,0.5,0.75,1], label:"False positive rate" },
      y:{ dom:[0,1], ticks:[0,0.25,0.5,0.75,1], label:"True positive rate" },
      series:[ { name:"chance", pts:[[0,0],[1,1]], color:"var(--line-2)", dash:"4 4", wid:1.5 },
               { name:"ROC", pts, color:"var(--s1)", wid:2.5, area:true } ],
      marks:[{ x:rate(muN, t), y:rate(muP, t), text:"you are here", color:"var(--s2)", dx:8, dy:-8 }] });
    const n = v => Math.round(v).toLocaleString();
    $("#roc-side", el).innerHTML = `
      <div class="cmx" role="table" aria-label="Confusion matrix">
        <div class="hd"></div><div class="hd">pred +</div><div class="hd">pred −</div>
        <div class="hd" style="align-self:center">real +</div><div class="tp">${n(tp)}<br><span style="font-size:9px">TP</span></div><div class="fn">${n(fn)}<br><span style="font-size:9px">FN</span></div>
        <div class="hd" style="align-self:center">real −</div><div class="fp">${n(fp)}<br><span style="font-size:9px">FP</span></div><div>${n(tn)}<br><span style="font-size:9px">TN</span></div>
      </div>
      <div class="metrics">
        <div><b>${(prec*100).toFixed(1)}%</b><span>Precision</span></div>
        <div><b>${(rec*100).toFixed(1)}%</b><span>Recall</span></div>
        <div><b>${f1.toFixed(3)}</b><span>F1</span></div>
        <div><b>0.941</b><span>ROC-AUC</span></div>
      </div>
      <p style="font-size:12.5px;color:var(--ink-2);margin-top:12px">At ${(prev*100)}% prevalence, flagging ${n(tp+fp)} cases catches ${n(tp)} of ${n(P)} real ones.</p>`;
  };
  el.addEventListener("input", draw); el.addEventListener("change", draw); draw();
  document.addEventListener("themechange", draw);
} };

/* ---------- attention matrix ---------- */
VIZ.attention = { html(){
  return `<div data-viz="attention">` + fig({ title:"An attention head, row by row",
    sub:"Each row is one query token's distribution over the tokens it may see. The causal mask blanks everything to the right of the diagonal.",
    pid:"att-plot", body:`<div class="matrix-wrap" id="att-svg"></div>`,
    controls:`<div class="ctl"><label>Head</label>
      <button class="pill-btn" data-head="0" aria-pressed="true">previous-token</button>
      <button class="pill-btn" data-head="1" aria-pressed="false">syntactic</button>
      <button class="pill-btn" data-head="2" aria-pressed="false">broad context</button></div>`
  }) + `</div>`;
}, init(el){
  const toks = ["The","cat","that","the","dog","chased","ran","away"];
  const target = [0, 0, 1, 3, 3, 4, 1, 6];   // what each token syntactically depends on
  const build = h => toks.map((_, i) => {
    const row = toks.map((_, j) => {
      if (j > i) return 0;
      if (h === 0) return Math.exp(-2.2 * (i - j)) + 0.02;
      if (h === 1) return (j === target[i] ? 3.2 : 0.25 * Math.exp(-0.7 * (i - j))) + 0.02;
      return 1 + 0.55 * (j / Math.max(1, i)) + 0.02;
    });
    const s = row.reduce((a, b) => a + b, 0);
    return row.map(v => s ? v / s : 0);
  });
  const draw = () => {
    const h = +($(".pill-btn[aria-pressed='true']", el) || {}).dataset?.head || 0;
    const m = build(h);
    $("#att-svg", el).innerHTML = heat({ cols:toks, rows:toks, values:m, cell:38, labelW:64, topH:24, showVal:true, zeroBlank:true, max:1,
      fmtV:v => v >= 0.995 ? "1.0" : v.toFixed(2).slice(1),
      tip:(i, j, v) => `"${toks[i]}" attends to "${toks[j]}"~|~weight ${v.toFixed(3)}${j > i ? " (masked)" : ""}` })
      + seqLegend("0", "1", "attention weight");
  };
  el.addEventListener("click", e => {
    const b = e.target.closest(".pill-btn"); if (!b) return;
    $$(".pill-btn", el).forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    draw();
  });
  draw();
  document.addEventListener("themechange", draw);
} };

/* ---------- sampling / decoding ---------- */
VIZ.sampling = { html(){
  return `<div data-viz="sampling">` + fig({ title:"Decoding: the same logits, different distributions",
    sub:"Next-token logits after “The capital of France is”. Temperature reshapes the distribution; top-p decides how much of the tail survives.",
    pid:"smp-plot", body:`<div id="smp-svg"></div>`,
    controls: slider("smp-t", "Temperature", 0.1, 2, 0.05, 1) + slider("smp-p", "Top-p", 0.1, 1, 0.01, 0.95) +
      `<span class="chip" id="smp-ent">entropy</span>`
  }) + `</div>`;
}, init(el){
  const toks = [[" Paris",8.2],[" the",4.1],[" a",3.6],[" located",3.2],[" home",2.9],[" known",2.6],[" one",2.2],[" now",1.8],[" famous",1.5],[" situated",1.2]];
  const draw = () => {
    const T = +$("#smp-t", el).value, topP = +$("#smp-p", el).value;
    $("#smp-t-o", el).textContent = T.toFixed(2);
    $("#smp-p-o", el).textContent = topP.toFixed(2);
    const mx = Math.max.apply(null, toks.map(t => t[1] / T));
    const ex = toks.map(t => Math.exp(t[1] / T - mx));
    const z = ex.reduce((a, b) => a + b, 0);
    const probs = ex.map(v => v / z);
    let cum = 0; const keep = probs.map(p => { const k = cum < topP; cum += p; return k; });
    const kz = probs.reduce((a, p, i) => a + (keep[i] ? p : 0), 0);
    const ent = -probs.reduce((a, p) => a + (p > 1e-9 ? p * Math.log2(p) : 0), 0);
    $("#smp-ent", el).textContent = "entropy " + ent.toFixed(2) + " bits · " + keep.filter(Boolean).length + " tokens kept";
    $("#smp-svg", el).innerHTML = barsH({ w:660, rh:24, gap:6, labelW:88, max:1, ticks:[0,0.25,0.5,0.75,1], fmtT:t => t,
      rows: toks.map((t, i) => ({
        label:'"' + t[0].trim() + '"',
        value:probs[i],
        color: keep[i] ? "var(--s1)" : "var(--line-2)",
        right:(probs[i] * 100).toFixed(1) + "%",
        tip:`logit ${t[1]} → p ${(probs[i]*100).toFixed(2)}%~|~${keep[i] ? "kept · renormalised to " + ((probs[i]/kz)*100).toFixed(1) + "%" : "cut by top-p"}`
      })) });
  };
  el.addEventListener("input", draw); draw();
  document.addEventListener("themechange", draw);
} };

/* ---------- tokenizer ---------- */
VIZ.tokenizer = { html(){
  const sample = "Fine-tuning a 7B model with QLoRA costs about £12 — tokenisation isn't free though!";
  return `<div data-viz="tokenizer">` + fig({ title:"How text becomes tokens",
    sub:"A BPE-style split: common words are single tokens, rare ones fracture, and punctuation and numbers cost more than you expect. Approximate, but the shape is right.",
    body:`<div style="padding:12px 14px"><textarea class="notes" id="tk-in" style="min-height:74px" aria-label="Text to tokenise">${esc(sample)}</textarea>
      <div id="tk-out" style="margin-top:12px"></div></div>`,
    controls:`<span class="chip" id="tk-stat"></span>`
  }) + `</div>`;
}, init(el){
  const COMMON = new Set(("the a an and or but if then of to in on at for with from by is are was were be been it its this that these those you your we our they their he she as not no yes can will would should could about over under into out up down more most less least new old good bad model models data train training test learn learning token tokens text word words free about costs").split(" "));
  const draw = () => {
    const txt = $("#tk-in", el).value;
    const raw = txt.match(/\s*\S+|\s+/g) || [];
    const out = [];
    raw.forEach(piece => {
      const lead = piece.match(/^\s*/)[0];
      const word = piece.slice(lead.length);
      if (!word){ out.push(piece); return; }
      const core = word.replace(/[^A-Za-z]/g, "");
      if (core && core.length <= 8 && COMMON.has(core.toLowerCase()) && core === word){ out.push(lead + word); return; }
      // split off punctuation, then chunk the remainder
      const parts = word.match(/[A-Za-z]+|[0-9]+|[^A-Za-z0-9]/g) || [word];
      let first = true;
      parts.forEach(p => {
        if (/^[0-9]+$/.test(p)){ for (let i = 0; i < p.length; i += 3) out.push((first ? lead : "") + p.slice(i, i + 3)), first = false; return; }
        if (/^[A-Za-z]+$/.test(p) && p.length > 5){
          const n = Math.ceil(p.length / 4), size = Math.ceil(p.length / n);
          for (let i = 0; i < p.length; i += size) out.push((first ? lead : "") + p.slice(i, i + size)), first = false;
          return;
        }
        out.push((first ? lead : "") + p); first = false;
      });
    });
    const cols = ["var(--s1)","var(--s3)","var(--s7)","var(--s2)","var(--s5)"];
    $("#tk-out", el).innerHTML = out.map((t, i) =>
      `<span class="tok" style="background:color-mix(in srgb, ${cols[i % 5]} 16%, transparent);border-color:color-mix(in srgb, ${cols[i % 5]} 45%, transparent)">${esc(t.replace(/ /g, "␣"))}</span>`).join("");
    $("#tk-stat", el).textContent = `${out.length} tokens · ${txt.length} characters · ${(txt.length / Math.max(1, out.length)).toFixed(1)} chars per token`;
  };
  el.addEventListener("input", draw); draw();
} };

/* ---------- embedding space ---------- */
VIZ.embed = { html(){
  return `<div data-viz="embed">` + fig({ title:"Similarity is geometry",
    sub:"A 2-D stand-in for a 1536-D space. Pick a query and the three nearest vectors light up — this is exactly what a vector index returns.",
    pid:"emb-plot", body:`<div class="vizrow"><div id="emb-svg"></div><div id="emb-side"></div></div>`,
    controls:`<div class="ctl"><label for="emb-q">Query</label><select id="emb-q"></select></div><span class="chip" id="emb-note">cosine on normalised vectors</span>`
  }) + `</div>`;
}, init(el){
  const PT = [
    ["apple",0.8,3.2,0],["banana",1.25,3.62,0],["mango",0.62,3.85,0],["grape",1.42,3.02,0],["peach",1.0,3.45,0],
    ["dog",3.42,3.3,1],["cat",3.82,3.62,1],["horse",3.18,3.92,1],["wolf",4.12,3.12,1],["rabbit",3.6,3.05,1],
    ["python",1.02,1.0,2],["javascript",1.52,0.72,2],["compiler",0.7,0.62,2],["function",1.32,1.32,2],["debugger",0.62,1.18,2],
    ["Paris",3.62,1.12,3],["Tokyo",4.02,0.8,3],["London",3.3,0.72,3],["Berlin",3.92,1.42,3],["Madrid",3.42,1.45,3]
  ];
  const GRP = ["fruit","animals","programming","cities"];
  const COL = ["var(--s3)","var(--s2)","var(--s1)","var(--s4)"];
  const sel = $("#emb-q", el);
  sel.innerHTML = PT.map((p, i) => `<option value="${i}">${p[0]}</option>`).join("");
  const draw = () => {
    const qi = +sel.value;
    const q = PT[qi];
    const d = PT.map((p, i) => ({ i, d: Math.hypot(p[1] - q[1], p[2] - q[2]) })).filter(o => o.i !== qi).sort((a, b) => a.d - b.d);
    const near = d.slice(0, 3);
    const nearSet = new Set(near.map(o => o.i));
    const X = scale([0.2, 4.6], [40, 356]), Y = scale([0.3, 4.3], [252, 22]);
    let s = `<svg viewBox="0 0 380 280" role="img" aria-label="Two-dimensional embedding space with nearest neighbours highlighted">`;
    [1,2,3,4].forEach(g => { s += `<line x1="40" y1="${Y(g)}" x2="356" y2="${Y(g)}" stroke="var(--grid)"/><line x1="${X(g)}" y1="22" x2="${X(g)}" y2="252" stroke="var(--grid)"/>`; });
    near.forEach(o => { s += `<line x1="${X(q[1])}" y1="${Y(q[2])}" x2="${X(PT[o.i][1])}" y2="${Y(PT[o.i][2])}" stroke="var(--ink-2)" stroke-width="1.2" stroke-dasharray="3 3"/>`; });
    PT.forEach((p, i) => {
      const on = i === qi, nb = nearSet.has(i);
      s += `<circle cx="${X(p[1])}" cy="${Y(p[2])}" r="${on ? 7 : nb ? 5.5 : 4}" fill="${on ? "var(--ink)" : COL[p[3]]}" stroke="var(--surface)" stroke-width="2" tabindex="0" data-tip="${esc(p[0] + "~|~" + GRP[p[3]] + (nb ? " · neighbour " + d.findIndex(o => o.i === i) : ""))}"/>`;
      if (on || nb) s += `<text class="dlab" x="${X(p[1])}" y="${Y(p[2]) - 10}" text-anchor="middle" fill="var(--ink)" style="pointer-events:none">${esc(p[0])}</text>`;
    });
    s += `</svg>`;
    $("#emb-svg", el).innerHTML = s;
    $("#emb-side", el).innerHTML = `<div style="font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:7px">top-3 for “${esc(q[0])}”</div>` +
      near.map((o, k) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-top:${k ? "1px solid var(--line)" : "0"};font-size:13px">
        <span><b style="font-weight:600">${esc(PT[o.i][0])}</b> <span class="tag">${GRP[PT[o.i][3]]}</span></span>
        <span style="font-family:var(--mono);font-size:12px;color:var(--muted)">${o.d.toFixed(2)}</span></div>`).join("") +
      `<p style="font-size:12.5px;color:var(--ink-2);margin-top:12px">Neighbours come from the same semantic cluster — no labels were used to build it.</p>`;
  };
  sel.addEventListener("change", draw); draw();
  document.addEventListener("themechange", draw);
} };

function mountViz(root){
  $$("[data-viz]", root).forEach(el => {
    const v = VIZ[el.getAttribute("data-viz")];
    if (v && v.init && !el.dataset.mounted){ el.dataset.mounted = "1"; try { v.init(el); } catch(e){} }
  });
}
function vizHTML(key){
  const v = VIZ[key];
  if (!v) return "";
  try { return v.html(); } catch(e){ return ""; }
}

/* ===== p10b.html ===== */

/* ============================================================
   INTERACTIVE VISUALISATIONS — time series track (p06f)
   ============================================================ */

/* ---------- autocorrelation explorer ---------- */
VIZ.tsAcf = { html(){
  return `<div data-viz="tsAcf">` + fig({ title:"Read a series through its autocorrelation",
    sub:"A synthetic monthly series: trend + yearly seasonality + AR(1) noise. Change the ingredients and watch the ACF change shape, then difference it to see what a model would actually be fitting.",
    pid:"acf-plot",
    body:`<div id="acf-series"></div><div id="acf-bars"></div>`,
    controls: slider("acf-tr", "Trend / month", 0, 0.3, 0.01, 0.12) +
              slider("acf-sa", "Seasonal amplitude", 0, 4, 0.1, 2) +
              slider("acf-phi", "AR(1) φ", -0.9, 0.95, 0.05, 0.5) +
              `<div class="ctl"><label for="acf-diff">Transform</label>
               <select id="acf-diff"><option value="0" selected>none</option><option value="1">first difference</option><option value="12">seasonal difference (12)</option><option value="13">both</option></select></div>
               <span class="chip" id="acf-status" aria-live="polite">—</span>`,
    table:`<div id="acf-vt"></div>`
  }) + `</div>`;
}, init(el){
  const N = 144, LAGS = 36;
  // fixed seeded shocks so the figure is stable between redraws
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const z = []; for (let i = 0; i < N; i++){ const u = Math.max(rnd(), 1e-9), v = rnd(); z.push(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)); }
  const acf = (y, K) => {
    const n = y.length, m = y.reduce((a, b) => a + b, 0) / n;
    const c0 = y.reduce((a, v) => a + (v - m) * (v - m), 0);
    const out = [];
    for (let k = 1; k <= K; k++){ let c = 0; for (let t = k; t < n; t++) c += (y[t] - m) * (y[t - k] - m); out.push(c0 ? c / c0 : 0); }
    return out;
  };
  const draw = () => {
    const tr = +$("#acf-tr", el).value, sa = +$("#acf-sa", el).value, phi = +$("#acf-phi", el).value, d = +$("#acf-diff", el).value;
    $("#acf-tr-o", el).textContent = tr.toFixed(2);
    $("#acf-sa-o", el).textContent = sa.toFixed(1);
    $("#acf-phi-o", el).textContent = phi.toFixed(2);
    let e = 0; const raw = [];
    for (let t = 0; t < N; t++){ e = phi * e + z[t]; raw.push(10 + tr * t + sa * Math.sin(2 * Math.PI * t / 12) + e); }
    let y = raw.slice(), off = 0;
    if (d === 1 || d === 13){ y = y.slice(1).map((v, i) => v - y[i]); off += 1; }
    if (d === 12 || d === 13){ y = y.slice(12).map((v, i) => v - y[i]); off += 12; }
    const r = acf(y, LAGS), band = 1.96 / Math.sqrt(y.length);

    // top: the series being analysed
    const pts = y.map((v, i) => [i + off, r2(v)]);
    const lo = Math.min.apply(null, y), hi = Math.max.apply(null, y), pad = (hi - lo) * 0.08 || 1;
    const yl = Math.floor(lo - pad), yh = Math.ceil(hi + pad);
    const step = Math.max(1, Math.ceil((yh - yl) / 4));
    const yt = []; for (let v = yl; v <= yh; v += step) yt.push(v);
    $("#acf-series", el).innerHTML = lineChart({ w:660, h:170, title:"series",
      x:{ dom:[0, N - 1], ticks:[0, 24, 48, 72, 96, 120], label:"month" },
      y:{ dom:[yl, yh], ticks:yt, label:d ? "differenced value" : "value" },
      series:[{ name:d ? "differenced" : "series", pts, color:"var(--s1)", wid:1.6 }], fmtY:v => v.toFixed(2), xName:"month" });

    // bottom: ACF stems with the ±1.96/√n band
    const w = 660, h = 200, p = { l:48, r:20, t:14, b:36 };
    const X = scale([0, LAGS + 1], [p.l, w - p.r]), Y = scale([-1, 1], [h - p.b, p.t]);
    let s = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="autocorrelation function, lags 1 to ${LAGS}">`;
    [-1, -0.5, 0, 0.5, 1].forEach(t => {
      s += `<line x1="${p.l}" y1="${Y(t)}" x2="${w - p.r}" y2="${Y(t)}" stroke="var(--grid)" stroke-width="1"/>`;
      s += `<text class="axt" x="${p.l - 7}" y="${Y(t) + 3.5}" text-anchor="end">${t}</text>`;
    });
    s += `<rect x="${p.l}" y="${Y(band)}" width="${w - p.l - p.r}" height="${Y(-band) - Y(band)}" fill="var(--s3)" opacity=".12"/>`;
    s += `<line x1="${p.l}" y1="${Y(0)}" x2="${w - p.r}" y2="${Y(0)}" stroke="var(--axis)" stroke-width="1"/>`;
    [6, 12, 18, 24, 30, 36].forEach(k => { s += `<text class="axt" x="${X(k)}" y="${h - p.b + 15}" text-anchor="middle">${k}</text>`; });
    r.forEach((v, i) => {
      const k = i + 1, sig = Math.abs(v) > band, col = sig ? "var(--s2)" : "var(--muted)";
      s += `<line x1="${X(k)}" y1="${Y(0)}" x2="${X(k)}" y2="${Y(v)}" stroke="${col}" stroke-width="2.4" stroke-linecap="round"/>`;
      s += `<circle cx="${X(k)}" cy="${Y(v)}" r="3.4" fill="${col}" stroke="var(--surface)" stroke-width="1.5" tabindex="0" data-tip="${esc("lag " + k + "~|~ACF " + v.toFixed(3) + (sig ? " — outside the band" : " — inside the band"))}"/>`;
    });
    s += `<text class="axl" x="${(p.l + w - p.r) / 2}" y="${h - 3}" text-anchor="middle">lag (months)</text>`;
    s += `<text class="axl" x="${-(p.t + h - p.b) / 2}" y="11" text-anchor="middle" transform="rotate(-90)">ACF</text>`;
    s += `<text class="dlab" x="${w - p.r - 4}" y="${Y(band) - 5}" text-anchor="end" fill="var(--s3)">±1.96/√n = ${band.toFixed(2)}</text>`;
    $("#acf-bars", el).innerHTML = s + "</svg>";

    // verdict, in the order you would reason about it
    const slow = r[0] > 0.8 && r[5] > 0.6 && r[11] > 0.45;
    const seas = r[11] > band && r[11] > r[5] + 0.15;
    const white = r.filter(v => Math.abs(v) > band).length <= 2;
    const st = $("#acf-status", el);
    st.textContent = slow ? "slow decay — trend or unit root: difference it"
      : seas ? "spike at lag 12 — yearly seasonality remains"
      : white ? "≈ white noise — nothing linear left to model"
      : r[0] < -0.35 ? "negative lag-1 — possibly over-differenced"
      : "short-memory structure — an AR/MA model can fit this";
    st.className = "chip " + (white ? "easy" : slow ? "hard" : "med");
    const show = [1, 2, 3, 6, 12, 24, 36];
    $("#acf-vt", el).innerHTML = tableOf(["Lag", "ACF", "Significant?"],
      show.map(k => [String(k), r[k - 1].toFixed(3), Math.abs(r[k - 1]) > band ? "yes" : "no"]));
  };
  el.addEventListener("input", draw); el.addEventListener("change", draw); draw();
  document.addEventListener("themechange", draw);
} };

/* ---------- backtest splits ---------- */
VIZ.tsBacktest = { html(){
  return `<div data-viz="tsBacktest">` + fig({ title:"How the data is split decides what the score means",
    sub:"Each row is one fold over the same 100 time steps. Walk-forward only ever tests on the future; random K-fold tests on points whose neighbours were in training, which is why its error looks so good.",
    pid:"bt-plot",
    body:`<div id="bt-svg"></div>`,
    legend:[{ name:"train", color:"var(--s1)", sq:true }, { name:"gap", color:"var(--line-2)", sq:true }, { name:"test", color:"var(--s4)", sq:true }, { name:"unused", color:"var(--surface-3)", sq:true }],
    controls: `<div class="ctl"><label for="bt-mode">Scheme</label>
               <select id="bt-mode"><option value="exp" selected>walk-forward, expanding</option><option value="slide">walk-forward, sliding</option><option value="rand">random K-fold (wrong)</option></select></div>` +
              slider("bt-k", "Folds", 3, 8, 1, 5) +
              slider("bt-h", "Horizon", 4, 16, 1, 8) +
              slider("bt-g", "Gap", 0, 6, 1, 0),
    table:`<div id="bt-vt"></div>`
  }) + `</div>`;
}, init(el){
  const T = 100;
  const draw = () => {
    const mode = $("#bt-mode", el).value, K = +$("#bt-k", el).value, H = +$("#bt-h", el).value, G = +$("#bt-g", el).value;
    $("#bt-k-o", el).textContent = K; $("#bt-h-o", el).textContent = H; $("#bt-g-o", el).textContent = G;
    ["bt-h", "bt-g"].forEach(id => { $("#" + id, el).disabled = mode === "rand"; });
    const folds = [];
    if (mode === "rand"){
      // deterministic shuffle of the steps into K folds
      const idx = Array.from({ length:T }, (_, i) => i);
      let sd = 11; const rnd = () => { sd = (sd * 1103515245 + 12345) % 2147483648; return sd / 2147483648; };
      for (let i = T - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
      for (let f = 0; f < K; f++){
        const test = new Set(idx.filter((_, i) => i % K === f));
        folds.push(Array.from({ length:T }, (_, t) => test.has(t) ? "test" : "train"));
      }
    } else {
      const minTrain = 30, last = T - H;                  // last origin leaves room for H test steps
      for (let f = 0; f < K; f++){
        const origin = Math.round(minTrain + G + (last - minTrain - G) * (K === 1 ? 1 : f / (K - 1)));
        const trEnd = origin - G, trStart = mode === "slide" ? Math.max(0, trEnd - minTrain) : 0;
        folds.push(Array.from({ length:T }, (_, t) =>
          t >= origin && t < origin + H ? "test" : t >= trEnd && t < origin ? "gap" : t >= trStart && t < trEnd ? "train" : "unused"));
      }
    }
    const COL = { train:"var(--s1)", gap:"var(--line-2)", test:"var(--s4)", unused:"var(--surface-3)" };
    const w = 660, rh = 22, gapY = 8, p = { l:62, r:14, t:10, b:30 };
    const h = p.t + p.b + K * (rh + gapY);
    const X = scale([0, T], [p.l, w - p.r]), cw = (w - p.l - p.r) / T;
    let s = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${K} folds of a ${mode === "rand" ? "random K-fold" : "walk-forward"} split">`;
    folds.forEach((row, f) => {
      const y = p.t + f * (rh + gapY);
      s += `<text class="axt" x="${p.l - 8}" y="${y + rh / 2 + 3.5}" text-anchor="end">fold ${f + 1}</text>`;
      // merge runs of the same role into one rect so each run is one focusable mark
      let a = 0;
      for (let t = 1; t <= T; t++){
        if (t === T || row[t] !== row[a]){
          const role = row[a];
          s += `<rect x="${X(a) + 0.3}" y="${y}" width="${Math.max(0.6, (t - a) * cw - 0.6)}" height="${rh}" rx="2" fill="${COL[role]}"${role === "unused" ? "" : ` tabindex="0" data-tip="${esc("fold " + (f + 1) + " · " + role + "~|~steps " + a + "–" + (t - 1) + " (" + (t - a) + ")")}"`}/>`;
          a = t;
        }
      }
    });
    [0, 20, 40, 60, 80, 100].forEach(v => { s += `<text class="axt" x="${X(v)}" y="${h - p.b + 15}" text-anchor="middle">${v}</text>`; });
    s += `<text class="axl" x="${(p.l + w - p.r) / 2}" y="${h - 3}" text-anchor="middle">time step →</text>`;
    $("#bt-svg", el).innerHTML = s + "</svg>";
    $("#bt-vt", el).innerHTML = tableOf(["Fold", "Train steps", "Gap", "Test steps", "Test after all training?"], folds.map((row, f) => {
      const tr = row.map((r, t) => r === "train" ? t : -1).filter(t => t >= 0), te = row.map((r, t) => r === "test" ? t : -1).filter(t => t >= 0);
      return [String(f + 1), String(tr.length), String(row.filter(r => r === "gap").length), String(te.length), Math.min.apply(null, te) > Math.max.apply(null, tr) ? "yes" : "no — leaks"];
    }));
  };
  el.addEventListener("input", draw); el.addEventListener("change", draw); draw();
  document.addEventListener("themechange", draw);
} };

/* ============================================================
   Added with the Multimodal, Reasoning and GPU tracks
   ============================================================ */

/* ---------- image tokens in a VLM (mm3) ---------- */
VIZ.vlmTokens = { html(){
  return `<div data-viz="vlmTokens">` + fig({ title:"What one image costs inside a vision-language model",
    sub:"Four ways to turn the same image into LLM tokens. Fixed-resolution encoders stay cheap however large the image — by shrinking it until small text is gone. Tiling and native resolution keep the detail and pay for it in tokens.",
    pid:"vt-plot",
    body:`<div id="vt-bars"></div>`,
    controls: slider("vt-w", "Width (px)", 224, 3584, 32, 1344) +
              slider("vt-h", "Height (px)", 224, 3584, 32, 896) +
              slider("vt-tiles", "Max tiles", 1, 16, 1, 12) +
              slider("vt-price", "$ per 1M input tokens", 0.1, 10, 0.05, 2.5) +
              `<span class="chip" id="vt-status" aria-live="polite">—</span>`,
    table:`<div id="vt-vt"></div>`
  }) + `</div>`;
}, init(el){
  const TILE = 336, PER_TILE = 576, KV_PER_TOKEN = 131072;       // ViT-L/14 at 336 px; 7B GQA model in bf16
  const draw = () => {
    const W = +$("#vt-w", el).value, H = +$("#vt-h", el).value, maxT = +$("#vt-tiles", el).value, price = +$("#vt-price", el).value;
    $("#vt-w-o", el).textContent = W; $("#vt-h-o", el).textContent = H;
    $("#vt-tiles-o", el).textContent = maxT; $("#vt-price-o", el).textContent = "$" + price.toFixed(2);
    // tiling: shrink the image until its tile grid fits under the cap, then add a thumbnail
    let s = 1, cols = Math.ceil(W / TILE), rows = Math.ceil(H / TILE);
    while (cols * rows > maxT){ s *= 0.97; cols = Math.ceil(W * s / TILE); rows = Math.ceil(H * s / TILE); }
    const tiles = cols * rows, tiled = (tiles + (tiles > 1 ? 1 : 0)) * PER_TILE;
    // native resolution: 14-px patches, 2x2 merged, so one token per 28x28 px (dimensions rounded to 28)
    const native = Math.max(1, Math.round(H / 28)) * Math.max(1, Math.round(W / 28));
    const rowsData = [
      { label:"Resampler (64 queries)", value:64, seen:"compressed summary", color:"var(--s6)" },
      { label:"Fixed 336 px", value:PER_TILE, seen:`${TILE}×${TILE} (shrunk ${(Math.max(W, H) / TILE).toFixed(1)}×)`, color:"var(--s3)" },
      { label:`Tiles (${cols}×${rows}${tiles > 1 ? " + thumb" : ""})`, value:tiled, seen:`${Math.round(W * s)}×${Math.round(H * s)}`, color:"var(--s1)" },
      { label:"Native (28 px/token)", value:native, seen:`${Math.round(W / 28) * 28}×${Math.round(H / 28) * 28}`, color:"var(--s2)" },
    ];
    const max = Math.max.apply(null, rowsData.map(r => r.value));
    const nice = [1000, 2000, 5000, 10000, 20000].find(v => v >= max) || Math.ceil(max / 5000) * 5000;
    const ticks = [0, nice / 4, nice / 2, 3 * nice / 4, nice];
    $("#vt-bars", el).innerHTML = barsH({ w:660, rh:30, labelW:170, max:nice, ticks, fmtT:v => v >= 1000 ? (v / 1000) + "k" : v,
      rows:rowsData.map(r => ({ label:r.label, value:r.value, max:nice, color:r.color, right:r.value.toLocaleString("en"),
        tip:`${r.value.toLocaleString("en")} tokens · $${(r.value * 1000 * price / 1e6).toFixed(2)} per 1,000 images · model sees ${r.seen}` })) });
    const shrink = Math.max(W, H) / TILE;
    const st = $("#vt-status", el);
    st.textContent = shrink > 3 ? `fixed 336 px shrinks this image ${shrink.toFixed(1)}× — small text is unreadable`
      : shrink > 1.5 ? `fixed 336 px shrinks it ${shrink.toFixed(1)}× — fine for photos, risky for text`
      : "small image — every strategy sees most of the detail";
    st.className = "chip " + (shrink > 3 ? "hard" : shrink > 1.5 ? "med" : "easy");
    $("#vt-vt", el).innerHTML = tableOf(["Strategy", "Tokens", "$ per 1,000 images", "KV cache (MB)", "Pixels the model sees"],
      rowsData.map(r => [r.label, r.value.toLocaleString("en"), "$" + (r.value * 1000 * price / 1e6).toFixed(2),
        (r.value * KV_PER_TOKEN / 1048576).toFixed(0), r.seen]));
  };
  el.addEventListener("input", draw); draw();
  document.addEventListener("themechange", draw);
} };

/* ---------- test-time compute: coverage vs voting vs verifier (rs2) ---------- */
VIZ.rsScaling = { html(){
  return `<div data-viz="rsScaling">` + fig({ title:"Where the extra samples go",
    sub:"A simulated benchmark of 1,500 problems, each with its own per-sample success rate. pass@N is what a perfect checker would get; majority vote needs no checker; best-of-N trusts a noisy verifier. Make errors consistent (one distinct wrong answer) and watch voting lock them in.",
    pid:"rs-plot",
    body:`<div id="rs-svg"></div>`,
    legend:[{ name:"pass@N (perfect checker)", color:"var(--s3)" }, { name:"best-of-N (verifier)", color:"var(--s1)" }, { name:"majority vote", color:"var(--s2)" }],
    controls: slider("rs-mu", "Typical single-try accuracy", 0.1, 0.8, 0.05, 0.35) +
              slider("rs-m", "Distinct wrong answers", 1, 10, 1, 4) +
              slider("rs-d", "Verifier quality d′", 0, 4, 0.25, 1.5) +
              `<span class="chip" id="rs-status" aria-live="polite">—</span>`,
    table:`<div id="rs-vt"></div>`
  }) + `</div>`;
}, init(el){
  const P = 1500, NS = [1, 2, 4, 8, 16, 32, 64], NMAX = 64;
  const draw = () => {
    const mu = +$("#rs-mu", el).value, m = +$("#rs-m", el).value, d = +$("#rs-d", el).value;
    $("#rs-mu-o", el).textContent = Math.round(mu * 100) + "%";
    $("#rs-m-o", el).textContent = m;
    $("#rs-d-o", el).textContent = d.toFixed(2);
    let seed = 12345;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const gauss = () => { const u = Math.max(rnd(), 1e-12), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const logit = Math.log(mu / (1 - mu));
    const pass = NS.map(() => 0), vote = NS.map(() => 0), best = NS.map(() => 0);
    for (let i = 0; i < P; i++){
      const p = 1 / (1 + Math.exp(-(logit + 1.8 * gauss())));      // this problem's per-sample success rate
      const ans = [], score = [];
      for (let s = 0; s < NMAX; s++){
        const ok = rnd() < p;
        ans.push(ok ? -1 : Math.floor(rnd() * m));                  // -1 = the correct answer
        score.push((ok ? d : 0) + gauss());
      }
      NS.forEach((N, k) => {
        let anyOk = false, bestS = -Infinity, bestOk = false;
        const counts = new Map();
        for (let s = 0; s < N; s++){
          if (ans[s] === -1) anyOk = true;
          if (score[s] > bestS){ bestS = score[s]; bestOk = ans[s] === -1; }
          counts.set(ans[s], (counts.get(ans[s]) || 0) + 1);
        }
        let top = 0, tied = [];
        counts.forEach((c, a) => { if (c > top){ top = c; tied = [a]; } else if (c === top) tied.push(a); });
        if (anyOk) pass[k]++;
        if (bestOk) best[k]++;
        if (tied.includes(-1)) vote[k] += 1 / tied.length;             // random tie-break, in expectation
      });
    }
    const pct = a => a.map(v => Math.round(1000 * v / P) / 10);
    const pP = pct(pass), pV = pct(vote), pB = pct(best);
    const pts = a => NS.map((N, k) => [Math.log2(N), a[k]]);
    $("#rs-svg", el).innerHTML = lineChart({ w:660, h:260, title:"accuracy against number of samples",
      x:{ dom:[0, 6], ticks:NS.map(N => ({ v:Math.log2(N), l:String(N) })), label:"samples per problem (N)" },
      y:{ dom:[0, 100], ticks:[0, 25, 50, 75, 100].map(v => ({ v, l:v + "%" })), label:"problems solved" },
      series:[ { name:"pass@N", pts:pts(pP), color:"var(--s3)", dot:true, label:"pass@N" },
               { name:"best-of-N", pts:pts(pB), color:"var(--s1)", dot:true, label:"best-of-N" },
               { name:"majority", pts:pts(pV), color:"var(--s2)", dot:true, label:"vote", dy:6 } ],
      fmtY:v => v + "%", fmtX:v => String(Math.round(Math.pow(2, v))), xName:"N =" , pad:{ r:78 } });
    const gap = pP[6] - pV[6];
    const st = $("#rs-status", el);
    st.textContent = pV[6] < pV[0] + 1 ? `voting gains nothing: consistent errors win the vote`
      : `at N = 64, voting leaves ${gap.toFixed(0)} points on the table that a checker would recover`;
    st.className = "chip " + (pV[6] < pV[0] + 1 ? "hard" : gap > 20 ? "med" : "easy");
    $("#rs-vt", el).innerHTML = tableOf(["N", "pass@N", "best-of-N", "majority vote"],
      NS.map((N, k) => [String(N), pP[k] + "%", pB[k] + "%", pV[k] + "%"]));
  };
  el.addEventListener("input", draw); draw();
  document.addEventListener("themechange", draw);
} };

/* ---------- roofline for LLM operations (gpu2) ---------- */
VIZ.gpuRoofline = { html(){
  const opts = [["a100", "A100 SXM"], ["h100", "H100 SXM"], ["h200", "H200"], ["b200", "B200"], ["mi300x", "MI300X"]]
    .map(([v, n]) => `<option value="${v}"${v === "h100" ? " selected" : ""}>${n}</option>`).join("");
  return `<div data-viz="gpuRoofline">` + fig({ title:"Is it compute-bound or memory-bound?",
    sub:"Dense BF16 spec-sheet peaks against HBM bandwidth, on log–log axes. Each dot is one kind of operation in a transformer at the batch size you choose; its height is the best any kernel could do. Grey roofs are the other GPUs.",
    pid:"rf-plot",
    body:`<div id="rf-svg"></div>`,
    legend:[{ name:"weight matmul, BF16", color:"var(--s1)" }, { name:"weight matmul, 4-bit", color:"var(--s3)" },
            { name:"decode attention", color:"var(--s2)" }, { name:"element-wise / norms", color:"var(--s5)" }],
    controls:`<div class="ctl"><label for="rf-gpu">GPU</label><select id="rf-gpu">${opts}</select></div>` +
             slider("rf-b", "Batch (sequences or tokens)", 0, 12, 1, 5) +
             `<span class="chip" id="rf-status" aria-live="polite">—</span>`,
    table:`<div id="rf-vt"></div>`
  }) + `</div>`;
}, init(el){
  const GPUS = { a100:{ n:"A100", peak:312, bw:2.039 }, h100:{ n:"H100", peak:989, bw:3.35 }, h200:{ n:"H200", peak:989, bw:4.8 },
                 b200:{ n:"B200", peak:2250, bw:8.0 }, mi300x:{ n:"MI300X", peak:1307, bw:5.3 } };
  const D = 8192;                                   // hidden size of a 70B-class model
  const draw = () => {
    const g = GPUS[$("#rf-gpu", el).value], B = Math.pow(2, +$("#rf-b", el).value);
    $("#rf-b-o", el).textContent = B;
    const ridge = g.peak / g.bw;                      // TFLOP/s ÷ TB/s = FLOP/byte
    const att = I => Math.min(g.peak, I * g.bw);
    const ops = [
      { n:"Weight matmul, BF16 weights", I:B * D / (D + 2 * B), c:"var(--s1)" },
      { n:"Weight matmul, 4-bit weights", I:4 * B * D / (D + 8 * B), c:"var(--s3)" },
      { n:"Decode attention (GQA group 8)", I:8, c:"var(--s2)" },
      { n:"Element-wise / norms", I:1, c:"var(--s5)" },
    ];
    const roof = gg => [[1 / gg.bw, 1], [gg.peak / gg.bw, gg.peak], [1e4, gg.peak]];
    const series = Object.values(GPUS).filter(o => o !== g).map(o => ({ name:o.n, pts:roof(o), color:"var(--line-2)", wid:1.2, dash:"3 3" }));
    series.push({ name:g.n, pts:roof(g), color:"var(--ink)", wid:2.4, label:`${g.n} · ridge ${Math.round(ridge)} FLOP/B`, dy:-12 });
    $("#rf-svg", el).innerHTML = lineChart({ w:660, h:290, hover:false, title:"roofline",
      x:{ dom:[0.1, 1e4], log:true, ticks:[0.1, 1, 10, 100, 1000, 10000].map(v => ({ v, l:String(v) })), label:"arithmetic intensity (FLOP per byte)" },
      y:{ dom:[1, 3000], log:true, ticks:[1, 10, 100, 1000].map(v => ({ v, l:String(v) })), label:"attainable TFLOP/s" },
      series, pad:{ l:54, r:24 },
      marks:ops.map((o, i) => ({ x:Math.max(0.11, o.I), y:Math.max(1.05, att(o.I)), color:o.c, text:i === 0 ? `B = ${B}` : "", dx:10, dy:18 })) });
    const m = ops[0], bound = m.I < ridge;
    const st = $("#rf-status", el);
    st.textContent = bound ? `BF16 weight matmul at B = ${B}: memory-bound, ≤ ${Math.round(100 * att(m.I) / g.peak)}% of peak`
                           : `BF16 weight matmul at B = ${B}: compute-bound`;
    st.className = "chip " + (bound ? (att(m.I) / g.peak < 0.25 ? "hard" : "med") : "easy");
    $("#rf-vt", el).innerHTML = tableOf(["Operation (" + g.n + ")", "FLOP/byte", "Attainable TFLOP/s", "% of peak", "Bound by"],
      ops.map(o => [`<span style="color:${o.c}">●</span> ${esc(o.n)}`, o.I.toFixed(o.I < 10 ? 1 : 0), att(o.I).toFixed(0),
        Math.round(100 * att(o.I) / g.peak) + "%", o.I < ridge ? "memory" : "compute"]));
  };
  el.addEventListener("input", draw); el.addEventListener("change", draw); draw();
  document.addEventListener("themechange", draw);
} };

export { VIZ, vizHTML, mountViz, fig, tableOf, lineChart, barsH, barsV, heat, seqLegend };
