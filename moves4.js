/* 动作库（四）：俯卧撑板、健腹轮、握力器。 */
(function (global) {
  'use strict';
  var M = global.MOVES = global.MOVES || {};
  var RAD = Math.PI / 180;

  /* 健腹轮：膝盖是支点，大腿绕膝盖前倒，手握轮轴向前滚；肩的位置由“躯干长 48、手臂约 54”两圆求交得到 */
  function abwheel(phiEnd, wEnd, wall) {
    var K = [62, 182], Wy = 179.5;
    function hipAt(phi) { return [K[0] + 42 * Math.sin(phi * RAD), K[1] - 42 * Math.cos(phi * RAD)]; }
    function shoulder(hip, W, L2) {
      var dx = W[0] - hip[0], dy = W[1] - hip[1], d = Math.hypot(dx, dy);
      var a = (48 * 48 - L2 * L2 + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, 48 * 48 - a * a));
      var mx = hip[0] + a * dx / d, my = hip[1] + a * dy / d;
      var p1 = [mx - hh * dy / d, my + hh * dx / d], p2 = [mx + hh * dy / d, my - hh * dx / d];
      return p1[1] < p2[1] ? p1 : p2;
    }
    function pose(phi, wx) {
      var hip = hipAt(phi), W = [wx, Wy], S = shoulder(hip, W, 54);
      return { hip: hip, tor: Math.atan2(S[0] - hip[0], S[1] - hip[1]) / RAD, hd: 8,
               lN: { a: [-phi, -90], ft: -100 }, aN: { ik: W, b: -1 } };
    }
    var st = pose(0, 108), en = pose(phiEnd, wEnd);
    en.d = 0.6; en.lbl = wall ? '轮子碰到墙就停' : '最远处停一下，腰不塌';
    var back = pose(phiEnd, wEnd); back.d = 2; back.lbl = '用腹部把轮子拉回来 2 秒';
    return {
      view: 'side', hl: ['core'], ghost: 1, wheel: [{ at: 'handN' }],
      post: wall ? { x: wEnd + 10, w: 7 } : null,
      base: st,
      kf: [ { d: 3, lbl: '收紧腹部和臀部，慢慢推出去 3 秒' }, en, back, { d: 0.6, lbl: '回到起点，换口气' } ]
    };
  }

  var WHEEL_ERR = ['腰往下塌（腰会疼，马上停）', '屁股先往后坐，腹部没用上力', '推得太远，拉不回来'];
  var list = {
    abwall: {
      name: '健腹轮（跪姿 · 对墙）', cat: '腹部', mus: '腹直肌、腹横肌（抗伸展）、背阔肌',
      cues: ['跪在折起来的瑜伽垫上，面对墙，膝盖离墙约一臂半', '收紧腹部和臀部，慢慢把轮子推出去，碰到墙就停', '用腹部把轮子拉回来，全程腰不塌'],
      err: WHEEL_ERR, anim: abwheel(32, 148, true)
    },
    abwheel: {
      name: '健腹轮（跪姿）', cat: '腹部', mus: '腹直肌、腹横肌（抗伸展）、背阔肌',
      cues: ['跪在折起来的瑜伽垫上，手握轮子放在肩膀下方', '收紧腹部和臀部，慢慢推出去，推到腰快要塌之前就停', '每次比上次推远一点，目标是身体接近平行地面'],
      err: WHEEL_ERR, anim: abwheel(68, 190, false)
    },
    gripper: {
      name: '握力器', cat: '手臂', mus: '前臂屈肌、手指和手掌的握力',
      cues: ['固定的一边贴住掌根，四根手指勾住另一边', '用力捏到两个把手碰在一起，停 1–2 秒', '慢慢松开 2 秒，不要“啪”地弹开'],
      err: ['只捏一半就松', '松开太快', '手腕弯着用力'],
      anim: { custom: 'gripper', label: '握力器示范' }
    }
  };
  if (global.PUSHUP) {
    list.bdnarrow = {
      name: '窄距俯卧撑（俯卧撑板）', cat: '手臂', mus: '肱三头肌、胸大肌内侧、三角肌前束',
      cues: ['把手插在板子的三头位置（比肩窄），先跪姿做', '下放时手肘贴着身体往后走', '胸口下到比把手略低，用手臂后侧推起；能做标准俯卧撑后改成脚尖着地'],
      err: ['手肘向两侧张开', '塌腰', '手腕不舒服还硬做'],
      anim: global.PUSHUP('knee', true, true)
    };
  }
  for (var k in list) M[k] = list[k];
})(window);
