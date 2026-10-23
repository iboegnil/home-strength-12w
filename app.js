/* 页面逻辑：按“轮”（练三休一）安排的训练视图、动作库、俯卧撑进阶、打卡与记录（存在浏览器本地）。
   离线版：数据格式、存储键和网页版完全一样，可以直接导入网页版“复制全部记录”的内容；已有记录时导入前让用户选合并还是替换。 */
(function () {
  'use strict';
  var P = window.PLAN, M = window.MOVES;
  var KEY = 'home-strength-12w-v1';
  var DB = (function () { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })();
  function fix() { ['logs', 'done', 'body', 'tests', 'ui'].forEach(function (k) { if (!DB[k] || typeof DB[k] !== 'object') DB[k] = {}; }); }
  fix();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { /* 无痕模式等情况下只是不保存 */ } }

  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function $(id) { return document.getElementById(id); }
  function phaseOf(r) { return P.phases.filter(function (p) { return p.rounds.indexOf(r) >= 0; })[0]; }
  var PU_DEFAULT = { p1: 'pu_knee', p2: 'pu_bed', p3: 'pu_low', p4: 'pu_low' };
  var PU_IDS = ['pu_knee', 'pu_bed', 'pu_low', 'pu_std'];
  function puLevel(r) { return DB.ui.pu || PU_DEFAULT[phaseOf(r).key]; }
  function moveId(m, r) { return m === 'pushup' ? puLevel(r) : m; }
  function today() { var d = new Date(); return (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
  function setsOf(it, ri) { return it.sets[Math.min(ri, it.sets.length - 1)]; }
  var ALL_DAYS = P.dayKeys.concat(['R']);

  var state = { r: Math.min(DB.ui.r || 1, P.total), d: ALL_DAYS.indexOf(DB.ui.d) >= 0 ? DB.ui.d : 'A' };
  function persistUi() { DB.ui.r = state.r; DB.ui.d = state.d; save(); }
  function go(r, d) { state.r = r; state.d = d; persistUi(); renderTrain(); }

  /* ---------- 预计时长：组数 ×（做一组的时间 + 组间休息），加热身 10 分钟、放松 7 分钟 ---------- */
  function estimate(items, ri) {
    var sec = 0;
    items.forEach(function (it) {
      if (it.fin) { sec += it.mins[Math.min(ri, it.mins.length - 1)] * 60 + 60; return; }
      var nums = (it.reps.match(/\d+/g) || []).map(Number), work = 45, rest = 60, m;
      if (/秒/.test(it.reps) && nums.length) work = Math.max.apply(null, nums) * (/每侧/.test(it.reps) ? 2 : 1) + 10;
      else if (/最长|最多/.test(it.reps)) work = 75;
      else if (/每侧/.test(it.reps)) work = 80;
      if (/不休息/.test(it.rest)) rest = 0;
      else if ((m = it.rest.match(/(\d+)\s*分钟/))) rest = +m[1] * 60;
      else if ((m = it.rest.match(/(\d+)\s*秒/))) rest = +m[1];
      sec += setsOf(it, ri) * (work + rest) + 30;
    });
    return Math.round(sec / 60) + 17;
  }

  /* ---------- 轮与训练日选择 ---------- */
  function renderRounds() {
    var box = $('wk'); box.innerHTML = '';
    P.phases.forEach(function (ph) {
      var grp = h('div', 'wk-grp');
      grp.appendChild(h('span', 'wk-ph', ph.short));
      var row = h('div', 'wk-row');
      ph.rounds.forEach(function (r) {
        var b = h('button', 'wk-btn'); b.type = 'button';
        b.setAttribute('aria-pressed', String(r === state.r));
        b.setAttribute('aria-label', '第 ' + r + ' 轮');
        b.appendChild(h('span', 'wk-n', String(r)));
        var dots = h('span', 'wk-dots');
        P.dayKeys.forEach(function (d) { dots.appendChild(h('i', DB.done['r' + r + d] ? 'on' : '')); });
        b.appendChild(dots);
        b.addEventListener('click', function () { go(r, state.d); });
        row.appendChild(b);
      });
      grp.appendChild(row); box.appendChild(grp);
    });
  }
  function renderDays() {
    var box = $('days'); box.innerHTML = '';
    ALL_DAYS.forEach(function (d) {
      var b = h('button', 'day-btn' + (d === 'R' ? ' rest' : '')); b.type = 'button';
      b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(d === state.d));
      b.appendChild(h('span', 'day-l', P.dayNames[d] + (DB.done['r' + state.r + d] ? ' ✓' : '')));
      b.appendChild(h('span', 'day-s', P.dayShort[d]));
      b.addEventListener('click', function () { go(state.r, d); });
      box.appendChild(b);
    });
  }

  /* ---------- 今天练什么：按开始日期推算 ---------- */
  function parseDay(s) { var p = (s || '').split('-').map(Number); return p.length === 3 && p[0] ? new Date(p[0], p[1] - 1, p[2]) : null; }
  function renderToday() {
    var inp = $('start-date'), msg = $('today-msg'), btn = $('today-go');
    if (!inp) return;
    inp.value = DB.ui.start || '';
    btn.hidden = true;
    var s = parseDay(DB.ui.start);
    if (!s) { msg.textContent = '填上你开始练的日期，这里会告诉你今天该练哪一天。'; return; }
    var t = new Date(); t = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    var diff = Math.round((t - s) / 86400000);
    if (diff < 0) { msg.textContent = '还没到开始的日子，开始那天练第 1 轮的第 1 天。'; return; }
    if (diff >= P.total * 4) { msg.textContent = '按日期算，21 轮已经全部结束。'; return; }
    var r = Math.floor(diff / 4) + 1, d = ALL_DAYS[diff % 4];
    msg.textContent = '今天是第 ' + r + ' 轮 · ' + P.dayNames[d] + '（' + P.dayShort[d] + '）。';
    btn.hidden = false;
    btn.onclick = function () { go(r, d); };
  }
  function setupToday() {
    var inp = $('start-date'); if (!inp) return;
    inp.addEventListener('change', function () { DB.ui.start = inp.value; save(); renderToday(); });
  }

  /* ---------- 训练日 ---------- */
  function rxList(pairs) {
    var dl = h('dl', 'rx');
    pairs.forEach(function (p) { var g = h('div'); g.appendChild(h('dt', null, p[0])); g.appendChild(h('dd', null, p[1])); dl.appendChild(g); });
    return dl;
  }
  function moreBox(mv) {
    var det = h('details', 'more');
    det.appendChild(h('summary', null, '动作要点与常见错误'));
    det.appendChild(h('p', 'more-h', '要点'));
    var ul = h('ul', 'cues'); mv.cues.forEach(function (c) { ul.appendChild(h('li', null, c)); }); det.appendChild(ul);
    det.appendChild(h('p', 'more-h err-h', '常见错误'));
    var ul2 = h('ul', 'errs'); mv.err.forEach(function (c) { ul2.appendChild(h('li', null, c)); }); det.appendChild(ul2);
    return det;
  }
  function hasVals(s) { return s && s.some(function (x) { return x && (x[0] || x[1]); }); }
  function lastFor(id, r, d) {
    var order = P.dayKeys;
    for (var rr = r; rr >= 1; rr--) {
      for (var k = order.length - 1; k >= 0; k--) {
        if (rr === r && k >= order.indexOf(d)) continue;
        var L = DB.logs['r' + rr + order[k]];
        if (!L) continue;
        for (var i in L) if (L[i] && L[i].m === id && hasVals(L[i].s)) return { r: rr, d: order[k], s: L[i].s };
      }
    }
    return null;
  }
  function fmtSets(s, timed) {
    return s.filter(function (x) { return x && (x[0] || x[1]); }).map(function (x) {
      return (x[0] ? x[0] + 'kg×' : '') + (x[1] || '?') + (timed ? '秒' : '');
    }).join(' · ');
  }
  function puPicker(r) {
    var wrap = h('label', 'pu-pick');
    wrap.appendChild(h('span', null, '当前俯卧撑级别'));
    var sel = h('select'); sel.id = 'pu-sel-' + r;
    PU_IDS.forEach(function (id, i) { var o = h('option', null, (i + 1) + '. ' + M[id].name); o.value = id; sel.appendChild(o); });
    sel.value = puLevel(r);
    sel.addEventListener('change', function () { DB.ui.pu = sel.value; save(); renderTrain(); renderPuLine(); });
    wrap.appendChild(sel);
    return wrap;
  }
  function logBlock(it, sets, key, idx, id) {
    var timed = /秒|时间/.test(it.reps), weighted = /kg/.test(it.load) || (M[id].anim.db || []).length > 0;
    var wrap = h('div', 'log');
    function rec() {
      var L = DB.logs[key] = DB.logs[key] || {};
      var r = L[idx] = L[idx] || { m: id, s: [] };
      r.m = id;
      return r;
    }
    var cur = DB.logs[key] && DB.logs[key][idx];
    for (var s = 0; s < sets; s++) (function (s) {
      var v = (cur && cur.s[s]) || ['', '', false];
      var row = h('div', 'log-row' + (v[2] ? ' ok' : ''));
      row.appendChild(h('span', 'log-n', '第 ' + (s + 1) + ' 组'));
      function inp(i, ph, unit) {
        var lab = h('label', 'log-f');
        var e = h('input'); e.type = 'number'; e.inputMode = 'decimal'; e.min = '0'; e.step = i === 0 ? '0.5' : '1';
        e.id = 'lg-' + key + '-' + idx + '-' + s + '-' + i; e.placeholder = ph; e.value = v[i] || '';
        e.setAttribute('aria-label', '第 ' + (s + 1) + ' 组' + ph);
        e.addEventListener('input', function () { var r = rec(); r.s[s] = r.s[s] || ['', '', false]; r.s[s][i] = e.value; save(); });
        lab.appendChild(e); lab.appendChild(h('span', null, unit)); row.appendChild(lab);
      }
      if (weighted) inp(0, '重量', 'kg');
      inp(1, timed ? '时间' : '次数', timed ? '秒' : '次');
      var ok = h('button', 'log-ok', '✓'); ok.type = 'button';
      ok.setAttribute('aria-pressed', String(!!v[2])); ok.setAttribute('aria-label', '第 ' + (s + 1) + ' 组完成');
      ok.addEventListener('click', function () {
        var r = rec(); r.s[s] = r.s[s] || ['', '', false]; r.s[s][2] = !r.s[s][2]; save();
        ok.setAttribute('aria-pressed', String(r.s[s][2])); row.classList.toggle('ok', r.s[s][2]);
      });
      row.appendChild(ok);
      wrap.appendChild(row);
    })(s);
    return wrap;
  }
  function exCard(it, ri, key, idx, r) {
    var id = moveId(it.m, r), mv = M[id], sets = setsOf(it, ri);
    var art = h('article', 'ex');
    var fig = h('div', 'ex-fig'); art.appendChild(fig); Fig.mount(fig, mv.anim);
    var body = h('div', 'ex-body');
    var top = h('div', 'ex-top');
    top.appendChild(h('span', 'ex-tag', it.g));
    top.appendChild(h('h4', 'ex-name', mv.name));
    body.appendChild(top);
    if (it.m === 'pushup') body.appendChild(puPicker(r));
    body.appendChild(rxList([['组数', sets + ' 组'], ['次数', it.reps], ['组间休息', it.rest], ['节奏（秒）', it.tempo], ['重量', it.load]]));
    if (it.note) body.appendChild(h('p', 'ex-note', it.note));
    body.appendChild(h('p', 'ex-mus', '目标肌群：' + mv.mus));
    body.appendChild(moreBox(mv));
    body.appendChild(logBlock(it, sets, key, idx, id));
    var last = lastFor(id, r, state.d);
    if (last) body.appendChild(h('p', 'ex-last', '上次（第 ' + last.r + ' 轮 ' + P.dayNames[last.d] + '）：' + fmtSets(last.s, /秒|时间/.test(it.reps))));
    art.appendChild(body);
    return art;
  }
  function finCard(it, ri, key, idx, r) {
    var mins = it.mins[Math.min(ri, it.mins.length - 1)];
    var sec = h('section', 'fin');
    var top = h('div', 'ex-top');
    top.appendChild(h('span', 'ex-tag', it.g));
    top.appendChild(h('h4', 'ex-name', it.title + ' · ' + mins + ' 分钟'));
    sec.appendChild(top);
    sec.appendChild(h('p', 'fin-desc', it.desc));
    var grid = h('div', 'fin-grid');
    grid.style.setProperty('--n', it.items.length);
    it.items.forEach(function (x, i) {
      var id = moveId(x.m, r), mv = M[id], c = h('div', 'fin-it');
      var f = h('div', 'fin-fig'); c.appendChild(f); Fig.mount(f, mv.anim);
      c.appendChild(h('p', 'fin-n', (it.fin === 'emom' ? '第 ' + (i + 1) + ' 分钟 · ' : (i + 1) + '. ') + mv.name));
      c.appendChild(h('p', 'fin-r', x.reps + (x.load && x.load !== '自重' ? ' · ' + x.load : '')));
      c.appendChild(moreBox(mv));
      grid.appendChild(c);
    });
    sec.appendChild(grid);
    var lab = h('label', 'fin-log');
    lab.appendChild(h('span', null, it.fin === 'amrap' ? '完成轮数' : '跟上节奏的分钟数'));
    var e = h('input'); e.type = 'text'; e.inputMode = 'decimal'; e.id = 'fin-' + key + '-' + idx;
    e.placeholder = it.fin === 'amrap' ? '例如 4 轮 + 6 次' : '例如 ' + mins + ' / ' + mins;
    var L = DB.logs[key]; e.value = (L && L['fin' + idx]) || '';
    e.addEventListener('input', function () { DB.logs[key] = DB.logs[key] || {}; DB.logs[key]['fin' + idx] = e.value; save(); });
    lab.appendChild(e); sec.appendChild(lab);
    return sec;
  }
  function flowBlock(title, dur, list, tip, open) {
    var det = h('details', 'flow'); det.open = !!open;
    var sum = h('summary');
    sum.appendChild(h('span', 'flow-t', title));
    sum.appendChild(h('span', 'flow-d', dur + ' · ' + list.length + ' 个动作'));
    det.appendChild(sum);
    var grid = null, grp = null;
    list.forEach(function (x, i) {
      if (!grid || x.grp !== grp) {
        grp = x.grp;
        if (grp) det.appendChild(h('p', 'flow-g', grp));
        grid = h('div', 'flow-grid'); det.appendChild(grid);
      }
      var mv = M[x.m], c = h('div', 'flow-it');
      var f = h('div', 'flow-fig'); c.appendChild(f); Fig.mount(f, mv.anim);
      c.appendChild(h('p', 'flow-n', (i + 1) + '. ' + mv.name));
      c.appendChild(h('p', 'flow-r', x.dose));
      grid.appendChild(c);
    });
    if (tip) det.appendChild(h('p', 'flow-tip', tip));
    return det;
  }
  function dayHeader(root, ph, pills, focus) {
    var hd = h('div', 'day-hd');
    hd.appendChild(h('p', 'eyebrow', ph.name + ' · 第 ' + state.r + ' 轮'));
    hd.appendChild(h('h3', 'day-title', P.dayNames[state.d] + ' · ' + P.dayShort[state.d]));
    if (focus) hd.appendChild(h('p', 'day-focus', '重点：' + focus));
    var pl = h('div', 'pills');
    pills.forEach(function (t) { pl.appendChild(h('span', 'pill', t)); });
    hd.appendChild(pl);
    root.appendChild(hd);
    return hd;
  }
  function renderRest(root, ph) {
    dayHeader(root, ph, ['休息日', '走路 8000–10000 步']);
    var c = h('div', 'card rest-card');
    var ul = h('ul', 'ticks');
    ['今天不练力量，让肌肉恢复。肌肉酸是正常的，走一走反而恢复得更快。',
     '走路 8000–10000 步，去你觉得安全的地方，或者在家穿软底拖鞋慢慢原地踏步。',
     '想动一动的话，做一遍下面的放松拉伸，大约 8 分钟。',
     '吃够蛋白质、睡够 7–9 小时，明天开始下一轮的第 1 天。'].forEach(function (t) { ul.appendChild(h('li', null, t)); });
    c.appendChild(ul);
    root.appendChild(c);
    root.appendChild(flowBlock('放松拉伸（可选）', '约 8 分钟', P.cooldown.rest, '拉伸到有感觉就停，不要弹振，正常呼吸。', true));
  }
  function renderDay() {
    var r = state.r, d = state.d, ph = phaseOf(r), ri = ph.rounds.indexOf(r), key = 'r' + r + d;
    var root = $('day'); root.innerHTML = '';
    if (d === 'R') { renderRest(root, ph); return; }
    var items = P.days[ph.key][d];
    var est = estimate(items, ri);
    var hd = dayHeader(root, ph, ['预计约 ' + Math.round(est / 5) * 5 + ' 分钟', ph.rir, '全程无跳跃'], P.dayFocus[d]);
    hd.appendChild(h('p', 'day-goal', ph.goal));
    var note = h('p', 'day-note'); note.appendChild(h('b', null, '本轮重点 ')); note.appendChild(document.createTextNode(P.notes[r]));
    hd.appendChild(note);
    root.appendChild(flowBlock('热身', '约 10 分钟', P.warmup[P.flow[d]], '热身最后，用第一个力量动作一半左右的重量做 1 组 8 次，当作热身组。', !DB.done[key]));
    var list = h('div', 'ex-list'), seen = {};
    items.forEach(function (it, idx) {
      var letter = /^[A-Z]\d$/.test(it.g) ? it.g[0] : null;
      if (letter && !seen[letter] && items.some(function (o, j) { return j !== idx && o.g && o.g[0] === letter && /\d$/.test(o.g); })) {
        seen[letter] = 1;
        var pair = items.filter(function (o) { return o.g && o.g[0] === letter && !o.fin; }).map(function (o) { return o.g; });
        var drop = items.some(function (o) { return o.g && o.g[0] === letter && o.note; });
        list.appendChild(h('p', 'ss-hd', drop
          ? '递减组 ' + letter + '：' + pair.join(' → ') + ' 连着做，中间不休息，做完再按表休息'
          : '超级组 ' + letter + '：' + pair.join(' → ') + ' 交替做，按各自的休息时间走完一轮，再开始下一轮'));
      }
      list.appendChild(it.fin ? finCard(it, ri, key, idx, r) : exCard(it, ri, key, idx, r));
    });
    root.appendChild(list);
    root.appendChild(flowBlock('放松', '约 7 分钟', P.cooldown[P.flow[d]], '拉伸到有感觉就停，不要弹振，保持正常呼吸。', !DB.done[key]));
    var done = DB.done[key];
    var btn = h('button', 'done-btn' + (done ? ' is-done' : ''), done ? '已完成（' + done + '）· 点击撤销' : '完成本次训练，打卡');
    btn.type = 'button';
    btn.addEventListener('click', function () {
      if (DB.done[key]) delete DB.done[key]; else DB.done[key] = today();
      save(); renderTrain(); renderGrid();
    });
    root.appendChild(btn);
  }
  function renderTrain() { renderRounds(); renderDays(); renderDay(); renderVolume(); }

  /* ---------- 每轮各部位组数（从计划数据直接算） ---------- */
  var VOL = [['二头', '重点'], ['三头', '重点'], ['腹部', '重点'], ['胸', '其次'], ['肩', '其次'], ['背', '其次'], ['腿臀', '辅助']];
  function renderVolume() {
    var box = $('vol'); if (!box) return;
    var r = state.r, ph = phaseOf(r), ri = ph.rounds.indexOf(r), tot = {}, src = {}, mins = [];
    P.dayKeys.forEach(function (d) {
      mins.push(P.dayNames[d] + ' 约 ' + Math.round(estimate(P.days[ph.key][d], ri) / 5) * 5 + ' 分钟');
      P.days[ph.key][d].forEach(function (it) {
        if (it.fin) return;
        var g = P.muscle[it.m]; if (!g) return;
        var n = setsOf(it, ri);
        tot[g] = (tot[g] || 0) + n;
        src[g] = src[g] || {}; var nm = M[moveId(it.m, r)].name; src[g][nm] = (src[g][nm] || 0) + n;
      });
    });
    var max = Math.max.apply(null, VOL.map(function (v) { return tot[v[0]] || 0; })) || 1;
    box.innerHTML = '';
    $('vol-w').textContent = '第 ' + r + ' 轮';
    var pick = $('vol-pick'); if (pick) pick.textContent = '';
    $('vol-time').textContent = mins.join(' · ');
    VOL.forEach(function (v) {
      var n = tot[v[0]] || 0, detail = Object.keys(src[v[0]] || {}).map(function (k) { return k + ' ' + src[v[0]][k]; }).join('，');
      var row = h('div', 'vol-row' + (v[1] === '重点' ? ' key' : ''));
      row.title = v[0] + ' ' + n + ' 组：' + detail;
      row.setAttribute('aria-label', row.title);
      row.addEventListener('click', function () { if (pick) pick.textContent = row.title; });  // 手机上没有鼠标悬停，点一下显示
      var lab = h('span', 'vol-l'); lab.appendChild(h('b', null, v[0])); lab.appendChild(h('small', null, v[1])); row.appendChild(lab);
      var track = h('span', 'vol-t'); var bar = h('i'); bar.style.width = (n / max * 100).toFixed(1) + '%'; track.appendChild(bar); row.appendChild(track);
      row.appendChild(h('span', 'vol-n num', n + ' 组'));
      box.appendChild(row);
    });
  }

  /* ---------- 俯卧撑进阶线 ---------- */
  var PU_RULE = {
    pu_knee: '能做 3 组 × 12 次，换下一级', pu_bed: '能做 3 组 × 12 次，换下一级',
    pu_low: '能做 3 组 × 10 次，换下一级', pu_std: '先做到 3 组 × 5 次，再慢慢加到 3 组 × 12 次'
  };
  function renderPuLine() {
    var box = $('pu-line'); if (!box) return; box.innerHTML = '';
    var cur = puLevel(state.r);
    PU_IDS.forEach(function (id, i) {
      var mv = M[id], c = h('div', 'pu-step' + (id === cur ? ' cur' : ''));
      var f = h('div', 'pu-fig'); c.appendChild(f); Fig.mount(f, mv.anim);
      c.appendChild(h('p', 'pu-lv', '第 ' + (i + 1) + ' 级'));
      c.appendChild(h('h4', 'pu-n', mv.name));
      c.appendChild(h('p', 'pu-r', PU_RULE[id]));
      var b = h('button', 'pu-set', id === cur ? '当前级别' : '设为当前级别'); b.type = 'button';
      b.setAttribute('aria-pressed', String(id === cur));
      b.addEventListener('click', function () { DB.ui.pu = id; save(); renderPuLine(); renderTrain(); });
      c.appendChild(b);
      box.appendChild(c);
    });
  }

  /* ---------- 动作库 ---------- */
  var CATS = ['全部', '手臂', '腹部', '胸肩', '背', '腿臀', '代谢', '热身', '放松'];
  var libCat = CATS.indexOf(DB.ui.lib) >= 0 ? DB.ui.lib : '全部';
  function renderLib() {
    var chips = $('lib-cats'); chips.innerHTML = '';
    CATS.forEach(function (c) {
      var b = h('button', 'chip', c); b.type = 'button'; b.setAttribute('aria-pressed', String(c === libCat));
      b.addEventListener('click', function () { libCat = c; DB.ui.lib = c; save(); renderLib(); });
      chips.appendChild(b);
    });
    var grid = $('lib-grid'); grid.innerHTML = '';
    Object.keys(M).sort(function (a, b) { return CATS.indexOf(M[a].cat) - CATS.indexOf(M[b].cat); }).forEach(function (id) {
      var mv = M[id];
      if (libCat !== '全部' && mv.cat !== libCat) return;
      var c = h('article', 'lib-card');
      var f = h('div', 'lib-fig'); c.appendChild(f); Fig.mount(f, mv.anim);
      var b = h('div', 'lib-body');
      var t = h('div', 'lib-top'); t.appendChild(h('h4', null, mv.name)); t.appendChild(h('span', 'cat', mv.cat)); b.appendChild(t);
      b.appendChild(h('p', 'ex-mus', '目标肌群：' + mv.mus));
      b.appendChild(h('p', 'more-h', '要点'));
      var ul = h('ul', 'cues'); mv.cues.forEach(function (x) { ul.appendChild(h('li', null, x)); }); b.appendChild(ul);
      b.appendChild(h('p', 'more-h err-h', '常见错误'));
      var ul2 = h('ul', 'errs'); mv.err.forEach(function (x) { ul2.appendChild(h('li', null, x)); }); b.appendChild(ul2);
      c.appendChild(b); grid.appendChild(c);
    });
  }

  /* ---------- 记录 ---------- */
  function renderGrid() {
    var box = $('grid'); box.innerHTML = '';
    var n = 0;
    var tbl = h('table', 'chk');
    var thead = h('tr'); thead.appendChild(h('th', null, '轮'));
    P.dayKeys.forEach(function (d) { thead.appendChild(h('th', null, P.dayShort[d])); });
    tbl.appendChild(thead);
    for (var r = 1; r <= P.total; r++) (function (r) {
      var tr = h('tr'); tr.appendChild(h('th', null, '第 ' + r + ' 轮'));
      P.dayKeys.forEach(function (d) {
        var k = 'r' + r + d, td = h('td'), b = h('button', 'chk-b'); b.type = 'button';
        if (DB.done[k]) n++;
        b.textContent = DB.done[k] ? '✓ ' + DB.done[k] : '';
        b.setAttribute('aria-pressed', String(!!DB.done[k]));
        b.setAttribute('aria-label', '第 ' + r + ' 轮 ' + P.dayNames[d]);
        b.addEventListener('click', function () {
          if (DB.done[k]) delete DB.done[k]; else DB.done[k] = today();
          save(); renderGrid(); renderTrain();
        });
        td.appendChild(b); tr.appendChild(td);
      });
      tbl.appendChild(tr);
    })(r);
    box.appendChild(tbl);
    $('grid-sum').textContent = '已完成 ' + n + ' / ' + (P.total * P.dayKeys.length) + ' 次训练';
  }
  function field(store, k, ph, type) {
    var e = h('input'); e.type = type || 'number'; e.inputMode = 'decimal'; e.id = 'f-' + k; e.placeholder = ph || '';
    e.value = store[k] || '';
    e.addEventListener('input', function () { store[k] = e.value; save(); });
    return e;
  }
  function renderTests() {
    var box = $('tests'); box.innerHTML = '';
    var rows = [['pu', '俯卧撑最多次数（注明级别）', 'text'], ['curl', '每只 6kg 弯举最多次数'], ['plank', '平板支撑最长时间（秒）'],
      ['wt', '体重 kg（一周早晨空腹平均）'], ['waist', '腰围 cm（肚脐高度）'], ['arm', '上臂围 cm（用力弯曲时最粗处）']];
    var tbl = h('table', 'tbl');
    var tr = h('tr'); ['项目', '第 2 轮', '第 21 轮'].forEach(function (t) { tr.appendChild(h('th', null, t)); }); tbl.appendChild(tr);
    rows.forEach(function (r) {
      var row = h('tr'); row.appendChild(h('th', null, r[1]));
      ['r2', 'r21'].forEach(function (c) { var td = h('td'); td.appendChild(field(DB.tests, r[0] + '-' + c, r[2] ? '如 跪姿 14' : '', r[2])); row.appendChild(td); });
      tbl.appendChild(row);
    });
    box.appendChild(tbl);
    var bbox = $('body-log'); bbox.innerHTML = '';
    var t2 = h('table', 'tbl');
    var hr = h('tr'); ['周', '平均体重 kg', '腰围 cm', '上臂围 cm', '日均步数'].forEach(function (t) { hr.appendChild(h('th', null, t)); }); t2.appendChild(hr);
    for (var w = 1; w <= 12; w++) {
      var row = h('tr'); row.appendChild(h('th', null, '第 ' + w + ' 周'));
      ['wt', 'waist', 'arm', 'steps'].forEach(function (k) { var td = h('td'); td.appendChild(field(DB.body, k + w, '')); row.appendChild(td); });
      t2.appendChild(row);
    }
    bbox.appendChild(t2);
  }
  /* ---------- 备份与恢复（离线版）：同样的 JSON 格式；已有记录时让用户选合并还是替换 ---------- */
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function hasData(d) {
    return ['logs', 'done', 'body', 'tests'].some(function (k) { return isObj(d[k]) && Object.keys(d[k]).length > 0; }) ||
      !!(isObj(d.ui) && (d.ui.start || d.ui.pu));
  }
  // 从微信、备忘录粘贴过来时前后可能多出文字，只取第一个 { 到最后一个 } 之间的部分
  function parseBackup(text) {
    var t = String(text || ''), a = t.indexOf('{'), b = t.lastIndexOf('}'), d = null;
    if (a < 0 || b <= a) return null;
    t = t.slice(a, b + 1);
    try { d = JSON.parse(t); } catch (e) { try { d = JSON.parse(t.replace(/[“”]/g, '"')); } catch (e2) { return null; } }
    return isObj(d) && isObj(d.logs) ? d : null;
  }
  // 合并：两边都保留；同一个键（如 r1A、wt3、start）两边都有时，以导入的为准
  function mergeIn(cur, inc) {
    var out = JSON.parse(JSON.stringify(cur));
    Object.keys(inc).forEach(function (k) {
      if (isObj(inc[k]) && isObj(out[k])) Object.keys(inc[k]).forEach(function (kk) { out[k][kk] = inc[k][kk]; });
      else out[k] = inc[k];
    });
    return out;
  }
  function applyDB(d) {
    DB = d; fix(); save();
    state.r = Math.min(DB.ui.r || 1, P.total); state.d = ALL_DAYS.indexOf(DB.ui.d) >= 0 ? DB.ui.d : 'A';
    libCat = CATS.indexOf(DB.ui.lib) >= 0 ? DB.ui.lib : '全部';
    renderAllData(); renderLib(); setupIntro();
  }
  function setupBackup() {
    var ta = $('bk-text'), msg = $('bk-msg'), ask = $('bk-ask'), pending = null;
    function selectAll() { ta.focus(); ta.select(); try { ta.setSelectionRange(0, ta.value.length); } catch (e) { /* 有的浏览器不支持 */ } }
    var manual = '已放进下面的文本框并选中，长按选「拷贝」（电脑上按 Ctrl/⌘ + C）。';
    $('bk-copy').addEventListener('click', function () {
      ta.value = JSON.stringify(DB); ask.hidden = true; pending = null;
      var done = function () { msg.textContent = '已复制。粘贴到备忘录里保存即可。'; };
      try {
        navigator.clipboard.writeText(ta.value).then(done, function () { selectAll(); msg.textContent = manual; });
      } catch (e) { selectAll(); msg.textContent = manual; }
    });
    function count(o) { return Object.keys(o).filter(function (k) { return /^r\d+[ABC]$/.test(k); }).length; }  // 不算旧版本留下的 w… 键
    function finish(d, how) {
      applyDB(d); pending = null; ask.hidden = true;
      msg.textContent = (how === '恢复' ? '已恢复记录' : '已' + how) + '：现在一共有 ' + count(DB.done) + ' 次打卡、' +
        count(DB.logs) + ' 个训练日的每组记录。';
    }
    $('bk-load').addEventListener('click', function () {
      var d = parseBackup(ta.value);
      if (!d) { ask.hidden = true; pending = null; msg.textContent = '文本框里不是这个页面导出的记录，请粘贴“复制全部记录”得到的完整内容。'; return; }
      if (!hasData(DB)) { finish(d, '恢复'); return; }
      pending = d; ask.hidden = false; msg.textContent = '';
      ask.scrollIntoView({ block: 'nearest' });
    });
    $('bk-merge').addEventListener('click', function () { if (pending) finish(mergeIn(DB, pending), '合并'); });
    $('bk-replace').addEventListener('click', function () { if (pending) finish(pending, '替换'); });
    $('bk-cancel').addEventListener('click', function () { pending = null; ask.hidden = true; msg.textContent = '已取消，记录没有改动。'; });
    var armed = 0, clr = $('bk-clear');
    clr.addEventListener('click', function () {
      if (Date.now() - armed < 4000) {
        DB = {}; fix(); save(); state = { r: 1, d: 'A' };
        renderAllData(); clr.textContent = '清空所有记录'; msg.textContent = '记录已清空。'; armed = 0;
      } else { armed = Date.now(); clr.textContent = '再点一次确认清空'; setTimeout(function () { clr.textContent = '清空所有记录'; }, 4000); }
    });
  }
  function renderAllData() { renderTrain(); renderPuLine(); renderGrid(); renderTests(); renderToday(); }

  /* ---------- 第一次打开：提示装到主屏幕、把网页版的旧记录搬过来 ---------- */
  var INTRO_KEY = KEY + '-offline-intro';
  function standalone() { return window.navigator.standalone === true || !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches); }
  function setupIntro() {
    var box = $('mig'); if (!box) return;
    var off = false; try { off = localStorage.getItem(INTRO_KEY) === '1'; } catch (e) { /* 不能存就每次都提示 */ }
    var inst = !standalone(), move = !hasData(DB);
    $('mig-install').hidden = !inst; $('mig-move').hidden = !move; $('mig-paste').hidden = !move;
    $('mig-n').textContent = inst ? '2. ' : '';
    box.hidden = off || !(inst || move);
  }
  function bindIntro() {
    if (!$('mig')) return;
    $('mig-paste').addEventListener('click', function () {
      var ta = $('bk-text'); ta.scrollIntoView({ block: 'center' }); ta.focus({ preventScroll: true });
    });
    $('mig-off').addEventListener('click', function () { try { localStorage.setItem(INTRO_KEY, '1'); } catch (e) { /* 同上 */ } $('mig').hidden = true; });
    // 主屏幕应用里请求“持久存储”，减少系统清理网站数据的可能
    if (standalone() && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
  }

  document.querySelectorAll('[data-go]').forEach(function (a) {
    a.addEventListener('click', function () { go(1, 'A'); });
  });
  setupToday();
  renderAllData(); renderLib(); setupBackup(); bindIntro(); setupIntro();
})();
