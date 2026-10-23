/* 动作库（一）：下肢与推类动作。anim 字段是给 figure.js 的关键帧数据。 */
(function (global) {
  'use strict';
  var M = global.MOVES = global.MOVES || {};
  var R = Math.PI / 180;

  var STAND = { hip: [110, 101], tor: 180, hd: 0, lN: { ik: [112, 183], b: 1 } };
  var DB2 = [{ at: 'handF', kind: 'round' }, { at: 'handN', kind: 'round' }];
  function S(base, extra) { var o = {}, k; for (k in base) o[k] = base[k]; for (k in extra) o[k] = extra[k]; return o; }

  /* 俯卧撑四个级别共用一个生成器：身体绕支点（膝盖或脚尖）转动，双手固定 */
  function pushup(kind, narrow) {
    var c = {
      knee: { pivY: 181, len: 90, hand: [150, 184] },
      bed:  { pivY: 176, len: 131, hand: [176, 141], box: { x: 166, w: 74, top: 146, label: '床沿' } },
      low:  { pivY: 177, len: 131, hand: [172, 160], box: { x: 162, w: 64, top: 165, label: '矮凳' } },
      std:  { pivY: 177, len: 131, hand: [164, 184] }
    }[kind];
    // 底部：肩在手掌稍前上方；由此反推支点（膝盖或脚尖）位置
    var H = c.hand, Sb = [H[0] + 5, H[1] - 14], legLen = kind === 'knee' ? 42 : 83;
    var A = [Sb[0] - Math.sqrt(c.len * c.len - Math.pow(c.pivY - Sb[1], 2)), c.pivY];
    function at(th) { return [A[0] + c.len * Math.cos(th * R), A[1] - c.len * Math.sin(th * R)]; }
    var top = 0, bd = 1e9;
    for (var th = 0; th <= 75; th += 0.25) {
      var s = at(th), d = Math.abs(Math.hypot(s[0] - H[0], s[1] - H[1]) - 55);
      if (s[0] <= H[0] + 4 && d < bd) { bd = d; top = th; }
    }
    var bot = Math.asin((A[1] - Sb[1]) / c.len) / R;
    function pose(th, bottom) {
      var u = [Math.cos(th * R), -Math.sin(th * R)];
      var hip = [A[0] + u[0] * legLen, A[1] + u[1] * legLen];
      var tor = Math.atan2(u[0], u[1]) / R;
      var p = { hip: hip, tor: tor, aN: { ik: H, b: -1, ls: bottom ? (narrow ? [0.8, 0.95] : [0.45, 0.95]) : [1, 1] } };
      if (kind === 'knee') p.lN = { a: [tor + 180 - 360, -105], ft: -150 };
      return p;
    }
    var base = pose(top, false);
    base.hd = 0;
    if (kind !== 'knee') base.lN = { ik: A, b: 1, ft: 60 };
    var low = pose(bot, true);
    var where = kind === 'bed' ? '胸口碰到床沿' : kind === 'low' ? '胸口碰到凳面' : '胸口离地约一拳';
    return {
      view: 'side', trace: 'shN', hl: narrow ? ['uarm', 'chest'] : ['chest', 'uarm'], box: c.box,
      base: base,
      kf: [
        S({}, { d: 2, lbl: '身体一条直线，下放 2 秒' }),
        S(low, { d: 0.5, lbl: where }),
        S(low, { d: 1, lbl: '推起 1 秒' }),
        S({}, { d: 0.6, lbl: '顶端稳住' })
      ]
    };
  }

  var PU_MUS = '胸大肌、肱三头肌、三角肌前束、核心';
  var PU_ERR = ['塌腰或屁股翘高，身体不成直线', '手肘向两侧张开成 90°', '只做半程，胸口没下去'];

  var list = {
    goblet: {
      name: '高脚杯深蹲', cat: '腿臀', mus: '股四头肌、臀大肌（内收肌、核心辅助）',
      cues: ['哑铃竖着贴在胸前，双手托住上端，手肘朝下', '臀部向后向下坐，膝盖跟着脚尖方向打开', '蹲到大腿接近水平，全脚掌发力站起'],
      err: ['膝盖向内扣', '脚跟抬起，重心跑到脚尖', '弯腰低头，哑铃离开胸口'],
      anim: { view: 'side', trace: 'pelvis', hl: ['thigh', 'glute'], db: [{ at: 'handN', kind: 'goblet' }],
        base: { hip: [108, 102], tor: 180, hd: 0, lN: { ik: [110, 183], b: 1 }, aN: { tk: [13, 8], b: -1 } },
        kf: [ { d: 3, lbl: '下蹲 3 秒' },
              { hip: [82, 148], tor: 145, hd: -12, d: 1, lbl: '底部停 1 秒' },
              { hip: [82, 148], tor: 145, hd: -12, d: 1, lbl: '发力站起 1 秒' },
              { d: 0.7, lbl: '站直，呼气' } ] }
    },
    bwsquat: {
      name: '徒手深蹲', cat: '热身', mus: '股四头肌、臀大肌',
      cues: ['双脚略宽于肩，脚尖微微朝外', '下蹲时双臂向前伸，帮助保持平衡', '慢慢做，蹲到舒服的深度'],
      err: ['膝盖向内扣', '脚跟离地'],
      anim: { view: 'side', trace: 'pelvis', hl: ['thigh', 'glute'],
        base: { hip: [108, 102], tor: 180, hd: 0, lN: { ik: [110, 183], b: 1 }, aN: { a: [8, 8] } },
        kf: [ { d: 1.6, lbl: '下蹲，手臂前伸' },
              { hip: [82, 148], tor: 147, hd: -12, aN: { a: [86, 86] }, d: 0.3, lbl: '底部' },
              { hip: [82, 148], tor: 147, hd: -12, aN: { a: [86, 86] }, d: 1.2, lbl: '站起' },
              { d: 0.4, lbl: '站直' } ] }
    },
    rdl: {
      name: '哑铃罗马尼亚硬拉', cat: '腿臀', mus: '腘绳肌（大腿后侧）、臀大肌、竖脊肌',
      cues: ['膝盖微屈后角度基本不变，臀部向后推', '哑铃贴着大腿、小腿往下滑', '背部始终平直，大腿后侧有拉伸感就站起'],
      err: ['弯腰弓背去够地面', '膝盖弯太多，变成了深蹲', '站起时后仰挺肚子'],
      anim: { view: 'side', trace: 'handN', hl: ['thigh', 'glute'], db: DB2,
        base: S(STAND, { aN: { a: [4, 4] } }),
        kf: [ { d: 3, lbl: '臀部向后推，下放 3 秒' },
              { hip: [84, 108], tor: 95, hd: -12, aN: { a: [-8, -8] }, d: 0.6, lbl: '大腿后侧有拉伸感' },
              { hip: [84, 108], tor: 95, hd: -12, aN: { a: [-8, -8] }, d: 1.2, lbl: '夹臀站直 1 秒' },
              { d: 0.6, lbl: '站直' } ] }
    },
    hinge: {
      name: '髋铰链练习', cat: '热身', mus: '臀大肌、大腿后侧（练动作模式）',
      cues: ['双手放在髋部两侧，臀部向后推，像用屁股关门', '背部平直，视线看向前下方', '大腿后侧有拉伸感就收回'],
      err: ['弯腰低头', '膝盖向前顶'],
      anim: { view: 'side', trace: 'pelvis', hl: ['glute'],
        base: S(STAND, { aN: { to: 'pelvis', off: [3, -2], b: -1 } }),
        kf: [ { d: 1.8, lbl: '臀部向后推' },
              { hip: [84, 108], tor: 98, hd: -12, d: 0.4, lbl: '背部平直' },
              { hip: [84, 108], tor: 98, hd: -12, d: 1.2, lbl: '夹臀站直' },
              { d: 0.4, lbl: '站直' } ] }
    },
    revlunge: {
      name: '后撤箭步蹲', cat: '腿臀', mus: '股四头肌、臀大肌（单侧）',
      cues: ['一只脚向后撤一大步，前脚全脚掌踩稳', '身体垂直向下，后膝接近地面但不碰地', '用前脚跟发力把身体推回原位'],
      err: ['前膝向内扣', '步子太小，前脚跟抬起', '后膝砸地（伤膝盖，也会吵到楼下）'],
      anim: { view: 'side', trace: 'pelvis', hl: ['thighN', 'glute'], db: DB2,
        base: { hip: [118, 102], tor: 180, hd: 0, lN: { ik: [120, 183], b: 1 }, lF: { ik: [116, 183], b: 1, ft: 85 },
                aN: { a: [2, 2] }, aF: { a: [2, 2] } },
        kf: [ { d: 0.9, lbl: '一只脚向后撤一大步' },
              { hip: [104, 116], tor: 175, lF: { ik: [66, 172], ft: 55 }, d: 1.4, lbl: '垂直向下蹲' },
              { hip: [92, 138], tor: 172, lF: { ik: [60, 172], ft: 55 }, d: 0.4, lbl: '后膝离地约一拳' },
              { hip: [92, 138], tor: 172, lF: { ik: [60, 172], ft: 55 }, d: 1, lbl: '前脚跟发力站起' },
              { hip: [106, 110], tor: 176, lF: { ik: [86, 176], ft: 70 }, d: 0.7, lbl: '收回后脚' } ] }
    },
    bulgarian: {
      name: '保加利亚分腿蹲', cat: '腿臀', mus: '股四头肌、臀大肌（单侧，强度高）',
      cues: ['后脚脚背搭在床沿或沙发上，前脚离床约一大步', '上身略前倾，垂直向下蹲', '前腿发力起身，后腿只负责平衡'],
      err: ['前脚离床太近，前膝冲得很远', '后脚用力蹬', '骨盆左右歪'],
      anim: { view: 'side', trace: 'pelvis', hl: ['thighN', 'glute'], db: DB2,
        box: { x: 6, w: 52, top: 146, label: '床/沙发' },
        base: { hip: [110, 108], tor: 172, hd: 0, lN: { ik: [128, 183], b: 1 }, lF: { ik: [54, 139], b: 1, ft: -80 },
                aN: { a: [2, 2] }, aF: { a: [2, 2] } },
        kf: [ { d: 3, lbl: '下蹲 3 秒' },
              { hip: [98, 140], tor: 165, d: 0.5, lbl: '底部稳住' },
              { hip: [98, 140], tor: 165, d: 1, lbl: '前腿发力站起' },
              { d: 0.6, lbl: '站直' } ] }
    },
    bridge: {
      name: '弹力带臀桥', cat: '腿臀', mus: '臀大肌、腘绳肌、臀中肌',
      cues: ['迷你带套在膝盖上方，双膝向外撑住带子', '脚跟踩地，臀部发力抬到肩—髋—膝一条线', '顶端夹臀 1 秒，再慢慢放下'],
      err: ['用腰发力，肚子顶得太高', '膝盖向内塌', '脚离臀部太远，大腿后侧抽筋'],
      anim: { view: 'side', trace: 'pelvis', hl: ['glute', 'thigh'], vb: [10, 30, 210, 186],
        band: [{ kind: 'cuff', at: 'kneeN', to: 'hipN', off: 8 }],
        base: { hip: [104.5, 180], tor: -90, hd: 0, lN: { ik: [138, 183], b: 1, ft: 90 }, aN: { a: [88, 90] } },
        kf: [ { d: 1, lbl: '脚跟踩地，臀部发力抬起' },
              { hip: [100, 160], tor: -65, hd: 25, d: 1, lbl: '顶端夹臀 1 秒' },
              { hip: [100, 160], tor: -65, hd: 25, d: 2, lbl: '慢慢放下 2 秒' },
              { d: 0.4, lbl: '臀部轻触地' } ] }
    },
    slbridge: {
      name: '单腿臀桥', cat: '腿臀', mus: '臀大肌（单侧）、腘绳肌',
      cues: ['一只脚踩地，另一条腿伸直', '支撑脚的脚跟发力把髋抬起', '骨盆保持水平，不向一侧掉'],
      err: ['骨盆歪向抬腿一侧', '用腰代偿'],
      anim: { view: 'side', trace: 'pelvis', hl: ['glute', 'thighF'], vb: [10, 30, 210, 186],
        base: { hip: [104.5, 180], tor: -90, hd: 0, lF: { ik: [138, 183], b: 1, ft: 90 }, lN: { a: [128, 128], ft: 215 }, aN: { a: [88, 90] } },
        kf: [ { d: 1, lbl: '支撑脚跟发力抬髋' },
              { hip: [100, 160], tor: -65, hd: 25, lN: { a: [115, 115], ft: 200 }, d: 1, lbl: '顶端停 1 秒' },
              { hip: [100, 160], tor: -65, hd: 25, lN: { a: [115, 115], ft: 200 }, d: 2, lbl: '慢慢放下 2 秒' },
              { d: 0.4, lbl: '轻触地' } ] }
    },
    pu_knee: { name: '跪姿俯卧撑', cat: '胸肩', level: 1, mus: PU_MUS,
      cues: ['双手略宽于肩，从膝盖到头成一条直线', '手肘和身体约 45°，胸口下到离地一拳', '推起时把地面推开，不耸肩'], err: PU_ERR, anim: pushup('knee') },
    pu_bed: { name: '上斜俯卧撑（床沿）', cat: '胸肩', level: 2, mus: PU_MUS,
      cues: ['床靠墙放稳，双手撑在床沿', '脚尖着地，从脚跟到头一条直线', '胸口碰到床沿再推起'], err: PU_ERR, anim: pushup('bed') },
    pu_low: { name: '低位上斜俯卧撑（矮凳）', cat: '胸肩', level: 3, mus: PU_MUS,
      cues: ['用稳固的矮凳、台阶或沙发座（约 25–30cm）', '身体一条直线，胸口碰到凳面', '比床沿难，是过渡到地面的最后一级'], err: PU_ERR, anim: pushup('low') },
    pu_std: { name: '标准俯卧撑', cat: '胸肩', level: 4, mus: PU_MUS,
      cues: ['手在肩膀正下方略宽，脚尖着地', '收紧臀部和腹部，下放到胸口离地一拳', '做不了完整次数时，用 3–5 秒慢慢下放，再跪姿推起'], err: PU_ERR, anim: pushup('std') },
    floorpress: {
      name: '哑铃地板卧推', cat: '胸肩', mus: '胸大肌、肱三头肌、三角肌前束',
      cues: ['躺在垫子上屈膝踩地，哑铃在胸部正上方', '慢慢下放到上臂轻触地面，停 1 秒', '推起时哑铃略向内靠，不互相撞'],
      err: ['上臂砸地', '手肘张开成 90°', '手腕向后折'],
      anim: { view: 'side', trace: 'handN', hl: ['chest', 'uarm'], db: DB2, vb: [10, 30, 210, 186],
        base: { hip: [108, 180], tor: -90, hd: 0, lN: { ik: [148, 183], b: 1, ft: 90 }, aN: { ik: [62, 124], b: -1, ls: [1, 1] } },
        kf: [ { d: 3, lbl: '下放 3 秒' },
              { aN: { ik: [71, 156], ls: [0.4, 1] }, d: 1, lbl: '上臂轻触地，停 1 秒' },
              { aN: { ik: [71, 156], ls: [0.4, 1] }, d: 1, lbl: '推起 1 秒' },
              { d: 0.6, lbl: '顶端手肘不锁死' } ] }
    },
    press: {
      name: '哑铃站姿推举', cat: '胸肩', mus: '三角肌、肱三头肌、上背、核心',
      cues: ['收紧臀部和腹部，肋骨不外翻', '哑铃从肩膀两侧推到头顶', '慢慢放回到耳朵高度'],
      err: ['腰向后仰借力', '耸肩', '手腕向后折'],
      anim: { view: 'front', cx: 120, trace: 'handN', hl: ['delt', 'uarm'], db: [{ at: 'handN', kind: 'bar' }, { at: 'handF', kind: 'bar' }],
        base: { hip: [120, 101], tor: 180, hd: 0, lN: { ik: [108, 183], b: -1 }, aN: { a: [-60, 180] } },
        kf: [ { d: 1, lbl: '向上推 1 秒' },
              { aN: { a: [-188, 172] }, d: 0.5, lbl: '头顶伸直' },
              { aN: { a: [-188, 172] }, d: 2, lbl: '慢放 2 秒' },
              { d: 0.5, lbl: '肩旁停一下' } ] }
    }
  };
  for (var k in list) M[k] = list[k];
  global.PUSHUP = pushup;
})(window);
