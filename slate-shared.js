// ### INIT ###
document.addEventListener('DOMContentLoaded', () => {
  checkSlateVersion();
  numberQuestions();
  letterSubquestions();
  applyBlankWidths();
  applyFreeformLines();
  applyWorkspaceHeights();
  applySpaceHeights();
  applyChecklistCols();
  buildDiagramFrames();
  computeTotalScore();
});

// Wait for images/iframes to finish loading so their rendered height is
// known before slicing content into pages - physical page size is in
// inches, so it doesn't depend on viewport size and needs no resize redo.
window.addEventListener('load', paginateDoc);



// ### CHECK SLATE VERSION ###
// Warns if this document's stamped slate-version meta tag (set by
// .githooks/pre-commit at last commit) doesn't match the engine's current
// window.SLATE_VERSION (slate-version.js) - a missing meta tag counts as
// stale too, since it means the doc predates this check.
function checkSlateVersion() {
  const meta = document.querySelector('meta[name="slate-version"]');
  const stamped = meta ? meta.getAttribute('content') : null;
  const current = window.SLATE_VERSION;

  if (!stamped) {
    alert('This document has no recorded SLATE version - it was last generated before this check existed. Its content may not match the current SLATE engine.');
    return;
  }

  if (stamped !== current) {
    alert(`SLATE has changed since this document was last generated (document: v${stamped}, current: v${current}).`);
  }
}



// ### NUMBER QUESTIONS ###
function numberQuestions() {
  let num = 0;
  document.querySelectorAll('slate-section, slate-question').forEach((el) => {
    if (el.tagName.toLowerCase() === 'slate-section') {
      num = 0;
      return;
    }

    num += 1;
    const q = el;
    const points = q.getAttribute('points');
    const frag = document.createDocumentFragment();

    const numSpan = document.createElement('span');
    numSpan.className = 'slate-qnum';
    numSpan.textContent = num + ') ';
    frag.appendChild(numSpan);

    if (points) {
      const ptsSpan = document.createElement('span');
      ptsSpan.className = 'slate-qpoints';
      ptsSpan.textContent = '(' + points + ' pts) ';
      frag.appendChild(ptsSpan);
    }

    q.insertBefore(frag, q.firstChild);
  });
}



// ### LETTER SUBQUESTIONS ###
function letterSubquestions() {
  document.querySelectorAll('slate-question').forEach((q) => {
    const subs = q.querySelectorAll('slate-subquestion');
    subs.forEach((s, i) => {
      const letter = String.fromCharCode(97 + i) + ') ';
      const span = document.createElement('span');
      span.className = 'slate-subletter';
      span.textContent = letter;
      s.insertBefore(span, s.firstChild);
    });
  });
}



// ### APPLY BLANK WIDTHS ###
function applyBlankWidths() {
  document.querySelectorAll('slate-blank').forEach((b) => {
    const width = b.getAttribute('width');
    if (width) {
      b.style.width = width;
      b.style.minWidth = width;
    }
  });
}



// ### APPLY FREEFORM LINES ###
function applyFreeformLines() {
  document.querySelectorAll('slate-freeform').forEach((f) => {
    const lines = parseInt(f.getAttribute('lines'), 10) || 3;
    f.innerHTML = '';
    for (let i = 0; i < lines; i++) {
      const line = document.createElement('div');
      line.className = 'slate-freeform-line';
      f.appendChild(line);
    }
  });
}



// ### APPLY WORKSPACE HEIGHTS ###
function applyWorkspaceHeights() {
  document.querySelectorAll('slate-workspace').forEach((w) => {
    const height = w.getAttribute('height');
    if (height) {
      w.style.minHeight = height;
    }
  });
}



// ### APPLY SPACE HEIGHTS ###
function applySpaceHeights() {
  document.querySelectorAll('slate-space').forEach((s) => {
    const height = s.getAttribute('height');
    if (height) {
      s.style.height = height;
    }
  });
}



// ### APPLY CHECKLIST COLS ###
function applyChecklistCols() {
  document.querySelectorAll('slate-checklist').forEach((c) => {
    const cols = c.getAttribute('cols');
    if (cols) {
      c.style.setProperty('--slate-checklist-cols', cols);
    }
  });
}



// ### BUILD DIAGRAM FRAMES ###
// Native pixel size of each diagrams/*.html file, i.e. the (w, h) passed to
// `new Circuit(w, h)` in that file - add an entry here whenever a new
// diagram is created so <slate-diagram src="..."> knows its aspect ratio
// without needing same-origin access into the iframe (which file:// blocks).
const DIAGRAM_SIZES = {
  'diagrams/ptc_circuit_ammeter.html': [300, 150],
  'diagrams/fourwire_resistance_measurement.html': [400, 300],
  'diagrams/voltage_divider.html': [305, 180],
  'diagrams/rc_network.html': [400, 180],
  'diagrams/twowire_resistance_measurement.html': [400, 200],
};

function buildDiagramFrames() {
  document.querySelectorAll('slate-diagram[src]').forEach((d) => {
    const src = d.getAttribute('src');
    const width = d.getAttribute('width') || '320px';
    const size = DIAGRAM_SIZES[src];
    if (!size) {
      console.warn(`slate-diagram: no native size registered for "${src}" - add it to DIAGRAM_SIZES in slate-shared.js`);
      return;
    }

    const name = src.split('/').pop().replace(/\.html$/, '').replace(/[_-]+/g, ' ');
    const iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.style.width = width;
    iframe.style.aspectRatio = `${size[0]} / ${size[1]}`;
    iframe.scrolling = 'no';
    iframe.title = name;

    d.innerHTML = '';
    d.appendChild(iframe);
  });
}



// ### PAGINATE DOC ###
// Slices slate-doc's authored content into real, fixed-size .slate-page
// boxes (one per printed page) with a running "Page N of M" footer, instead
// of leaving one continuous flow for the browser to guess where to split.
function pxFromCssLength(value) {
  const probe = document.createElement('div');
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.height = value;
  document.body.appendChild(probe);
  const px = probe.getBoundingClientRect().height;
  probe.remove();
  return px;
}

// Authors often write loose body text directly inside <slate-doc> (between
// a <slate-section> and the next tag) with no wrapping element. Group each
// run of that bare text/inline content into a plain <div> so it becomes a
// real, measurable, placeable unit alongside the slate-* elements below.
function wrapBareTextRuns(doc) {
  const nodes = Array.from(doc.childNodes);
  let i = 0;
  while (i < nodes.length) {
    if (nodes[i].nodeType === Node.ELEMENT_NODE) {
      i += 1;
      continue;
    }
    const run = [];
    let j = i;
    while (j < nodes.length && nodes[j].nodeType !== Node.ELEMENT_NODE) {
      run.push(nodes[j]);
      j += 1;
    }
    if (run.some((n) => n.textContent.trim().length > 0)) {
      const wrapper = document.createElement('div');
      doc.insertBefore(wrapper, run[0]);
      run.forEach((n) => wrapper.appendChild(n));
    }
    i = j;
  }
}

// A subquestion holding an open workspace box is often too tall to treat as
// one atomic block - split it into up to three pieces around the workspace
// (intro/formula before it, the workspace itself, and anything after it
// like answer blanks), so only whichever piece doesn't fit moves to the
// next page instead of the whole subquestion. Zero margin at each seam and
// the original subquestion's own top/bottom margin kept on the outer edges,
// so the split is invisible when all the pieces land on the same page.
function splitSubquestionAtWorkspace(s, workspace) {
  const before = document.createElement('div');
  const middle = document.createElement('div');
  const after = document.createElement('div');
  before.style.cssText = 'margin: 0.12in 0 0 0.35in;';
  middle.style.cssText = 'margin: 0 0 0 0.35in;';
  after.style.cssText = 'margin: 0 0 0.12in 0.35in;';

  let stage = 'before';
  Array.from(s.childNodes).forEach((n) => {
    if (n === workspace) {
      middle.appendChild(n);
      stage = 'after';
      return;
    }
    (stage === 'before' ? before : after).appendChild(n);
  });

  const parts = [before, middle, after].filter((p) => p.childNodes.length > 0);
  s.replaceWith(...parts);
  return parts;
}

// Build the packing plan by measuring inside `container` - heights must be
// measured before anything is detached/moved, since a detached element's
// rect collapses to zero.
function buildPaginationPlan(container) {
  const plan = [];

  Array.from(container.children).forEach((child) => {
    const tag = child.tagName.toLowerCase();

    if (tag === 'slate-pagebreak') {
      plan.push({ breakOnly: true });
      return;
    }

    if (tag === 'slate-question') {
      // Only direct-child subquestions are treated as independent split
      // points; ones nested inside a slate-answer-row layout stay part of
      // the atomic question block below (splitting mid-layout isn't worth
      // the complexity here).
      const subs = Array.from(child.children).filter((c) => c.tagName.toLowerCase() === 'slate-subquestion');
      const subUnits = [];
      subs.forEach((s) => {
        const workspace = Array.from(s.children).find((c) => c.tagName.toLowerCase() === 'slate-workspace');
        if (workspace) {
          subUnits.push(...splitSubquestionAtWorkspace(s, workspace));
        } else {
          subUnits.push(s);
        }
      });
      plan.push({ el: child, keepWithNext: subUnits.length > 0, stripSubs: subUnits });
      subUnits.forEach((u) => plan.push({ el: u }));
      return;
    }

    plan.push({ el: child });
  });

  // A unit's height is the real rendered gap to whatever comes right after
  // it, which naturally folds in margin collapsing between the two - two
  // adjacent margins render as the larger of the two, not their sum, so
  // summing each element's own margins independently overstates the space
  // actually used and pushes content to the next page too early. A unit
  // right before a forced break, or the very last one, has nothing to
  // collapse against and just closes out at its own bottom edge.
  plan.forEach((item, i) => {
    if (item.breakOnly) return;
    const next = plan[i + 1];
    const top = item.el.getBoundingClientRect().top;
    const end = (next && !next.breakOnly) ? next.el.getBoundingClientRect().top : item.el.getBoundingClientRect().bottom;
    item.height = end - top;
  });

  return plan;
}

function paginateDoc() {
  const doc = document.querySelector('slate-doc');
  if (!doc) return;

  wrapBareTextRuns(doc);

  // Measure inside an offscreen .slate-page (same class, so identical
  // width/padding/fonts) rather than in slate-doc's own shell, so heights
  // match exactly how content renders once actually placed on a page -
  // measuring somewhere a different width can under/overestimate wrapped
  // text height and let content run into the footer.
  const measurer = document.createElement('div');
  measurer.className = 'slate-page';
  measurer.style.position = 'absolute';
  measurer.style.left = '-9999px';
  measurer.style.top = '0';
  measurer.style.height = 'auto';
  measurer.style.overflow = 'visible';
  document.body.appendChild(measurer);
  Array.from(doc.children).forEach((child) => measurer.appendChild(child));

  const marginPx = pxFromCssLength(getComputedStyle(document.documentElement).getPropertyValue('--slate-margin').trim());
  const pageHeightPx = pxFromCssLength('11in');
  const budgetPx = pageHeightPx - (2 * marginPx);

  const plan = buildPaginationPlan(measurer);

  // Now safe to mutate: pull direct-child subquestions out of their
  // question shell so they can be placed on separate pages from it.
  plan.forEach((item) => {
    if (item.stripSubs) item.stripSubs.forEach((s) => item.el.removeChild(s));
  });

  doc.innerHTML = '';
  const pages = [document.createElement('div')];
  pages[0].className = 'slate-page';
  let used = 0;

  const startNewPage = () => {
    const page = document.createElement('div');
    page.className = 'slate-page';
    pages.push(page);
    used = 0;
  };

  plan.forEach((item, idx) => {
    if (item.breakOnly) {
      if (used > 0) startNewPage();
      return;
    }

    // Orphan control: don't leave a question's intro alone at the bottom of
    // a page with its first subquestion pushed to the next one.
    let neededHeight = item.height;
    if (item.keepWithNext && plan[idx + 1] && !plan[idx + 1].breakOnly) {
      neededHeight += plan[idx + 1].height;
    }

    if (used > 0 && used + neededHeight > budgetPx) startNewPage();

    pages[pages.length - 1].appendChild(item.el);
    used += item.height;
  });

  measurer.remove();

  pages.forEach((page, i) => {
    const footer = document.createElement('div');
    footer.className = 'slate-page-footer';
    footer.textContent = `Page ${i + 1} of ${pages.length}`;
    page.appendChild(footer);
    doc.appendChild(page);
  });
}



// ### COMPUTE TOTAL SCORE ###
function computeTotalScore() {
  let total = 0;
  document.querySelectorAll('slate-question').forEach((q) => {
    const points = parseFloat(q.getAttribute('points'));
    if (!isNaN(points)) {
      total += points;
    }
  });
  document.querySelectorAll('slate-score').forEach((s) => {
    s.textContent = 'Score: _________ / ' + total;
  });
}
