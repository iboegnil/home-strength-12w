/* 动作示范动画引擎：关键帧 + 正/逆向运动学，画成内联 SVG 的几何人形。
   角度约定：0 = 向下，90 = 向画面右侧（人物前方），180 = 向上，-90 = 向左。 */
(function (global) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var L = { torso: 48, neck: 6, head: 9.5, thigh: 42, shin: 41, foot: 20, uarm: 29, farm: 27 };
  var G = 188;                       // 垫子上表面
  var VB = [0, -14, 240, 212];

  function rad(a) { return a * Math.PI / 180; }
  function dv(a) { return [Math.sin(rad(a)), Math.cos(rad(a))]; }
  function add(p, a, l) { var d = dv(a); return [p[0] + d[0] * l, p[1] + d[1] * l]; }
  function angOf(p, q) { return Math.atan2(q[0] - p[0], q[1] - p[1]) * 180 / Math.PI; }
  function dist(p, q) { return Math.hypot(q[0] - p[0], q[1] - p[1]); }
  function mix(p, q, t) { return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; }
  function pt(p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }

  // 两段式逆向运动学：bend = +1 时中间关节向逆时针一侧弯（腿：膝盖朝前）
  function ik(root, target, l1, l2, bend) {
    var d = Math.max(Math.abs(l1 - l2) + 0.01, Math.min(l1 + l2 - 0.01, dist(root, target)));
    var c = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
    var A = Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI;
    var mid = add(root, angOf(root, target) + bend * A, l1);
    return [mid, add(mid, angOf(mid, target), l2)];
  }

  var ANG = { a: 1, tor: 1, ft: 1, hd: 1 };
  function lerpAng(a, b, t) { var d = ((b - a) % 360 + 540) % 360 - 180; return a + d * t; }
  function lerp(a, b, t, key) {
    if (typeof a === 'number' && typeof b === 'number') return ANG[key] ? lerpAng(a, b, t) : a + (b - a) * t;
    if (Array.isArray(a) && Array.isArray(b)) return a.map(function (v, i) { return lerp(v, b[i], t, key); });
    if (a && b && typeof a === 'object') {
      var o = {}, k;
      for (k in a) o[k] = (k in b) ? lerp(a[k], b[k], t, k) : a[k];
      for (k in b) if (!(k in a)) o[k] = b[k];
      return o;
    }
    return t < 0.5 ? a : b;
  }
  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function merge(base, over) {
    var out = {}, k;
    for (k in base) out[k] = isObj(base[k]) ? merge(base[k], {}) : base[k];
    for (k in over) out[k] = (isObj(over[k]) && isObj(out[k])) ? merge(out[k], over[k]) : over[k];
    return out;
  }
  function ease(t) { return 0.5 - 0.5 * Math.cos(Math.PI * t); }

  /* ---------- 姿势求解 ---------- */
  function spec(def, p, key, side, front) {
    if (p[key + side]) return p[key + side];
    var src = p[key + 'N'];
    if (!src || side === 'N') return null;
    var c = merge(src, {});
    if (front) {                       // 正面视角：左右镜像
      if (c.a) c.a = c.a.map(function (v) { return -v; });
      if (c.ik) c.ik = [2 * (def.cx || 120) - c.ik[0], c.ik[1]];
      if (c.ft != null) c.ft = -c.ft;
      if (c.off) c.off = [-c.off[0], c.off[1]];
      if (typeof c.to === 'string') c.to = c.to.replace(/N$/, 'F');
      c.b = -(c.b != null ? c.b : (key === 'l' ? 1 : -1));
    } else if (c.ik) {                 // 侧面视角：远侧肢体略微错开，表现纵深
      c.ik = [c.ik[0] - 3, c.ik[1] - 2];
    }
    return c;
  }
  function resolveTo(J, to, off) {
    var p = typeof to === 'string' ? J[to] : mix(J[to[0]], J[to[1]], to[2]);
    var o = off || [0, 0];
    return [p[0] + o[0], p[1] + o[1]];
  }
  function limb(def, p, J, key, side, front) {
    var s = spec(def, p, key, side, front);
    if (!s) return;
    var leg = key === 'l';
    var root = leg ? J['hip' + side] : J['sh' + side];
    var ls = s.ls || [1, 1];
    var l1 = (leg ? L.thigh : L.uarm) * ls[0], l2 = (leg ? L.shin : L.farm) * ls[1];
    var b = s.b != null ? s.b : (leg ? 1 : -1), tgt = null, mid, end;
    if (s.ik) tgt = s.ik;
    else if (s.tk) tgt = [root[0] + J.n[0] * s.tk[0] - J.u[0] * s.tk[1], root[1] + J.n[1] * s.tk[0] - J.u[1] * s.tk[1]];
    else if (s.to) tgt = resolveTo(J, s.to, s.off);
    if (tgt) { var r = ik(root, tgt, l1, l2, b); mid = r[0]; end = r[1]; }
    else { mid = add(root, s.a[0], l1); end = add(mid, s.a[1], l2); }
    if (leg) {
      J['knee' + side] = mid; J['ank' + side] = end;
      var ft = s.ft != null ? s.ft : (front ? (side === 'N' ? -90 : 90) : 85);
      J['toe' + side] = add(end, ft, front ? 7 : L.foot);
    } else {
      J['elb' + side] = mid; J['hand' + side] = end;
    }
  }
  function solve(def, p) {
    var front = def.view === 'front', J = {};
    var P = p.hip, u = dv(p.tor), n = dv(p.tor - 90);
    var S = [P[0] + u[0] * L.torso, P[1] + u[1] * L.torso];
    var hw = front ? 9 : 0, sw = front ? 16 : 0, dep = front ? [0, 0] : [-3, -2];
    function off(q, k, e) { return [q[0] + n[0] * k + e[0], q[1] + n[1] * k + e[1]]; }
    J.pelvis = P; J.sh = S; J.u = u; J.n = n; J.sp = p.sp || 0;
    J.hipN = off(P, -hw, [0, 0]); J.hipF = off(P, hw, dep);
    J.shN = off(S, -sw, [0, 0]); J.shF = off(S, sw, dep);
    J.hdir = p.tor - (p.hd || 0);
    J.head = add(S, J.hdir, L.neck + L.head);
    limb(def, p, J, 'l', 'N', front); limb(def, p, J, 'l', 'F', front);
    limb(def, p, J, 'a', 'N', front); limb(def, p, J, 'a', 'F', front);
    return J;
  }

  /* ---------- 绘制 ---------- */
  function E(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function setLine(e, a, b) {
    e.setAttribute('x1', a[0].toFixed(1)); e.setAttribute('y1', a[1].toFixed(1));
    e.setAttribute('x2', b[0].toFixed(1)); e.setAttribute('y2', b[1].toFixed(1));
  }
  var SEG = { uarm: ['sh', 'elb'], farm: ['elb', 'hand'], thigh: ['hip', 'knee'], shin: ['knee', 'ank'], foot: ['ank', 'toe'] };
  function hasHl(def, name) {
    return (def.hl || []).some(function (h) { return name.indexOf(h) === 0; });
  }

  function Body(g, def, ghost) {
    var self = this, front = def.view === 'front';
    this.front = front; this.ghost = ghost; this.segs = []; this.ov = []; this.slots = {};
    function seg(name, side) {
      var cls = 'seg ' + (name === 'uarm' || name === 'farm' ? 'arm' : name === 'foot' ? 'foot' : 'leg');
      if (!ghost) {
        if (!front && side === 'F') cls += ' far';
        if (hasHl(def, name + side)) cls += ' hl';
      }
      self.segs.push({ e: E('line', { 'class': cls }, g), a: SEG[name][0] + side, b: SEG[name][1] + side });
    }
    function legs(side) { seg('thigh', side); seg('shin', side); seg('foot', side); }
    function arms(side) { seg('uarm', side); seg('farm', side); }
    function slot(name) { self.slots[name] = E('g', {}, g); }
    if (front) { legs('N'); legs('F'); slot('far'); }
    else { arms('F'); slot('far'); legs('F'); }
    this.torso = E('path', { 'class': 'torso' + (front ? ' front' : '') }, g);
    if (!ghost) {
      (def.hl || []).forEach(function (h) {
        if (h === 'chest' || h === 'back' || h === 'core') self.ov.push({ k: h, e: E('path', { 'class': 'hl-ov' }, g) });
        if (h === 'glute' && !front) self.ov.push({ k: h, e: E('circle', { 'class': 'hl-dot', r: 8.5 }, g) });
        if (h === 'glute' && front) {
          self.ov.push({ k: 'gluteN', e: E('circle', { 'class': 'hl-dot', r: 7 }, g) });
          self.ov.push({ k: 'gluteF', e: E('circle', { 'class': 'hl-dot', r: 7 }, g) });
        }
        if (h === 'delt') {
          self.ov.push({ k: 'deltN', e: E('circle', { 'class': 'hl-dot', r: 6.5 }, g) });
          if (front) self.ov.push({ k: 'deltF', e: E('circle', { 'class': 'hl-dot', r: 6.5 }, g) });
        }
      });
    }
    this.head = E('circle', { 'class': 'head', r: L.head }, g);
    if (!ghost) {
      this.eyes = front ? [E('circle', { 'class': 'eye', r: 1.5 }, g), E('circle', { 'class': 'eye', r: 1.5 }, g)]
                        : [E('circle', { 'class': 'eye', r: 1.7 }, g)];
    }
    slot('mid');
    if (front) { arms('N'); arms('F'); }
    else { legs('N'); slot('midN'); arms('N'); }
    slot('near');
  }
  Body.prototype.draw = function (J) {
    this.segs.forEach(function (s) { if (J[s.a] && J[s.b]) setLine(s.e, J[s.a], J[s.b]); });
    var P = J.pelvis, S = J.sh, n = J.n, d;
    var C = mix(P, S, 0.5);
    C = [C[0] - n[0] * J.sp, C[1] - n[1] * J.sp];
    if (this.front) d = 'M' + pt(J.shN) + 'L' + pt(J.shF) + 'L' + pt(J.hipF) + 'L' + pt(J.hipN) + 'Z';
    else d = 'M' + pt(P) + 'Q' + pt(C) + ' ' + pt(S);
    this.torso.setAttribute('d', d);
    var B = [0.25 * P[0] + 0.5 * C[0] + 0.25 * S[0], 0.25 * P[1] + 0.5 * C[1] + 0.25 * S[1]];
    var front = this.front;
    this.ov.forEach(function (o) {
      if (o.k === 'chest' || o.k === 'back') o.e.setAttribute('d', 'M' + pt(B) + 'Q' + pt(mix(C, S, 0.5)) + ' ' + pt(S));
      else if (o.k === 'core') o.e.setAttribute('d', 'M' + pt(P) + 'Q' + pt(mix(P, C, 0.5)) + ' ' + pt(B));
      else if (o.k === 'glute') {
        var g = front ? P : [P[0] - n[0] * 3, P[1] - n[1] * 3];
        o.e.setAttribute('cx', g[0].toFixed(1)); o.e.setAttribute('cy', g[1].toFixed(1));
      } else {
        var q = J[(o.k.indexOf('glute') === 0 ? 'hip' : 'sh') + o.k.slice(-1)];
        o.e.setAttribute('cx', q[0].toFixed(1)); o.e.setAttribute('cy', q[1].toFixed(1));
      }
    });
    this.head.setAttribute('cx', J.head[0].toFixed(1)); this.head.setAttribute('cy', J.head[1].toFixed(1));
    if (this.eyes) {
      var hd = J.hdir, f = dv(hd - 90), up = dv(hd), e;
      if (front) {
        [-3.2, 3.2].forEach(function (k, i) {
          e = [J.head[0] + k, J.head[1] - 0.5];
          this.eyes[i].setAttribute('cx', e[0].toFixed(1)); this.eyes[i].setAttribute('cy', e[1].toFixed(1));
        }, this);
      } else {
        e = [J.head[0] + f[0] * 4.6 + up[0] * 1.2, J.head[1] + f[1] * 4.6 + up[1] * 1.2];
        this.eyes[0].setAttribute('cx', e[0].toFixed(1)); this.eyes[0].setAttribute('cy', e[1].toFixed(1));
      }
    }
  };

  /* ---------- 道具：哑铃、弹力带 ---------- */
  function Dumbbell(parent, d) {
    this.d = d;
    this.g = E('g', { 'class': 'db' }, parent);
    if (d.kind === 'round') {
      E('circle', { 'class': 'db-plate', r: 8.5 }, this.g);
      E('circle', { 'class': 'db-hub', r: 3 }, this.g);
    } else {
      E('rect', { 'class': 'db-handle', x: -9, y: -1.7, width: 18, height: 3.4, rx: 1.2 }, this.g);
      E('rect', { 'class': 'db-plate', x: -15, y: -8, width: 6.5, height: 16, rx: 2 }, this.g);
      E('rect', { 'class': 'db-plate', x: 8.5, y: -8, width: 6.5, height: 16, rx: 2 }, this.g);
    }
  }
  Dumbbell.prototype.draw = function (J) {
    var d = this.d, side = d.at.slice(-1), h = J[d.at], rot = 0, c = h;
    if (d.kind === 'bar') {
      var el = J['elb' + side], v = [h[0] - el[0], h[1] - el[1]];
      rot = Math.atan2(v[0], -v[1]) * 180 / Math.PI;
    } else if (d.kind === 'inline') {
      var e2 = J['elb' + side], w = [h[0] - e2[0], h[1] - e2[1]], wl = Math.hypot(w[0], w[1]) || 1;
      rot = Math.atan2(w[1], w[0]) * 180 / Math.PI;
      c = [h[0] + w[0] / wl * 7, h[1] + w[1] / wl * 7];
    } else if (d.kind === 'goblet') {
      rot = Math.atan2(J.u[1], J.u[0]) * 180 / Math.PI;
      c = [h[0] + J.n[0] * 3, h[1] + J.n[1] * 3];
    }
    this.g.setAttribute('transform', 'translate(' + pt(c) + ') rotate(' + rot.toFixed(1) + ')');
  };
  function toward(J, a, b, k) {
    var p = J[a], q = J[b], l = dist(p, q) || 1;
    return [p[0] + (q[0] - p[0]) / l * k, p[1] + (q[1] - p[1]) / l * k];
  }
  function Band(parent, d) { this.d = d; this.e = E('path', { 'class': 'band' }, parent); }
  Band.prototype.draw = function (J) {
    var d = this.d, a, b;
    if (d.kind === 'link') {
      a = toward(J, d.a, d.ta, d.off); b = toward(J, d.b, d.tb, d.off);
      this.e.setAttribute('d', 'M' + pt(a) + 'L' + pt(b));
    } else {
      var c = toward(J, d.at, d.to, d.off), p = J[d.at], q = J[d.to];
      var v = [q[0] - p[0], q[1] - p[1]], l = Math.hypot(v[0], v[1]) || 1, w = [-v[1] / l * 7, v[0] / l * 7];
      this.e.setAttribute('d', 'M' + pt([c[0] - w[0], c[1] - w[1]]) + 'L' + pt([c[0] + w[0], c[1] + w[1]]));
    }
  };

  function Wheel(parent, d) {           // 健腹轮：手握在轮轴上，滚动时轮辐转动
    this.d = d;
    this.g = E('g', { 'class': 'wheel' }, parent);
    E('circle', { 'class': 'wheel-tire', r: 8.5 }, this.g);
    this.rot = E('g', {}, this.g);
    E('path', { 'class': 'wheel-spoke', d: 'M0,0L6.5,0M0,0L-3.25,5.63M0,0L-3.25,-5.63' }, this.rot);
    E('circle', { 'class': 'wheel-hub', r: 2.6 }, this.g);
  }
  Wheel.prototype.draw = function (J) {
    var h = J[this.d.at];
    this.g.setAttribute('transform', 'translate(' + pt(h) + ')');
    this.rot.setAttribute('transform', 'rotate(' + (h[0] / 8.5 * 180 / Math.PI).toFixed(1) + ')');
  };

  /* ---------- 握力器：单独画一只手和握力器的特写 ---------- */
  function GripFig(stage, def) {
    var svg = E('svg', { viewBox: VB.join(' '), 'class': 'fig-svg', role: 'img', 'aria-label': def.label || '握力器示范' });
    stage.appendChild(svg);
    var F0 = [110, 42], F1 = [84, 182], M0 = [126, 42];
    this.F0 = F0; this.F1 = F1; this.M0 = M0;
    this.aOpen = Math.atan2(170 - 42, 176 - 126); this.aClose = Math.atan2(183 - 42, 100 - 126); this.len = 142;
    var g = E('g', {}, svg);
    function xf(y) { return F0[0] + (F1[0] - F0[0]) * (y - F0[1]) / (F1[1] - F0[1]); }
    this.xf = xf;
    E('line', { 'class': 'grip-fore', x1: xf(170) - 18, y1: 174, x2: 20, y2: 230 }, g);
    E('path', { 'class': 'grip-hand', d: 'M' + [xf(84) - 34, 84] + 'L' + [xf(84) - 4, 84] + 'L' + [xf(178) - 4, 178] + 'L' + [xf(178) - 34, 178] + 'Z' }, g);
    E('circle', { 'class': 'grip-coil', cx: 118, cy: 30, r: 13 }, g);
    E('circle', { 'class': 'grip-coil', cx: 118, cy: 30, r: 6.5 }, g);
    E('line', { 'class': 'grip-arm', x1: F0[0], y1: F0[1], x2: F1[0], y2: F1[1] }, g);
    this.mov = E('line', { 'class': 'grip-arm' }, g);
    E('line', { 'class': 'grip-hand thumb', x1: xf(96) - 22, y1: 98, x2: xf(72) + 8, y2: 72 }, g);
    this.fingers = [98, 120, 142, 164].map(function (y) { return { y: y, e: E('line', { 'class': 'grip-hand finger' }, g) }; });
    this.kf = [0, 1, 1, 0];
    this.durs = [1, 1.2, 2, 0.6];
    this.lbls = ['用力捏紧 1 秒', '顶峰捏住 1–2 秒', '慢慢松开 2 秒', '手指放松'];
    this.total = 4.8; this.t = 0; this.lbl = null;
  }
  GripFig.prototype.render = function (t) {
    var i = 0, acc = 0;
    t = ((t % this.total) + this.total) % this.total;
    while (i < 3 && acc + this.durs[i] <= t) { acc += this.durs[i]; i++; }
    var u = ease(Math.min(1, (t - acc) / this.durs[i])), c = this.kf[i] + (this.kf[(i + 1) % 4] - this.kf[i]) * u;
    var a = this.aOpen + (this.aClose - this.aOpen) * c, M0 = this.M0, len = this.len;
    var M1 = [M0[0] + Math.cos(a) * len, M0[1] + Math.sin(a) * len];
    setLine(this.mov, M0, M1);
    var xf = this.xf;
    this.fingers.forEach(function (f) {
      var k = (f.y - M0[1]) / (M1[1] - M0[1]), xm = M0[0] + (M1[0] - M0[0]) * k;
      setLine(f.e, [xf(f.y) - 10, f.y - 2], [xm + 6, f.y + 3]);
    });
    if (this.lbls[i] !== this.lbl) { this.lbl = this.lbls[i]; if (this.onLabel) this.onLabel(this.lbl); }
  };

  /* ---------- 一个动画 ---------- */
  function Figure(stage, def) {
    var self = this;
    this.def = def;
    var vb = def.vb || VB;
    var svg = E('svg', { viewBox: vb.join(' '), 'class': 'fig-svg', role: 'img', 'aria-label': def.label || '动作示范' });
    stage.appendChild(svg);
    var gs = E('g', {}, svg);
    E('line', { 'class': 'floor', x1: vb[0], x2: vb[0] + vb[2], y1: G + 4, y2: G + 4 }, gs);
    if (def.post) E('rect', { 'class': 'post', x: def.post.x, y: vb[1], width: def.post.w, height: G + 4 - vb[1] }, gs);
    if (def.mat !== false) {
      var m = def.mat || [16, 224];
      E('rect', { 'class': 'mat', x: m[0], y: G, width: m[1] - m[0], height: 4, rx: 2 }, gs);
    }
    if (def.board) {                     // 俯卧撑板：一块薄板 + 把手
      var bd = def.board;
      E('rect', { 'class': 'pboard', x: bd.x, y: G - 3, width: bd.w, height: 3.5, rx: 1.5 }, gs);
      (bd.hx || []).forEach(function (x) {
        E('rect', { 'class': 'phandle', x: x - 6, y: G - 12, width: 12, height: 10, rx: 3 }, gs);
      });
    }
    if (def.box) {
      var bx = def.box;
      E('rect', { 'class': 'box', x: bx.x, y: bx.top, width: bx.w, height: G + 4 - bx.top, rx: 3 }, gs);
      if (bx.label) {
        var t = E('text', { 'class': 'box-lbl', x: bx.x + bx.w / 2, y: bx.top + Math.min(20, (G + 4 - bx.top) / 2 + 4), 'text-anchor': 'middle' }, gs);
        t.textContent = bx.label;
      }
    }
    this.poses = def.kf.map(function (k) { return merge(def.base, k); });
    this.durs = def.kf.map(function (k) { return k.d || 1; });
    this.lbls = def.kf.map(function (k) { return k.lbl || ''; });
    this.total = this.durs.reduce(function (s, x) { return s + x; }, 0);
    if (def.trace) {
      var pts = [];
      for (var i = 0; i <= 120; i++) pts.push(solve(def, this.poseAt(this.total * i / 120).pose)[def.trace]);
      E('path', { 'class': 'trace', d: 'M' + pts.map(pt).join('L') }, svg);
    }
    var gi = def.ghost == null ? (this.poses.length > 1 ? 1 : -1) : def.ghost;
    if (gi >= 0) new Body(E('g', { 'class': 'ghost' }, svg), def, true).draw(solve(def, this.poses[gi]));
    this.body = new Body(E('g', {}, svg), def, false);
    this.props = [];
    var slots = this.body.slots;
    function slotFor(at) {
      if (def.view === 'front') return slots.near;
      return /F$/.test(at) ? slots.far : slots.near;
    }
    (def.db || []).forEach(function (d) { self.props.push(new Dumbbell(slotFor(d.at), d)); });
    (def.wheel || []).forEach(function (d) { self.props.push(new Wheel(slotFor(d.at), d)); });
    (def.band || []).forEach(function (d) {
      var s = def.view === 'front' ? slots.far : (d.kind === 'cuff' ? slots.midN : slots.mid);
      self.props.push(new Band(s, d));
    });
    this.t = 0; this.lbl = null;
  }
  Figure.prototype.poseAt = function (t) {
    var i = 0, acc = 0, n = this.poses.length;
    t = ((t % this.total) + this.total) % this.total;
    while (i < n - 1 && acc + this.durs[i] <= t) { acc += this.durs[i]; i++; }
    var u = ease(Math.min(1, (t - acc) / this.durs[i]));
    return { pose: lerp(this.poses[i], this.poses[(i + 1) % n], u), i: i };
  };
  Figure.prototype.render = function (t) {
    var r = this.poseAt(t), J = solve(this.def, r.pose);
    this.body.draw(J);
    this.props.forEach(function (p) { p.draw(J); });
    var l = this.lbls[r.i];
    if (l !== this.lbl) { this.lbl = l; if (this.onLabel) this.onLabel(l); }
  };

  /* ---------- 播放调度：只动画可见的 ---------- */
  var live = [];
  var reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var io = 'IntersectionObserver' in global ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.target.__fig) e.target.__fig.visible = e.isIntersecting; });
  }, { rootMargin: '80px' }) : null;
  var last = 0;
  function tick(now) {
    var dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    for (var i = live.length - 1; i >= 0; i--) {
      var f = live[i];
      if (!f.wrap.isConnected) { if (io) io.unobserve(f.wrap); live.splice(i, 1); continue; }
      if (f.playing && f.visible) { f.t = (f.t + dt) % f.total; f.render(f.t); }
    }
    global.requestAnimationFrame(tick);
  }
  global.requestAnimationFrame(tick);

  function mount(host, def) {
    var wrap = document.createElement('div'); wrap.className = 'fig';
    var stage = document.createElement('div'); stage.className = 'fig-stage';
    var cap = document.createElement('div'); cap.className = 'fig-cap';
    var lab = document.createElement('span'); lab.className = 'fig-lbl';
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'fig-btn';
    cap.appendChild(lab); cap.appendChild(btn);
    wrap.appendChild(stage); wrap.appendChild(cap); host.appendChild(wrap);
    var f = def.custom === 'gripper' ? new GripFig(stage, def) : new Figure(stage, def);
    f.wrap = wrap;
    f.onLabel = function (t) { lab.textContent = t; };
    f.playing = !reduce; f.visible = !io;
    function sync() { btn.textContent = f.playing ? '暂停' : '播放'; btn.setAttribute('aria-pressed', String(!f.playing)); }
    function toggle() { f.playing = !f.playing; sync(); }
    btn.addEventListener('click', toggle);
    stage.addEventListener('click', toggle);
    sync(); f.render(0);
    wrap.__fig = f; live.push(f);
    if (io) io.observe(wrap);
    return f;
  }

  global.Fig = { mount: mount, solve: solve, G: G };
})(window);
