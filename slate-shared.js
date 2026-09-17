// ### INIT ###
document.addEventListener('DOMContentLoaded', () => {
  numberQuestions();
  letterSubquestions();
  applyBlankWidths();
  applyFreeformLines();
  applySpaceHeights();
  applyChecklistCols();
  computeTotalScore();
  renderPageBreaks();
});

window.addEventListener('load', renderPageBreaks);

let pageBreakResizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(pageBreakResizeTimer);
  pageBreakResizeTimer = setTimeout(renderPageBreaks, 150);
});



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



// ### RENDER PAGE BREAKS ###
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

function renderPageBreaks() {
  const doc = document.querySelector('slate-doc');
  if (!doc) return;

  doc.querySelectorAll('.slate-pagebreak-line').forEach((line) => line.remove());

  const marginRaw = getComputedStyle(document.documentElement).getPropertyValue('--slate-margin').trim();
  const marginPx = pxFromCssLength(marginRaw);
  const pageHeightPx = pxFromCssLength('11in');
  const pageContentHeightPx = pageHeightPx - (2 * marginPx);

  const contentTopPx = parseFloat(getComputedStyle(doc).paddingTop);
  const contentBottomPx = parseFloat(getComputedStyle(doc).paddingBottom);
  const contentEndPx = doc.scrollHeight - contentBottomPx;

  let y = contentTopPx + pageContentHeightPx;
  while (y < contentEndPx) {
    const line = document.createElement('div');
    line.className = 'slate-pagebreak-line';
    line.style.top = y + 'px';
    doc.appendChild(line);
    y += pageContentHeightPx;
  }
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
