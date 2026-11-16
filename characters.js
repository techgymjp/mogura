// 登場人物の絵。動きは伸縮ではなく、1 コマずつ違うポーズを描いた 12 コマのコマ送りで見せる。
// 腕は「手の位置」をコマごとに決め、肩からの 2 関節（上腕・前腕）で肘の位置を求めて描く
window.Characters = (() => {
  const FRAMES = 12;
  const r1 = (v) => Math.round(v * 10) / 10;

  // ---- 部品 ----
  // 肩 (sx, sy) から手 (hx, hy) までの腕。side は -1（向かって左）/ 1（向かって右）。肘は外側・下側に曲げる
  function arm(side, sx, sy, hx, hy, sleeve, skin, opt = {}) {
    const L1 = opt.L1 || 17, L2 = opt.L2 || 17, w = opt.w || 8;
    let dx = hx - sx, dy = hy - sy;
    let d = Math.hypot(dx, dy);
    const max = L1 + L2 - 0.5;
    if (d > max) { hx = sx + dx / d * max; hy = sy + dy / d * max; dx = hx - sx; dy = hy - sy; d = max; }
    d = Math.max(d, 1);
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const px = sx + a * dx / d, py = sy + a * dy / d;
    const c1 = [px - h * dy / d, py + h * dx / d], c2 = [px + h * dy / d, py - h * dx / d];
    const score = (p) => side * (p[0] - 50) + 0.6 * p[1];
    const [ex, ey] = score(c1) >= score(c2) ? c1 : c2;
    const line = `M${r1(sx)} ${r1(sy)} L${r1(ex)} ${r1(ey)} L${r1(hx)} ${r1(hy)}`;
    const outline = opt.outline ? `<path d="${line}" stroke="${opt.outline}" stroke-width="${w + 2}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : '';
    return outline +
      `<path d="${line}" stroke="${sleeve}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<circle cx="${r1(hx)}" cy="${r1(hy)}" r="4.2" fill="${skin}" stroke="rgba(0,0,0,.35)" stroke-width="0.8"/>`;
  }

  // 画面上の角度（0 = 上、90 = 右、時計回り）で回して置く
  const at = (x, y, deg, body) => `<g transform="translate(${r1(x)} ${r1(y)}) rotate(${deg})">${body}</g>`;

  function eyes(type, y, look = [0, 0], gap = 8) {
    const [lx, ly] = look;
    return [50 - gap, 50 + gap].map((x) => {
      const cx = x + lx, cy = y + ly;
      switch (type) {
        case 'narrow': return almond(x, y, lx, ly, '#2b1a10', 1.4);
        case 'happy': return `<path d="M${x - 3.5} ${y + 1} Q${x} ${y - 4} ${x + 3.5} ${y + 1}" stroke="#000" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
        case 'closed': return `<path d="M${x - 3.5} ${y - 1} Q${x} ${y + 3} ${x + 3.5} ${y - 1}" stroke="#000" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
        case 'half': return `<path d="M${x - 3.5} ${y} h7" stroke="#000" stroke-width="2.4" stroke-linecap="round"/><circle cx="${x}" cy="${y + 1.4}" r="1.6"/>`;
        case 'wide': return `<circle cx="${cx}" cy="${cy}" r="3.8" fill="#fff" stroke="#000" stroke-width="1.2"/><circle cx="${cx}" cy="${cy}" r="1.8"/>`;
        case 'x': return `<path d="M${x - 3.5} ${y - 3.5} l7 7 M${x + 3.5} ${y - 3.5} l-7 7" stroke="#000" stroke-width="2.4" stroke-linecap="round"/>`;
        case 'blue': return almond(x, y, lx, ly, '#3a78b8', 3);
        case 'sharp': return almond(x, y, lx, ly, '#2b1a10', 2.2);
        default: return almond(x, y, lx, ly, '#2b1a10', 2.8);
      }
    }).join('');
  }

  function brows(type, y, color = '#000') {
    const s = `stroke="${color}" stroke-width="3" stroke-linecap="round" fill="none"`;
    switch (type) {
      case 'angry': return `<path d="M35 ${y - 3} L46 ${y + 1} M65 ${y - 3} L54 ${y + 1}" ${s}/>`;
      case 'worried': return `<path d="M36 ${y + 1} L46 ${y - 3} M64 ${y + 1} L54 ${y - 3}" ${s}/>`;
      case 'up': return `<path d="M36 ${y - 3} Q41 ${y - 6} 46 ${y - 3} M54 ${y - 3} Q59 ${y - 6} 64 ${y - 3}" ${s}/>`;
      case 'none': return '';
      default: return `<path d="M36 ${y} Q41 ${y - 3} 46 ${y} M54 ${y} Q59 ${y - 3} 64 ${y}" ${s}/>`;
    }
  }

  function mouth(type, y) {
    switch (type) {
      case 'frown': return `<path d="M44 ${y + 2} Q50 ${y - 3} 56 ${y + 2}" stroke="#000" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
      case 'smile': return `<path d="M43 ${y - 1} Q50 ${y + 6} 57 ${y - 1}" stroke="#5a2a10" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
      case 'grin': return `<path d="M41 ${y - 2} Q50 ${y + 10} 59 ${y - 2} Z" fill="#5a1a10"/><path d="M43 ${y - 1} h14" stroke="#fff" stroke-width="2"/>`;
      case 'open': return `<ellipse cx="50" cy="${y + 1}" rx="4.2" ry="3.6" fill="#5a1a10"/>`;
      case 'shout': return `<ellipse cx="50" cy="${y + 2}" rx="6.5" ry="5.5" fill="#5a1a10"/><ellipse cx="50" cy="${y + 5}" rx="3.5" ry="2" fill="#d9534f"/>`;
      case 'o': return `<circle cx="50" cy="${y + 1}" r="2.6" fill="#5a1a10"/>`;
      case 'tiny': return `<ellipse cx="50" cy="${y}" rx="3.5" ry="2.2" fill="#d0312d"/>`;
      case 'none': return '';
      default: return `<path d="M45 ${y} h10" stroke="#000" stroke-width="2.4" stroke-linecap="round"/>`;
    }
  }


  // 切れ長の目（白目・黒目・上まぶたの線）。h は目の開き
  function almond(x, y, lx, ly, iris, h) {
    const px = x + Math.max(-2, Math.min(2, lx)), py = y + Math.max(-1, Math.min(1, ly));
    return `<path d="M${x - 4.6} ${y} Q${x} ${y - h - 0.6} ${x + 4.6} ${y} Q${x} ${y + h * 0.7} ${x - 4.6} ${y} Z" fill="#f3ede2"/>` +
      `<circle cx="${px}" cy="${py}" r="${Math.min(2.1, h * 0.8 + 0.5)}" fill="${iris}"/><circle cx="${px}" cy="${py}" r="${Math.min(1, h * 0.4)}" fill="#000"/>` +
      `<path d="M${x - 5} ${y + 0.3} Q${x} ${y - h - 1.2} ${x + 5} ${y + 0.3}" stroke="#1a0f08" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
  }
  const nose = (y, c = 'rgba(110,60,35,.7)', long = 0) =>
    `<path d="M50 ${y - 8 - long} Q48.6 ${y - 2} 47 ${y + 1} Q50 ${y + 3} 53 ${y + 1}" stroke="${c}" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
  // 顔の形に陰影を重ねる（陰影のグラデーションは文書に 1 つだけ置く）
  const shaded = (d, skin) => `<path d="${d}" fill="${skin}"/><path d="${d}" fill="url(#chSkinShade)"/>`;
  const ear = (x, y, skin) => `<ellipse cx="${x}" cy="${y}" rx="3.4" ry="5.6" fill="${skin}"/><ellipse cx="${x}" cy="${y}" rx="3.4" ry="5.6" fill="url(#chSkinShade)"/>`;
  // 家紋
  const MON = {
    // 織田木瓜
    mokko: (c) => `<g fill="none" stroke="${c}" stroke-width="1.2">` + [0, 90, 180, 270].map((a) => `<ellipse cx="0" cy="-3.2" rx="3" ry="3.4" transform="rotate(${a})"/>`).join('') + '<circle r="1.4"/></g>',
    // 五七桐
    kiri: (c) => `<g fill="${c}"><path d="M0 4 Q-6 1 -7 -3 Q-2 -1 0 4 Z M0 4 Q6 1 7 -3 Q2 -1 0 4 Z M0 4 Q-2 -2 0 -5 Q2 -2 0 4 Z"/>` +
      [-5, 0, 5].map((x, i) => [0, 1, 2, 3, 4, 5, 6].slice(0, i === 1 ? 7 : 5).map((k) => `<circle cx="${x}" cy="${-6 - k * 1.6}" r="0.9"/>`).join('')).join('') + '</g>',
    // 三つ葉葵
    aoi: (c) => `<g><circle r="6.5" fill="none" stroke="${c}" stroke-width="1.2"/><g fill="${c}">` +
      [0, 120, 240].map((a) => `<path d="M0 0 Q-3 -2.5 0 -5.5 Q3 -2.5 0 0 Z" transform="rotate(${a})"/>`).join('') + '</g></g>',
    // 桔梗
    kikyo: (c) => `<g fill="${c}" stroke="#fff" stroke-width="0.6">` + [0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-3.6" rx="2.3" ry="3.6" transform="rotate(${a})"/>`).join('') + '<circle r="1.2" fill="#fff"/></g>',
    // 二つ引両
    hikiryo: (c) => `<g><circle r="6" fill="#f3e6c8" stroke="${c}" stroke-width="0.8"/><rect x="-6" y="-3" width="12" height="2" fill="${c}"/><rect x="-6" y="1" width="12" height="2" fill="${c}"/></g>`
  };
  const mon = (x, y, kind, c, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">${MON[kind](c)}</g>`;
  // 着物の襟（打ち合わせ）と胸元
  const collar = (inner = '#f3e6c8', edge = '#2a1a10') =>
    `<path d="M36 74 L50 96 L64 74 L58 74 L50 86 L42 74 Z" fill="${inner}"/><path d="M36 74 L50 96 M64 74 L50 96" stroke="${edge}" stroke-width="1.2" opacity=".5"/>`;
  const robe = (fill, x = 14, w = 72) => `<rect x="${x}" y="74" width="${w}" height="40" rx="10" fill="${fill}"/><rect x="${x}" y="74" width="${w}" height="40" rx="10" fill="url(#chRobeShade)"/>`;

  // 陰影のグラデーションを 1 度だけ文書に置く
  (function defs() {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('width', '0'); el.setAttribute('height', '0'); el.setAttribute('aria-hidden', 'true');
    el.style.position = 'absolute';
    el.innerHTML = '<defs>' +
      '<radialGradient id="chSkinShade" cx="0.45" cy="0.38" r="0.62"><stop offset="0.55" stop-color="#5a2a10" stop-opacity="0"/><stop offset="1" stop-color="#5a2a10" stop-opacity="0.38"/></radialGradient>' +
      '<linearGradient id="chRobeShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.12"/><stop offset="0.5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.35"/></linearGradient>' +
      '</defs>';
    (document.body || document.documentElement).appendChild(el);
  })();

  const sweat = (x, y) => `<path d="M${x} ${y} q-3 5 0 7 q3 -2 0 -7 Z" fill="#9fd3ff" stroke="#3a7fb8" stroke-width="0.8"/>`;
  const stars = '<g fill="#ffd84a" stroke="#8a5a00" stroke-width="0.6">' +
    [[22, 30], [78, 26], [50, 14]].map(([x, y]) =>
      `<path d="M${x} ${y - 5} l1.5 3.5 3.8 .3 -2.9 2.5 .9 3.7 -3.3 -2 -3.3 2 .9 -3.7 -2.9 -2.5 3.8 -.3 Z"/>`).join('') + '</g>';
  const label = (fill) => `<text class="lbl" x="50" y="100" font-size="12" fill="${fill}" text-anchor="middle" font-weight="bold" stroke="rgba(0,0,0,.55)" stroke-width="2.5" paint-order="stroke">{{label}}</text>`;

  // 持ち物
  const katana = '<rect x="-2.2" y="-6" width="4.4" height="10" rx="1.5" fill="#2a1a10"/><ellipse cx="0" cy="-6.5" rx="4.5" ry="1.6" fill="#c9a24a"/>' +
    '<path d="M-1.6 -8 L-1.2 -40 Q0 -44 1.8 -40 L1.6 -8 Z" fill="#e6edf3" stroke="#7d8a96" stroke-width="0.7"/>';
  const gourd = '<path d="M0 3 v-4" stroke="#7a3a10" stroke-width="2"/><circle cx="0" cy="-7" r="6" fill="#e8b33a" stroke="#8a5a10" stroke-width="1"/>' +
    '<circle cx="0" cy="-16" r="4" fill="#e8b33a" stroke="#8a5a10" stroke-width="1"/><path d="M-3 -11.5 h6" stroke="#c0392b" stroke-width="2"/>';
  const brush = '<path d="M0 0 L0 13" stroke="#7a4a20" stroke-width="2.2"/><path d="M-1.6 13 L0 19 L1.6 13 Z" fill="#111"/>';
  const letter = '<rect x="-2" y="-8" width="18" height="12" fill="#fbf7ea" stroke="#8a7a5a" stroke-width="0.8"/>' +
    '<path d="M2 -5 h11 M2 -2 h11 M2 1 h8" stroke="#555" stroke-width="0.9"/>';
  const openFan = (fill, mark) => {
    const pts = [];
    for (let a = -45; a <= 45; a += 15) pts.push([Math.sin(a * Math.PI / 180) * 22, -Math.cos(a * Math.PI / 180) * 22]);
    const arc = pts.map((p, i) => (i ? 'L' : 'M') + r1(p[0]) + ' ' + r1(p[1])).join(' ');
    const ribs = pts.map((p) => `<path d="M0 0 L${r1(p[0])} ${r1(p[1])}" stroke="rgba(90,60,20,.6)" stroke-width="0.7"/>`).join('');
    return `<path d="M0 0 ${arc.replace('M', 'L')} Z" fill="${fill}" stroke="#8a6a20" stroke-width="1"/>${ribs}${mark || ''}`;
  };
  const kugeFan = openFan('#f5e7c0', '<path d="M-10 -12 Q0 -18 10 -12" stroke="#c0392b" stroke-width="1.5" fill="none"/>');
  const nobuFan = openFan('#f2c94c', '<circle cx="0" cy="-14" r="4.5" fill="#d0312d"/>');
  const cross = '<path d="M0 6 V-22 M-7 -14 H7" stroke="#e8c26a" stroke-width="3.6" stroke-linecap="round"/>';
  const rays = '<g stroke="#ffe9a0" stroke-width="1.6" stroke-linecap="round" opacity="0.9">' +
    [0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path d="M0 -14 L0 -14" transform="rotate(${a} 0 -14)"/><path d="M0 -26 L0 -31" transform="rotate(${a} 0 -14)"/>`).join('') + '</g>';
  const bible = '<rect x="-7" y="-9" width="14" height="17" rx="1.5" fill="#6b3b1e" stroke="#3a1e0e" stroke-width="1"/><path d="M0 -5 V3 M-3 -2 H3" stroke="#e8c26a" stroke-width="1.6"/>';
  const naginata = '<path d="M0 24 L0 -30" stroke="#5a3a1a" stroke-width="3"/><path d="M-1.5 -30 Q-2 -44 5 -52 Q4 -42 1.5 -30 Z" fill="#e6edf3" stroke="#7d8a96" stroke-width="0.8"/><rect x="-2.5" y="-31" width="5" height="3" fill="#c9a24a"/>';
  const juzu = '<g fill="#6b3b1e">' + [0, 60, 120, 180, 240, 300].map((a) => `<circle cx="${r1(Math.sin(a * Math.PI / 180) * 5)}" cy="${r1(6 + Math.cos(a * Math.PI / 180) * 5)}" r="1.6"/>`).join('') + '</g>';
  const zz = (n) => '<g font-size="9" font-weight="bold" fill="#cfe3ff" stroke="#1a2a40" stroke-width="1.5" paint-order="stroke" font-family="sans-serif">' +
    ['z', 'z', 'Z'].slice(0, n).map((c, i) => `<text x="${72 + i * 7}" y="${34 - i * 8}">${c}</text>`).join('') + '</g>';
  const slash = (o) => `<path d="M100 30 Q122 68 98 110" stroke="#fff" stroke-width="3" fill="none" opacity="${o}" stroke-linecap="round"/>`;

  // 頭を首の付け根を中心に傾け、上下にずらす
  const headGroup = (p, body) => `<g transform="translate(${p.hx || 0} ${p.hdy || 0}) rotate(${p.tilt || 0} 50 84)">${body}</g>`;

  // ---- 人物ごとの描き方 ----
  // 各コマの pose: { dy: 体の上下, tilt: 首の傾き, hdy: 頭の上下, eyes, look, brows, mouth, L: 左手の位置, R: 右手の位置, ...持ち物 }
  const ART = {
    mitsuhide: {
      sleeve: '#1a2347', skin: '#dcaa80', fps: 14,
      draw(p) {
        const f = this, sk = f.skin;
        const face = 'M31 54 Q31 34 50 33 Q69 34 69 54 Q69 75 50 84 Q31 75 31 54 Z';
        const head = headGroup(p,
          '<rect x="44" y="76" width="12" height="8" fill="#cf9a6c"/>' + ear(30, 60, sk) + ear(70, 60, sk) + shaded(face, sk) +
          // 侍烏帽子（折烏帽子）と鬢の髪。額は広く、髪は後退している
          '<path d="M31 50 Q30 40 34 36 L35 50 Z M69 50 Q70 40 66 36 L65 50 Z" fill="#2a2522"/>' +
          '<path d="M34 37 Q36 14 56 12 Q70 14 68 30 L66 37 Z" fill="#141414"/><path d="M40 30 Q52 22 64 26" stroke="#3a3a3a" stroke-width="1.4" fill="none"/>' +
          '<path d="M33 37 h35" stroke="#0a0a0a" stroke-width="3"/>' +
          brows(p.brows || 'angry', 53) + eyes(p.eyes || 'sharp', 58, p.look) + nose(66) +
          '<path d="M40 71 Q45 68.5 49.5 70 M50.5 70 Q55 68.5 60 71" stroke="#2a2522" stroke-width="1.8" fill="none" stroke-linecap="round"/>' +
          mouth(p.mouth || 'frown', 75));
        return robe('#1f2a55') + collar('#e9e2d0') + mon(66, 92, 'kikyo', '#7fb2d9', 0.9) + mon(34, 92, 'kikyo', '#7fb2d9', 0.9) +
          head +
          arm(-1, 24, 82, ...p.L, f.sleeve, f.skin) +
          (p.noProp ? '' : at(p.R[0], p.R[1], p.blade, katana)) +
          arm(1, 76, 82, ...p.R, f.sleeve, f.skin) +
          (p.slash ? slash(p.slash) : '') + label('#e8c26a');
      },
      frames: [
        { R: [92, 70], blade: 40, L: [34, 96] },
        { R: [94, 60], blade: 15, L: [34, 96], tilt: -2 },
        { R: [90, 50], blade: -10, L: [33, 95], tilt: -4, dy: -1 },
        { R: [82, 44], blade: -30, L: [32, 94], tilt: -6, dy: -2, mouth: 'open' },
        { R: [74, 42], blade: -55, L: [30, 92], tilt: -7, dy: -2, mouth: 'open' },
        { R: [88, 52], blade: 30, L: [30, 92], tilt: -2, mouth: 'shout' },
        { R: [98, 72], blade: 100, L: [38, 98], tilt: 5, dy: 2, mouth: 'shout', slash: 0.7 },
        { R: [90, 96], blade: 150, L: [38, 98], tilt: 8, dy: 2, mouth: 'shout', slash: 0.35 },
        { R: [84, 100], blade: 165, L: [36, 97], tilt: 6, dy: 1, mouth: 'open' },
        { R: [90, 90], blade: 130, L: [35, 96], tilt: 3, eyes: 'narrow' },
        { R: [94, 80], blade: 95, L: [34, 96], tilt: 1 },
        { R: [94, 74], blade: 65, L: [34, 96] }
      ]
    },

    hideyoshi: {
      sleeve: '#8a2e16', skin: '#c99067', fps: 12,
      draw(p) {
        const f = this, sk = f.skin;
        const face = 'M33 53 Q33 36 50 35 Q67 36 67 53 Q66 72 50 81 Q34 72 33 53 Z';
        const head = headGroup(p,
          '<rect x="45" y="75" width="10" height="8" fill="#b9825a"/>' +
          // 大きな耳と、しわの多い痩せた顔（猿に似ていたと伝わる）
          '<ellipse cx="29" cy="57" rx="6" ry="7.5" fill="' + sk + '"/><ellipse cx="71" cy="57" rx="6" ry="7.5" fill="' + sk + '"/>' +
          shaded(face, sk) +
          '<path d="M40 44 q10 -2.5 20 0 M42 47 q8 -2 16 0" stroke="rgba(110,60,30,.55)" stroke-width="1" fill="none"/>' +
          '<path d="M37 61 q1 7 6 11 M63 61 q-1 7 -6 11 M40 60 q3 2 6 1 M60 60 q-3 2 -6 1" stroke="rgba(110,60,30,.55)" stroke-width="1" fill="none"/>' +
          // 唐冠（左右に張り出した纓）
          '<path d="M33 45 Q34 24 50 23 Q66 24 67 45 Z" fill="#141414"/><path d="M36 44 h28" stroke="#3a3a3a" stroke-width="2"/>' +
          `<path d="M35 38 L7 ${31 + (p.wing || 0)} L9 39 Z M65 38 L93 ${31 - (p.wing || 0)} L91 39 Z" fill="#1a1a1a" stroke="#c9a24a" stroke-width="1"/>` +
          brows('up', 52) + eyes(p.eyes === 'happy' || !p.eyes ? 'happy' : p.eyes, 56, p.look) + nose(64, undefined, 1) +
          '<path d="M43 69 q3 -1.5 6 0 M51 69 q3 -1.5 6 0" stroke="#3a2a20" stroke-width="1.2" fill="none"/>' +
          '<path d="M47.5 80 L50 87 L52.5 80 Z" fill="#3a2a20"/>' +
          mouth(p.mouth || 'grin', 73));
        return robe('#a33a1c', 16, 68) + collar('#f3e6c8') + mon(30, 90, 'kiri', '#e8c26a', 0.9) + mon(70, 90, 'kiri', '#e8c26a', 0.9) +
          head +
          arm(-1, 24, 82, ...p.L, f.sleeve, f.skin) +
          (p.noProp ? '' : at(p.R[0], p.R[1] - 3, p.gourd, gourd)) +
          arm(1, 76, 82, ...p.R, f.sleeve, f.skin) + label('#fff');
      },
      frames: [
        { R: [84, 52], gourd: -15, L: [12, 70], dy: 0, tilt: -6, wing: 0 },
        { R: [88, 46], gourd: 0, L: [10, 62], dy: -3, tilt: -3, wing: 3 },
        { R: [92, 44], gourd: 15, L: [12, 58], dy: -6, tilt: 0, wing: 5, mouth: 'shout' },
        { R: [90, 48], gourd: 10, L: [14, 64], dy: -3, tilt: 3, wing: 3, mouth: 'shout' },
        { R: [86, 54], gourd: -5, L: [14, 72], dy: 0, tilt: 6, wing: 0 },
        { R: [84, 58], gourd: -15, L: [13, 74], dy: 2, tilt: 3, wing: -2 },
        { R: [84, 52], gourd: -15, L: [12, 70], dy: 0, tilt: 0, wing: 0 },
        { R: [88, 46], gourd: 0, L: [10, 62], dy: -3, tilt: -3, wing: 3 },
        { R: [92, 44], gourd: 15, L: [12, 58], dy: -6, tilt: -6, wing: 5, mouth: 'shout' },
        { R: [90, 48], gourd: 10, L: [14, 64], dy: -3, tilt: -3, wing: 3, mouth: 'shout' },
        { R: [86, 54], gourd: -5, L: [14, 72], dy: 0, tilt: 0, wing: 0 },
        { R: [84, 58], gourd: -15, L: [13, 74], dy: 2, tilt: -3, wing: -2, eyes: 'dot', mouth: 'smile' }
      ]
    },

    ieyasu: {
      sleeve: '#1c2a20', skin: '#e8b48a', fps: 8,
      draw(p) {
        const f = this, sk = f.skin;
        const face = 'M25 57 Q25 34 50 34 Q75 34 75 57 Q75 80 50 87 Q25 80 25 57 Z';
        const head = headGroup(p,
          ear(25, 60, sk) + ear(75, 60, sk) + shaded(face, sk) +
          // ふくよかな丸顔と二重あご、折烏帽子
          '<path d="M40 83 Q50 88 60 83" stroke="rgba(110,60,30,.45)" stroke-width="1.2" fill="none"/>' +
          '<path d="M26 50 Q25 40 30 36 L32 50 Z M74 50 Q75 40 70 36 L68 50 Z" fill="#1a1a1a"/>' +
          '<path d="M30 39 Q31 16 52 14 Q70 16 70 39 Z" fill="#141414"/><path d="M36 30 Q50 22 66 28" stroke="#3a3a3a" stroke-width="1.4" fill="none"/><path d="M29 39 h42" stroke="#0a0a0a" stroke-width="3"/>' +
          brows(p.brows || 'calm', 52) + eyes(p.eyes || 'narrow', 58, p.look) + nose(66) +
          '<ellipse cx="35" cy="69" rx="6" ry="3.5" fill="#e79b86" opacity="0.4"/><ellipse cx="65" cy="69" rx="6" ry="3.5" fill="#e79b86" opacity="0.4"/>' +
          '<path d="M42 72 Q46 70 49.5 71 M50.5 71 Q54 70 58 72" stroke="#2a2522" stroke-width="1.6" fill="none"/>' +
          '<path d="M48 81 q2 2.5 4 0" stroke="#2a2522" stroke-width="1.4" fill="none"/>' +
          mouth(p.mouth || 'line', 76) + (p.sweat ? sweat(78, 40) : ''));
        return robe('#24342a') + collar('#e9e2d0') + mon(30, 88, 'aoi', '#e8c26a', 1.1) + mon(70, 88, 'aoi', '#e8c26a', 1.1) +
          head +
          arm(-1, 24, 84, ...p.L, f.sleeve, f.skin, { L2: 20 }) +
          arm(1, 76, 84, ...p.R, f.sleeve, f.skin, { L2: 20 }) +
          (p.zz ? zz(p.zz) : '') + label('#fff');
      },
      frames: [
        { L: [58, 94], R: [42, 92] },
        { L: [58, 94], R: [42, 92], look: [1, 0] },
        { L: [58, 94], R: [42, 92], eyes: 'half' },
        { L: [58, 95], R: [42, 93], eyes: 'half', hdy: 1, tilt: 2 },
        { L: [58, 95], R: [42, 93], eyes: 'closed', hdy: 2, tilt: 4, brows: 'calm' },
        { L: [58, 96], R: [42, 94], eyes: 'closed', hdy: 3, tilt: 6, brows: 'calm', zz: 1 },
        { L: [58, 96], R: [42, 94], eyes: 'closed', hdy: 4, tilt: 8, brows: 'calm', mouth: 'o', zz: 2 },
        { L: [58, 96], R: [42, 94], eyes: 'closed', hdy: 4, tilt: 9, brows: 'calm', mouth: 'o', zz: 3 },
        { L: [60, 90], R: [40, 88], eyes: 'wide', hdy: -3, tilt: -2, dy: -2, brows: 'up', mouth: 'open', sweat: 1 },
        { L: [59, 92], R: [41, 90], eyes: 'wide', hdy: -1, brows: 'up', sweat: 1 },
        { L: [58, 94], R: [42, 92], mouth: 'frown' },
        { L: [58, 94], R: [42, 92] }
      ]
    },

    yoshiaki: {
      sleeve: '#40225a', skin: '#e9c09a', fps: 10,
      draw(p) {
        const f = this, sk = f.skin;
        const face = 'M31 56 Q31 37 50 37 Q69 37 69 56 Q69 77 50 85 Q31 77 31 56 Z';
        const head = headGroup(p,
          ear(31, 61, sk) + ear(69, 61, sk) + shaded(face, sk) +
          // 立烏帽子（将軍の正装）
          '<path d="M33 46 L37 6 Q52 0 66 12 L67 46 Z" fill="#141414"/><path d="M40 14 Q50 22 62 16 M38 26 Q50 32 64 28" stroke="#333" stroke-width="1.2" fill="none"/>' +
          '<path d="M31 46 h38" stroke="#0a0a0a" stroke-width="4"/>' +
          brows('calm', 55) + eyes(p.eyes || 'real', 60, p.look) + nose(67) +
          '<path d="M42 72 Q46 70 49.5 71.5 M50.5 71.5 Q54 70 58 72" stroke="#2a2522" stroke-width="1.4" fill="none"/>' +
          '<path d="M48.5 82 L50 87 L51.5 82 Z" fill="#2a2522"/>' +
          mouth(p.mouth || 'line', 76));
        return robe('#4e2a6e', 16, 68) + collar('#f3e6c8') + mon(70, 88, 'hikiryo', '#222', 1) + mon(30, 88, 'hikiryo', '#222', 1) +
          head +
          (p.noProp ? '' : at(p.L[0], p.L[1], p.letter || 0, letter)) +
          arm(-1, 24, 82, ...p.L, f.sleeve, f.skin) +
          (p.noProp ? '' : at(p.R[0], p.R[1], p.brush || 200, brush)) +
          arm(1, 76, 82, ...p.R, f.sleeve, f.skin) + label('#fff');
      },
      frames: [
        { L: [38, 94], R: [56, 92], look: [0, 1.5] },
        { L: [38, 94], R: [60, 94], look: [1, 1.5] },
        { L: [38, 94], R: [55, 95], look: [0, 1.5] },
        { L: [38, 94], R: [61, 92], look: [1, 1.5] },
        { L: [38, 94], R: [68, 86], brush: 160, look: [-2.5, 0], tilt: -5, hx: -1 },
        { L: [38, 94], R: [68, 86], brush: 160, look: [-2.5, 0], tilt: -6, hx: -2, mouth: 'frown' },
        { L: [38, 94], R: [68, 86], brush: 160, look: [2.5, 0], tilt: 5, hx: 1 },
        { L: [38, 94], R: [68, 86], brush: 160, look: [2.5, 0], tilt: 6, hx: 2, mouth: 'frown' },
        { L: [18, 50], letter: -10, R: [72, 88], brush: 160, eyes: 'happy', mouth: 'smile', tilt: -3 },
        { L: [16, 42], letter: -15, R: [72, 88], brush: 160, eyes: 'happy', mouth: 'grin', tilt: -4, dy: -2 },
        { L: [26, 70], letter: -5, R: [66, 90], mouth: 'smile' },
        { L: [38, 94], R: [58, 92], look: [0, 1.5] }
      ]
    },

    kuge: {
      sleeve: '#86261d', skin: '#f8efe6', fps: 10,
      draw(p) {
        const f = this, sk = f.skin;
        const face = 'M29 58 Q29 38 50 37 Q71 38 71 58 Q71 79 50 85 Q29 79 29 58 Z';
        // 公家はお歯黒（口を開けると黒い歯が見える）
        const m = p.mouth === 'o' ? '<ellipse cx="50" cy="73" rx="3.6" ry="3" fill="#d0312d"/><ellipse cx="50" cy="73" rx="2.4" ry="1.9" fill="#111"/>'
          : p.mouth === 'open' ? '<ellipse cx="50" cy="73" rx="4.4" ry="3.6" fill="#d0312d"/><ellipse cx="50" cy="73" rx="3.2" ry="2.5" fill="#111"/>'
          : '<path d="M46 73 Q50 71 54 73 Q50 75.5 46 73 Z" fill="#d0312d"/>';
        const head = headGroup(p,
          ear(29, 61, sk) + shaded(face, sk) + ear(71, 61, sk) +
          // 冠と、後ろに垂れる纓
          '<rect x="37" y="20" width="26" height="20" rx="4" fill="#141414"/><rect x="30" y="37" width="40" height="7" rx="3" fill="#141414"/>' +
          `<path d="M58 22 Q${80 + (p.tail || 0)} 6 ${86 + (p.tail || 0)} 34" stroke="#141414" stroke-width="5" fill="none" stroke-linecap="round"/>` +
          // 引眉（眉を剃って額の高い所に描く）
          '<ellipse cx="42" cy="49" rx="3.6" ry="2.4" fill="#2a2a2a" opacity=".85"/><ellipse cx="58" cy="49" rx="3.6" ry="2.4" fill="#2a2a2a" opacity=".85"/>' +
          eyes(p.eyes || 'closed', 61) + nose(67, 'rgba(150,120,110,.6)') +
          '<ellipse cx="37" cy="68" rx="5" ry="3" fill="#f2a0a8" opacity="0.45"/><ellipse cx="63" cy="68" rx="5" ry="3" fill="#f2a0a8" opacity="0.45"/>' + m);
        return robe('#9e2f25') + collar('#f3e6c8', '#6a1a10') +
          '<path d="M14 100 Q50 92 86 100" stroke="#e8c26a" stroke-width="1.2" fill="none" opacity=".6"/>' +
          head +
          arm(-1, 24, 82, ...p.L, f.sleeve, f.skin) +
          arm(1, 76, 82, ...p.R, f.sleeve, f.skin, { L2: 19 }) +
          (p.noProp ? '' : at(p.R[0], p.R[1], p.fan, kugeFan)) + label('#fff');
      },
      frames: [
        { R: [56, 78], fan: -20, L: [36, 98] },
        { R: [56, 76], fan: -18, L: [36, 98], tilt: -4, hdy: -1, tail: 2 },
        { R: [57, 76], fan: -16, L: [36, 98], tilt: -6, hdy: -2, tail: 4 },
        { R: [58, 76], fan: -16, L: [36, 98], tilt: -4, hdy: -1, tail: 2 },
        { R: [70, 64], fan: 20, L: [36, 98], mouth: 'o', tail: 0 },
        { R: [80, 56], fan: 45, L: [36, 98], mouth: 'o', tilt: 3, tail: -2 },
        { R: [88, 62], fan: 70, L: [36, 98], mouth: 'o', eyes: 'happy', tilt: 4, tail: -4 },
        { R: [84, 68], fan: 40, L: [36, 98], mouth: 'o', eyes: 'happy', tilt: 3, tail: -2 },
        { R: [88, 62], fan: 70, L: [36, 98], mouth: 'o', eyes: 'happy', tilt: 4, tail: -4 },
        { R: [82, 64], fan: 35, L: [36, 98], mouth: 'o', tilt: 2, tail: -2 },
        { R: [66, 74], fan: 0, L: [36, 98], tail: 0 },
        { R: [57, 78], fan: -18, L: [36, 98], tail: 1 }
      ]
    },

    missionary: {
      sleeve: '#141414', skin: '#f1cdb8', fps: 10,
      draw(p) {
        const f = this, sk = f.skin;
        const face = 'M32 54 Q32 33 50 32 Q68 33 68 54 Q68 74 50 82 Q32 74 32 54 Z';
        const head = headGroup(p,
          ear(32, 57, sk) + ear(68, 57, sk) + shaded(face, sk) +
          // 後退した茶色の髪と、豊かなあごひげ（南蛮人）
          '<path d="M31 54 Q28 36 38 31 Q34 42 35 54 Z M69 54 Q72 36 62 31 Q66 42 65 54 Z" fill="#6a4122"/>' +
          '<path d="M38 31 Q50 27 62 31 Q56 30 50 30 Q44 30 38 31 Z" fill="#6a4122"/>' +
          '<path d="M33 62 Q32 88 50 92 Q68 88 67 62 Q63 72 50 72 Q37 72 33 62 Z" fill="#6a4122"/>' +
          brows(p.brows || 'calm', 49, '#4a2a12') + eyes('blue', 55, p.look) + nose(62, 'rgba(150,80,60,.75)', 3) +
          mouth(p.mouth || 'line', 71));
        return robe('#161616', 16, 68) + '<rect x="43" y="72" width="14" height="6" rx="2" fill="#fff"/>' +
          '<g fill="#444">' + [80, 88, 96, 104].map((y) => `<circle cx="50" cy="${y}" r="1.2"/>`).join('') + '</g>' +
          head +
          (p.noProp ? '' : at(p.L[0], p.L[1] + 4, -8, bible)) +
          arm(-1, 24, 82, ...p.L, f.sleeve, f.skin) +
          (p.noProp ? '' : (p.rays ? at(p.R[0], p.R[1], 0, rays) : '')) +
          (p.noProp ? '' : at(p.R[0], p.R[1], 0, cross)) +
          arm(1, 76, 82, ...p.R, f.sleeve, f.skin) + label('#fff');
      },
      frames: [
        { R: [82, 98], L: [34, 92] },
        { R: [86, 88], L: [34, 92], mouth: 'open' },
        { R: [88, 76], L: [34, 92] },
        { R: [86, 64], L: [34, 92], mouth: 'open', look: [0, -1.5], brows: 'up' },
        { R: [82, 54], L: [34, 92], mouth: 'o', look: [0, -2], brows: 'up', tilt: -3 },
        { R: [80, 46], L: [34, 92], mouth: 'open', look: [0, -2], brows: 'up', tilt: -4, rays: 1 },
        { R: [80, 46], L: [34, 92], mouth: 'shout', look: [0, -2], brows: 'up', tilt: -4, rays: 1 },
        { R: [80, 48], L: [34, 92], mouth: 'o', look: [0, -2], brows: 'up', tilt: -3, rays: 1 },
        { R: [84, 58], L: [34, 92], mouth: 'line' },
        { R: [86, 72], L: [34, 92], mouth: 'open' },
        { R: [86, 84], L: [34, 92] },
        { R: [84, 94], L: [34, 92], mouth: 'smile' }
      ]
    },

    sohei: {
      sleeve: '#262626', skin: '#c8956a', fps: 12,
      draw(p) {
        const f = this, sk = f.skin;
        // 裹頭：白い布で頭と顔を包み、目のまわりだけを出す
        const chant = p.mouth === 'shout' ? 1.5 : p.mouth === 'open' ? 0.8 : 0;
        const head = headGroup(p,
          '<path d="M20 82 Q14 30 50 25 Q86 30 80 82 Z" fill="#ece8df" stroke="#bdb8ad" stroke-width="1.5"/>' +
          '<path d="M28 44 Q50 36 72 44 M26 70 Q50 64 74 70 M30 78 Q50 72 70 78" stroke="#cfc9bc" stroke-width="1.2" fill="none"/>' +
          '<path d="M33 52 Q50 46 67 52 L66 63 Q50 60 34 63 Z" fill="' + sk + '"/>' +
          brows('angry', 54) + eyes(p.eyes || 'sharp', 58, p.look) +
          // 読経で布の口元が動く
          `<path d="M42 ${72 + chant} Q50 ${75 + chant * 2} 58 ${72 + chant}" stroke="#bdb8ad" stroke-width="1.3" fill="none"/>`);
        return robe('#262626') +
          // 白い袈裟を斜めにかける
          '<path d="M14 82 L60 114 L76 114 L22 76 Z" fill="#d9d4c7" opacity=".9"/>' +
          head +
          (p.noProp ? '' : at(p.L[0], p.L[1], 0, juzu)) +
          arm(-1, 24, 82, ...p.L, f.sleeve, f.skin) +
          (p.noProp ? '' : at(p.R[0], p.R[1], p.pole, naginata)) +
          arm(1, 76, 82, ...p.R, f.sleeve, f.skin) + label('#fff');
      },
      frames: Array.from({ length: 12 }, (_, i) => ({
        R: [70 + Math.round(Math.sin(i * Math.PI / 3) * 2), 84],
        pole: i * 30,
        L: i % 4 < 2 ? [36, 78] : [34, 84],
        mouth: ['open', 'shout', 'open', 'frown'][i % 4],
        tilt: [0, -2, 0, 2][i % 4],
        dy: i % 6 === 0 ? 1 : 0
      }))
    },

    ranmaru: {
      sleeve: '#a8466b', skin: '#f6d2b4', fps: 12,
      draw(p) {
        const f = this, sk = f.skin;
        const face = 'M30 56 Q30 36 50 35 Q70 36 70 56 Q70 76 50 83 Q30 76 30 56 Z';
        const head = headGroup(p,
          '<path d="M30 44 Q28 64 32 70 L36 52 Z M70 44 Q72 64 68 70 L64 52 Z" fill="#111"/>' +
          shaded(face, sk) +
          // 前髪のある若衆の髪（小姓）と、後ろで結った髷
          '<path d="M29 52 Q27 28 50 27 Q73 28 71 52 Q66 40 56 38 Q54 46 44 47 Q48 42 46 38 Q36 40 29 52 Z" fill="#111"/>' +
          '<ellipse cx="50" cy="24" rx="8" ry="6.5" fill="#111"/><rect x="46.5" y="14" width="7" height="8" rx="2" fill="#d4467a"/>' +
          (p.brows ? brows(p.brows, 52) : '<path d="M38 52 Q42 50 46 52 M54 52 Q58 50 62 52" stroke="#2a1a10" stroke-width="1.6" fill="none"/>') +
          eyes(p.eyes || 'happy', 58) + nose(65, 'rgba(160,100,80,.5)') +
          '<ellipse cx="37" cy="66" rx="5" ry="3" fill="#f2a0a8" opacity="0.65"/><ellipse cx="63" cy="66" rx="5" ry="3" fill="#f2a0a8" opacity="0.65"/>' +
          mouth(p.mouth || 'smile', 72) + (p.sweat ? sweat(76, 44) : ''));
        return robe('#c2577f', 18, 64) + collar('#fff') +
          '<g fill="#fff" opacity=".75">' + [[26, 96], [34, 106], [66, 98], [74, 108], [60, 110]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2"/>`).join('') + '</g>' +
          head +
          arm(-1, 26, 82, ...p.L, f.sleeve, f.skin) +
          arm(1, 74, 82, ...p.R, f.sleeve, f.skin) + label('#fff');
      },
      frames: [
        { L: [16, 58], R: [84, 58], tilt: 4, eyes: 'wide', brows: 'worried', mouth: 'open' },
        { L: [10, 62], R: [90, 54], tilt: 0, eyes: 'wide', brows: 'worried', mouth: 'shout', sweat: 1 },
        { L: [6, 58], R: [94, 58], tilt: -4, eyes: 'wide', brows: 'worried', mouth: 'open', sweat: 1 },
        { L: [10, 54], R: [90, 62], tilt: 0, eyes: 'wide', brows: 'worried', mouth: 'shout' },
        { L: [16, 58], R: [84, 58], tilt: 4, eyes: 'wide', brows: 'worried', mouth: 'open' },
        { L: [10, 62], R: [90, 54], tilt: 0, eyes: 'wide', brows: 'worried', mouth: 'shout', sweat: 1 },
        { L: [6, 58], R: [94, 58], tilt: -4, eyes: 'wide', brows: 'worried', mouth: 'open', sweat: 1 },
        { L: [10, 54], R: [90, 62], tilt: 0, eyes: 'wide', brows: 'worried', mouth: 'shout' },
        { L: [30, 92], R: [70, 92], tilt: 0, eyes: 'happy', mouth: 'smile', dy: -2 },
        { L: [32, 90], R: [68, 90], tilt: 5, eyes: 'happy', mouth: 'smile', dy: -3 },
        { L: [30, 92], R: [70, 92], tilt: 5, eyes: 'happy', mouth: 'smile', dy: -1 },
        { L: [24, 84], R: [76, 84], tilt: 2, eyes: 'dot', mouth: 'open' }
      ]
    },

    nobunaga: {
      sleeve: '#fbfbf6', skin: '#e9bb93', fps: 10,
      draw(p) {
        const f = this, sk = f.skin;
        const face = 'M32 54 Q32 34 50 33 Q68 34 68 54 Q68 75 50 84 Q32 75 32 54 Z';
        const head = headGroup(p,
          '<rect x="44" y="76" width="12" height="8" fill="#d9a77c"/>' + ear(31, 60, sk) + ear(69, 60, sk) + shaded(face, sk) +
          // 月代（剃った頭頂部）と鬢、茶筅髷（肖像画の細面）
          '<path d="M33 47 Q34 30 50 29 Q66 30 67 47 Q60 41 50 41 Q40 41 33 47 Z" fill="#cdbdb0"/>' +
          '<path d="M31 46 Q30 56 32 62 L35 61 Q34 52 36 45 Z M69 46 Q70 56 68 62 L65 61 Q66 52 64 45 Z" fill="#141414"/>' +
          '<rect x="46" y="22" width="8" height="9" rx="2" fill="#141414"/><rect x="45" y="27" width="10" height="2.4" fill="#f2f2f2"/>' +
          `<path d="M50 23 Q60 ${10 + (p.mage || 0)} 72 ${14 + (p.mage || 0)}" stroke="#141414" stroke-width="4" fill="none" stroke-linecap="round"/>` +
          brows('angry', 52) + eyes(p.eyes || 'sharp', 57, p.look) + nose(65, undefined, 1) +
          // 細く長い口ひげと、あごの小さなひげ
          '<path d="M39 71 Q45 67.5 49.5 69.5 M50.5 69.5 Q55 67.5 61 71" stroke="#141414" stroke-width="1.7" fill="none" stroke-linecap="round"/>' +
          '<path d="M48.5 80 Q50 85 51.5 80" stroke="#141414" stroke-width="1.5" fill="none"/>' +
          mouth(p.mouth || 'line', 74));
        const o = { outline: '#bbb' };
        return '<rect x="16" y="74" width="68" height="40" rx="10" fill="#fbfbf6" stroke="#bbb" stroke-width="1.5"/><rect x="16" y="74" width="68" height="40" rx="10" fill="url(#chRobeShade)" opacity=".5"/>' +
          '<path d="M38 74 L52 100 M62 74 L48 92" stroke="#bbb" stroke-width="2" fill="none"/>' + mon(30, 92, 'mokko', '#c9c9c0', 1) +
          head +
          arm(-1, 24, 82, ...p.L, f.sleeve, f.skin, o) +
          arm(1, 76, 82, ...p.R, f.sleeve, f.skin, o) +
          (p.noProp ? '' : at(p.R[0], p.R[1], p.fan, nobuFan)) + label('#b3261e');
      },
      frames: [
        { R: [86, 96], fan: 120, L: [8, 90], tilt: -4 },
        { R: [92, 86], fan: 100, L: [6, 84], tilt: -3, mage: 1 },
        { R: [96, 72], fan: 75, L: [6, 78], tilt: -1, mouth: 'o', mage: 2 },
        { R: [94, 58], fan: 50, L: [8, 72], tilt: 1, mouth: 'o', eyes: 'closed', mage: 2 },
        { R: [86, 46], fan: 20, L: [10, 70], tilt: 3, mouth: 'o', eyes: 'closed', mage: 1 },
        { R: [74, 40], fan: 0, L: [12, 72], tilt: 4, mouth: 'o', eyes: 'closed', dy: -1 },
        { R: [62, 40], fan: -20, L: [14, 76], tilt: 5, mouth: 'o', eyes: 'closed', dy: -1, mage: -1 },
        { R: [56, 46], fan: -40, L: [16, 80], tilt: 4, mouth: 'o', eyes: 'closed', mage: -2 },
        { R: [66, 56], fan: -10, L: [14, 84], tilt: 2, mouth: 'o', eyes: 'closed', mage: -2 },
        { R: [80, 64], fan: 30, L: [12, 88], tilt: 0, mouth: 'o', mage: -1 },
        { R: [86, 76], fan: 70, L: [10, 90], tilt: -2 },
        { R: [86, 88], fan: 100, L: [8, 92], tilt: -3 }
      ]
    }
  };

  // 叩かれたときの 1 コマ（目を回して両手を上げる）
  const HIT = { L: [14, 50], R: [86, 50], eyes: 'x', mouth: 'open', brows: 'worried', noProp: true };

  function frameSvg(key, pose, cls) {
    const a = ART[key];
    // 持ち物の向きなど、コマに無い値は最初のコマから借りる
    const p = Object.assign({}, a.frames[0], pose);
    const dy = p.dy || 0;
    return `<g class="${cls}"${cls === 'f' ? '' : ''} transform="translate(0 ${dy})">${a.draw(p)}</g>`;
  }

  // 12 コマ + やられの 1 コマを 1 枚の SVG にまとめる（表示するコマは game.js が切り替える）
  function svg(key, labelText) {
    const a = ART[key];
    let body = a.frames.map((pose) => frameSvg(key, pose, 'f')).join('');
    const hit = Object.assign({}, HIT, key === 'ieyasu' ? { L: [14, 50], R: [86, 50] } : {});
    body += `<g class="fhit">${frameSvg(key, hit, 'x').replace(/^<g class="x"/, '<g')}${stars}</g>`;
    return `<svg viewBox="0 0 100 110" overflow="visible" data-fps="${a.fps}">${body}</svg>`.replace(/\{\{label\}\}/g, labelText);
  }

  return { FRAMES, svg, fps: (key) => ART[key].fps, keys: Object.keys(ART) };
})();
