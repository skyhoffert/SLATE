/*
 * slate-circuit-lib.js
 *
 * Tiny code-based circuit schematic renderer used by files in diagrams/.
 * Usage (inside a standalone diagrams/*.html file):
 *
 *   const c = new Circuit(300, 150);
 *   const src = c.dcVSource(50, 55, { label: 'Vs', value: '12 V' });
 *   const r1  = c.resistor(220, 75, { rotate: 90, label: 'R1', value: '100 Ω' });
 *   c.line(src.top, { x: src.top.x, y: 20 });
 *   c.line({ x: 50, y: 20 }, { x: 220, y: 20 });
 *   c.line({ x: 220, y: 20 }, r1.top);
 *   c.line(r1.bottom, { x: 220, y: 130 });
 *   c.line({ x: 220, y: 130 }, { x: 50, y: 130 });
 *   c.line({ x: 50, y: 130 }, src.bottom);
 *   c.render(document.body);
 */
(function (global) {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const FONT_FAMILY = "'Times New Roman', Times, serif";

  function deg2rad(d) {
    return (d * Math.PI) / 180;
  }

  // Rotate local point (lx, ly) by `deg` degrees, then translate to (x, y).
  function toWorld(x, y, deg, lx, ly) {
    const r = deg2rad(deg || 0);
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    return {
      x: x + lx * cos - ly * sin,
      y: y + lx * sin + ly * cos,
    };
  }

  // Given two terminal points, add left/right/top/bottom aliases when the
  // pair is axis-aligned (so callers don't have to think about rotation math).
  function withAliases(a, b) {
    const out = { a, b };
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dy) < 0.01 && Math.abs(dx) > 0.01) {
      if (a.x < b.x) {
        out.left = a;
        out.right = b;
      } else {
        out.left = b;
        out.right = a;
      }
    }
    if (Math.abs(dx) < 0.01 && Math.abs(dy) > 0.01) {
      if (a.y < b.y) {
        out.top = a;
        out.bottom = b;
      } else {
        out.top = b;
        out.bottom = a;
      }
    }
    return out;
  }

  // Splits a label string into [{mode: 'normal'|'sub'|'sup', text}, ...]
  // runs. "_x" or "^x" subscripts/superscripts the single next character;
  // "_{...}" or "^{...}" subscripts/superscripts a whole run. Doubling
  // the marker ("__" or "^^") produces a literal "_" or "^".
  function parseLabelMarkup(str) {
    const segments = [];
    let cur = '';
    const flush = (mode) => {
      if (cur) segments.push({ mode, text: cur });
      cur = '';
    };
    let i = 0;
    while (i < str.length) {
      const ch = str[i];
      if (ch === '_' || ch === '^') {
        const next = str[i + 1];
        if (next === ch) {
          cur += ch;
          i += 2;
          continue;
        }
        const mode = ch === '_' ? 'sub' : 'sup';
        if (next === '{') {
          flush('normal');
          const end = str.indexOf('}', i + 2);
          const stop = end === -1 ? str.length : end;
          segments.push({ mode, text: str.slice(i + 2, stop) });
          i = stop + 1;
        } else if (next !== undefined) {
          flush('normal');
          segments.push({ mode, text: next });
          i += 2;
        } else {
          cur += ch;
          i += 1;
        }
        continue;
      }
      cur += ch;
      i += 1;
    }
    flush('normal');
    return segments;
  }

  function el(tag, attrs, children) {
    const e = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) {
      if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    }
    (children || []).forEach((c) => e.appendChild(c));
    return e;
  }

  class Circuit {
    constructor(width, height, opts = {}) {
      this.width = width;
      this.height = height;
      this.stroke = opts.stroke || '#000000';
      this.strokeWidth = opts.strokeWidth != null ? opts.strokeWidth : 2;
      this._nodes = [];
    }

    // ---- component placement -------------------------------------------

    // axis: 'h' = natural leads run left/right at rotate 0 (resistor, capacitor, inductor)
    //       'v' = natural leads run top/bottom at rotate 0 (dc source, ac source)
    _place(x, y, rotate, axis, localTermDist, drawLocal, opts) {
      const g = el('g', { transform: `translate(${x} ${y}) rotate(${rotate || 0})` });
      drawLocal(g);
      this._nodes.push(g);

      const localA = axis === 'h' ? { x: -localTermDist, y: 0 } : { x: 0, y: -localTermDist };
      const localB = axis === 'h' ? { x: localTermDist, y: 0 } : { x: 0, y: localTermDist };
      const a = toWorld(x, y, rotate, localA.x, localA.y);
      const b = toWorld(x, y, rotate, localB.x, localB.y);
      const terminals = withAliases(a, b);

      const labelSideLocal =
        opts.side === 'top' ? { x: 0, y: -1 } :
        opts.side === 'bottom' ? { x: 0, y: 1 } :
        opts.side === 'left' ? { x: -1, y: 0 } :
        opts.side === 'right' ? { x: 1, y: 0 } :
        axis === 'h' ? { x: 0, y: -1 } /* above */ : { x: 1, y: 0 } /* right */;

      if (opts.label || opts.value) {
        this._autoLabel(x, y, rotate, labelSideLocal, opts);
      }

      return Object.assign({ x, y, rotate }, terminals);
    }

    _autoLabel(x, y, rotate, sideLocal, opts) {
      const gap = opts.labelGap != null ? opts.labelGap : 20;
      const lineHeight = opts.labelLineHeight != null ? opts.labelLineHeight : 16;
      const dx = opts.dx || 0;
      const dy = opts.dy || 0;

      const anchorPt = toWorld(x, y, rotate, sideLocal.x * gap + dx, sideLocal.y * gap + dy);

      let anchor = opts.anchor;
      if (!anchor) {
        if (sideLocal.x < 0) anchor = 'end';
        else if (sideLocal.x > 0) anchor = 'start';
        else anchor = 'middle';
      }

      const lines = [];
      if (opts.label) lines.push(opts.label);
      if (opts.value) lines.push(opts.value);
      if (!lines.length) return;

      // Stack lines centered vertically on the anchor point.
      const startY = anchorPt.y - ((lines.length - 1) * lineHeight) / 2;
      lines.forEach((line, i) => {
        this.text(anchorPt.x, startY + i * lineHeight, line, { anchor, fontSize: opts.fontSize });
      });
    }

    resistor(x, y, opts = {}) {
      const len = opts.length || 60;
      const half = len / 2;
      const zig = opts.zigHeight || 7;
      return this._place(x, y, opts.rotate, 'h', half, (g) => {
        const pts = [
          [-half, 0],
          [-half + 10, 0],
          [-half + 15, -zig],
          [-half + 22, zig],
          [-half + 29, -zig],
          [-half + 36, zig],
          [-half + 43, -zig],
          [-half + 50, 0],
          [half, 0],
        ]
          .map((p) => p.join(','))
          .join(' ');
        g.appendChild(
          el('polyline', {
            points: pts,
            fill: 'none',
            stroke: this.stroke,
            'stroke-width': this.strokeWidth,
            'stroke-linejoin': 'round',
            'stroke-linecap': 'round',
          })
        );
      }, opts);
    }

    capacitor(x, y, opts = {}) {
      const len = opts.length || 50;
      const half = len / 2;
      const plateGap = opts.plateGap != null ? opts.plateGap : 8;
      const plateHeight = opts.plateHeight != null ? opts.plateHeight : 22;
      return this._place(x, y, opts.rotate, 'h', half, (g) => {
        const attrs = { stroke: this.stroke, 'stroke-width': this.strokeWidth, 'stroke-linecap': 'round' };
        g.appendChild(el('line', { x1: -half, y1: 0, x2: -plateGap / 2, y2: 0, ...attrs }));
        g.appendChild(el('line', { x1: plateGap / 2, y1: 0, x2: half, y2: 0, ...attrs }));
        g.appendChild(
          el('line', { x1: -plateGap / 2, y1: -plateHeight / 2, x2: -plateGap / 2, y2: plateHeight / 2, ...attrs })
        );
        g.appendChild(
          el('line', { x1: plateGap / 2, y1: -plateHeight / 2, x2: plateGap / 2, y2: plateHeight / 2, ...attrs })
        );
      }, opts);
    }

    inductor(x, y, opts = {}) {
      const len = opts.length || 60;
      const half = len / 2;
      const bumps = opts.bumps || 4;
      const bodyLen = len - 20; // leave 10px lead stub on each side
      const bumpR = bodyLen / (bumps * 2);
      return this._place(x, y, opts.rotate, 'h', half, (g) => {
        const attrs = { fill: 'none', stroke: this.stroke, 'stroke-width': this.strokeWidth, 'stroke-linecap': 'round' };
        g.appendChild(el('line', { x1: -half, y1: 0, x2: -half + 10, y2: 0, ...attrs }));
        g.appendChild(el('line', { x1: half - 10, y1: 0, x2: half, y2: 0, ...attrs }));
        let cx = -half + 10;
        for (let i = 0; i < bumps; i++) {
          const startX = cx + i * bumpR * 2;
          const endX = startX + bumpR * 2;
          const midX = (startX + endX) / 2;
          g.appendChild(
            el('path', {
              d: `M ${startX} 0 A ${bumpR} ${bumpR} 0 0 1 ${endX} 0`,
              ...attrs,
            })
          );
        }
      }, opts);
    }

    dcVSource(x, y, opts = {}) {
      const len = opts.length || 60;
      const half = len / 2;
      const r = opts.radius != null ? opts.radius : 15;
      return this._place(x, y, opts.rotate, 'v', half, (g) => {
        const attrs = { stroke: this.stroke, 'stroke-width': this.strokeWidth, 'stroke-linecap': 'round' };
        g.appendChild(el('line', { x1: 0, y1: -half, x2: 0, y2: -r, ...attrs }));
        g.appendChild(el('line', { x1: 0, y1: r, x2: 0, y2: half, ...attrs }));
        g.appendChild(el('circle', { cx: 0, cy: 0, r, fill: 'none', stroke: this.stroke, 'stroke-width': this.strokeWidth }));
        g.appendChild(
          el('text', { x: 0, y: -2, 'font-size': 14, 'font-family': FONT_FAMILY, 'text-anchor': 'middle', fill: this.stroke }, [
            document.createTextNode('+'),
          ])
        );
        g.appendChild(
          el('text', { x: 0, y: 12, 'font-size': 14, 'font-family': FONT_FAMILY, 'text-anchor': 'middle', fill: this.stroke }, [
            document.createTextNode('−'),
          ])
        );
      }, opts);
    }

    dcISource(x, y, opts = {}) {
      const len = opts.length || 60;
      const half = len / 2;
      const r = opts.radius != null ? opts.radius : 15;
      return this._place(x, y, opts.rotate, 'v', half, (g) => {
        const attrs = { stroke: this.stroke, 'stroke-width': this.strokeWidth, 'stroke-linecap': 'round' };
        g.appendChild(el('line', { x1: 0, y1: -half, x2: 0, y2: -r, ...attrs }));
        g.appendChild(el('line', { x1: 0, y1: r, x2: 0, y2: half, ...attrs }));
        g.appendChild(el('circle', { cx: 0, cy: 0, r, fill: 'none', stroke: this.stroke, 'stroke-width': this.strokeWidth }));
        const arrowHalf = r * 0.55;
        g.appendChild(el('line', { x1: 0, y1: arrowHalf, x2: 0, y2: -arrowHalf, ...attrs }));
        g.appendChild(
          el('polyline', {
            points: `${-arrowHalf * 0.6},${-arrowHalf * 0.3} 0,${-arrowHalf} ${arrowHalf * 0.6},${-arrowHalf * 0.3}`,
            fill: 'none',
            stroke: this.stroke,
            'stroke-width': this.strokeWidth,
            'stroke-linejoin': 'round',
            'stroke-linecap': 'round',
          })
        );
      }, opts);
    }

    VMeter(x, y, opts = {}) {
      const len = opts.length || 60;
      const half = len / 2;
      const size = opts.size != null ? opts.size : 30;
      const s = size / 2;
      return this._place(x, y, opts.rotate, 'v', half, (g) => {
        const attrs = { stroke: this.stroke, 'stroke-width': this.strokeWidth, 'stroke-linecap': 'round' };
        g.appendChild(el('line', { x1: 0, y1: -half, x2: 0, y2: -s, ...attrs }));
        g.appendChild(el('line', { x1: 0, y1: s, x2: 0, y2: half, ...attrs }));
        g.appendChild(el('rect', { x: -s, y: -s, width: size, height: size, fill: 'none', stroke: this.stroke, 'stroke-width': this.strokeWidth }));
        g.appendChild(
          el('text', { x: 0, y: 5, 'font-size': 14, 'font-family': FONT_FAMILY, 'text-anchor': 'middle', fill: this.stroke }, [
            document.createTextNode('V'),
          ])
        );
        const polarityOffset = opts.polarityOffset != null ? opts.polarityOffset : 10;
        g.appendChild(
          el('text', { x: polarityOffset, y: -s - 6, 'font-size': 12, 'font-family': FONT_FAMILY, 'text-anchor': 'middle', fill: this.stroke }, [
            document.createTextNode('+'),
          ])
        );
        g.appendChild(
          el('text', { x: polarityOffset, y: s + 14, 'font-size': 12, 'font-family': FONT_FAMILY, 'text-anchor': 'middle', fill: this.stroke }, [
            document.createTextNode('−'),
          ])
        );
      }, opts);
    }

    acSource(x, y, opts = {}) {
      const len = opts.length || 60;
      const half = len / 2;
      const r = opts.radius != null ? opts.radius : 15;
      return this._place(x, y, opts.rotate, 'v', half, (g) => {
        const attrs = { fill: 'none', stroke: this.stroke, 'stroke-width': this.strokeWidth, 'stroke-linecap': 'round' };
        g.appendChild(el('line', { x1: 0, y1: -half, x2: 0, y2: -r, ...attrs }));
        g.appendChild(el('line', { x1: 0, y1: r, x2: 0, y2: half, ...attrs }));
        g.appendChild(el('circle', { cx: 0, cy: 0, r, ...attrs }));
        const w = r * 1.1;
        g.appendChild(
          el('path', {
            d: `M ${-w} 0 C ${-w / 2} ${-r * 0.8}, ${-w / 6} ${-r * 0.8}, 0 0 C ${w / 6} ${r * 0.8}, ${w / 2} ${r * 0.8}, ${w} 0`,
            ...attrs,
          })
        );
      }, opts);
    }

    // ---- wires ------------------------------------------------------------

    line(p1, p2, opts = {}) {
      this._nodes.push(
        el('line', {
          x1: p1.x,
          y1: p1.y,
          x2: p2.x,
          y2: p2.y,
          stroke: opts.stroke || this.stroke,
          'stroke-width': opts.strokeWidth != null ? opts.strokeWidth : this.strokeWidth,
          'stroke-linecap': 'round',
        })
      );
    }

    // Straight segment if `a` and `b` are already aligned; otherwise a
    // single 90-degree bend: 'h' (default) leaves `a` horizontally ("L"
    // shaped) and 'v' leaves `a` vertically first ("J" shaped).
    _elbow(a, b, bend) {
      if (Math.abs(a.x - b.x) < 0.01 || Math.abs(a.y - b.y) < 0.01) return [a, b];
      const corner = bend === 'v' ? { x: a.x, y: b.y } : { x: b.x, y: a.y };
      return [a, corner, b];
    }

    // Auto-elbow wire between p1 and p2. Pass one or more waypoints via
    // opts.via (a single {x,y} or an array) to route through specific
    // points; each leg between consecutive points (p1 -> via... -> p2)
    // is auto-elbowed on its own, so a single via point is enough to
    // produce a U-shaped detour without having to work out both corners
    // by hand. opts.bend ('h' or 'v') applies to every leg uniformly —
    // if one particular leg needs the opposite bend, split the call into
    // two wire() calls (p1->via and via->p2) with different opts.bend.
    wire(p1, p2, opts = {}) {
      const via = opts.via ? (Array.isArray(opts.via) ? opts.via : [opts.via]) : [];
      const stops = [p1, ...via, p2];
      const points = [stops[0]];
      for (let i = 0; i < stops.length - 1; i++) {
        const leg = this._elbow(stops[i], stops[i + 1], opts.bend);
        points.push(...leg.slice(1));
      }
      for (let i = 0; i < points.length - 1; i++) {
        this.line(points[i], points[i + 1], opts);
      }
    }

    // ---- annotations ----------------------------------------------------

    // Dashed rectangle centered at (x, y), for grouping components
    // visually. Pass opts.dash = 'none' for a solid box.
    dashedBox(x, y, width, height, opts = {}) {
      this._nodes.push(
        el('rect', {
          x: x - width / 2,
          y: y - height / 2,
          width,
          height,
          fill: 'none',
          stroke: opts.stroke || this.stroke,
          'stroke-width': opts.strokeWidth != null ? opts.strokeWidth : this.strokeWidth,
          'stroke-dasharray': opts.dash || '6,4',
        })
      );
    }

    // ---- text ---------------------------------------------------------

    // Label markup: "\_" starts a subscript run, "\^" starts a
    // superscript run, "\-" returns to normal script, "\\" is a literal
    // backslash. E.g. 'V\_S' renders as V with a subscript S.
    text(x, y, str, opts = {}) {
      const fontSize = opts.fontSize || 14;
      const t = el('text', {
        x,
        y,
        'font-size': fontSize,
        'font-family': FONT_FAMILY,
        'text-anchor': opts.anchor || 'middle',
        'dominant-baseline': 'middle',
        fill: opts.color || this.stroke,
      });
      if (opts.sub) str += '_{' + opts.sub + '}'; // legacy shorthand
      parseLabelMarkup(str).forEach((seg) => {
        if (seg.mode === 'normal') {
          t.appendChild(document.createTextNode(seg.text));
        } else {
          const shift = seg.mode === 'sub' ? 'sub' : 'super';
          const span = el('tspan', { 'font-size': fontSize * 0.65, 'baseline-shift': shift });
          span.appendChild(document.createTextNode(seg.text));
          t.appendChild(span);
        }
      });
      this._nodes.push(t);
      return t;
    }

    // ---- output ---------------------------------------------------------

    render(target) {
      const svg = el('svg', {
        viewBox: `0 0 ${this.width} ${this.height}`,
        width: '100%',
        height: '100%',
        xmlns: SVG_NS,
      });
      this._nodes.forEach((n) => svg.appendChild(n));
      (target || document.body).appendChild(svg);
      return svg;
    }
  }

  global.Circuit = Circuit;
})(window);
