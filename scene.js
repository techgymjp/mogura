// 背景の火事：粒子（炎・煙・火の粉）を重ねて、燃え上がる本能寺を描く。
// 寺の奥（屋根の向こうから立ち上る炎と煙）と手前（格子戸や軒から噴き出す炎と火の粉）の 2 枚のキャンバスを使う。
// 座標は背景の SVG と同じ 1000×1000（下端を画面の下にそろえ、はみ出す部分は切る）
window.Scene = (() => {
  const back = document.getElementById('fireBack');
  const front = document.getElementById('fireFront');
  if (!back || !front) return { setLevel() {} };
  const bctx = back.getContext('2d');
  const fctx = front.getContext('2d');
  const RES = 0.5;               // 炎はぼけていてよいので、半分の解像度で描いて軽くする
  const MAX_PARTICLES = 750;
  const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let level = 0.3;               // 0（くすぶり）〜 1（全焼）
  let W = 0, H = 0, scale = 1, ox = 0, oy = 0;
  const lightEls = document.querySelectorAll('#scene .fireLight');

  // ---- 粒子の絵（色ごとに、ふちがぼけた丸を用意しておく） ----
  function sprite(r, g, b, soft = 1) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const grd = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grd.addColorStop(0.35 * soft, `rgba(${r},${g},${b},0.55)`);
    grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = grd;
    x.fillRect(0, 0, 64, 64);
    return c;
  }
  // 炎は燃え始めが白っぽい黄色、上るにつれて橙・赤・暗い赤に変わる
  const FIRE = [
    [255, 246, 214], [255, 226, 140], [255, 190, 80], [255, 150, 45],
    [245, 110, 30], [220, 75, 20], [170, 45, 15], [110, 25, 10]
  ].map(([r, g, b]) => sprite(r, g, b));
  const SMOKE = sprite(38, 30, 32, 1.6);
  const SPARK = sprite(255, 214, 120, 0.6);

  // ---- 炎の出どころ（minLevel を超えると燃え始める） ----
  const EMITTERS = [
    // 寺の奥：屋根の向こうから立ち上る大きな炎
    { layer: 'back', x: 500, y: 438, w: 300, rate: 150, size: 46, life: 1.15, rise: 190, minLevel: 0 },
    { layer: 'back', x: 500, y: 470, w: 220, rate: 70, size: 54, life: 1.0, rise: 170, minLevel: 0.15 },
    { layer: 'back', x: 285, y: 545, w: 90, rate: 55, size: 40, life: 1.0, rise: 170, minLevel: 0.35 },
    { layer: 'back', x: 715, y: 545, w: 90, rate: 55, size: 40, life: 1.0, rise: 170, minLevel: 0.3 },
    { layer: 'back', x: 160, y: 690, w: 120, rate: 40, size: 50, life: 1.2, rise: 160, minLevel: 0.6 },
    { layer: 'back', x: 840, y: 690, w: 120, rate: 40, size: 50, life: 1.2, rise: 160, minLevel: 0.55 },
    // 寺の手前：格子戸から噴き出す炎、軒先をなめる炎
    { layer: 'front', x: 364, y: 818, w: 60, rate: 26, size: 24, life: 0.8, rise: 140, minLevel: 0.45 },
    { layer: 'front', x: 636, y: 818, w: 60, rate: 26, size: 24, life: 0.8, rise: 140, minLevel: 0.5 },
    { layer: 'front', x: 500, y: 818, w: 60, rate: 22, size: 22, life: 0.8, rise: 140, minLevel: 0.7 },
    { layer: 'front', x: 160, y: 640, w: 60, rate: 30, size: 28, life: 0.9, rise: 150, minLevel: 0.65 },
    { layer: 'front', x: 840, y: 640, w: 60, rate: 30, size: 28, life: 0.9, rise: 150, minLevel: 0.6 }
  ];

  const flames = { back: [], front: [] };
  const smoke = [];
  const sparks = [];
  let time = 0;

  function resize() {
    const cw = window.innerWidth, ch = window.innerHeight;
    W = Math.max(1, Math.round(cw * RES));
    H = Math.max(1, Math.round(ch * RES));
    for (const c of [back, front]) { c.width = W; c.height = H; }
    // 縦長の画面は横をはみ出させ（slice）、横長の画面は寺全体を収めて左右に空と地面を延ばす（meet）。
    // 背景の SVG も同じ置き方にそろえる
    const wide = cw > ch;
    document.querySelectorAll('#scene svg.layer').forEach((el) =>
      el.setAttribute('preserveAspectRatio', wide ? 'xMidYMax meet' : 'xMidYMax slice'));
    scale = wide ? Math.min(W / 1000, H / 1000) : Math.max(W / 1000, H / 1000);
    ox = (W - 1000 * scale) / 2;
    oy = H - 1000 * scale;
  }

  const total = () => flames.back.length + flames.front.length + smoke.length + sparks.length;

  function emit(dt) {
    for (const e of EMITTERS) {
      if (level < e.minLevel) continue;
      const strength = Math.min(1, (level - e.minLevel) / 0.35 + 0.25);
      let n = e.rate * strength * dt;
      while (n > 0 && total() < MAX_PARTICLES) {
        if (Math.random() > n) break;
        n -= 1;
        const big = 0.75 + level * 0.6;
        flames[e.layer].push({
          x: e.x + (Math.random() - 0.5) * e.w,
          y: e.y + (Math.random() - 0.5) * 10,
          vx: (Math.random() - 0.5) * 30,
          vy: -e.rise * (0.6 + Math.random() * 0.6) * big,
          size: e.size * (0.6 + Math.random() * 0.7) * big,
          life: e.life * (0.65 + Math.random() * 0.6) * (0.8 + level * 0.4),
          age: 0,
          seed: Math.random() * 100
        });
      }
    }
    // 煙は炎の上から
    if (Math.random() < dt * 9 * level && total() < MAX_PARTICLES) {
      smoke.push({ x: 360 + Math.random() * 280, y: 360 - Math.random() * 60, vx: -10 - Math.random() * 25, vy: -30 - Math.random() * 30,
        size: 60, life: 4 + Math.random() * 3, age: 0, seed: Math.random() * 100 });
    }
    // 火の粉
    if (Math.random() < dt * 30 * level && total() < MAX_PARTICLES) {
      sparks.push({ x: 300 + Math.random() * 400, y: 430 + Math.random() * 120, vx: (Math.random() - 0.5) * 120, vy: -150 - Math.random() * 220,
        size: 2 + Math.random() * 3, life: 1.5 + Math.random() * 2, age: 0, seed: Math.random() * 100 });
    }
  }

  function step(list, dt, buoy, turb) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.age += dt;
      if (p.age >= p.life) { list.splice(i, 1); continue; }
      // ゆらぎ：場所と時間で揺れ方を変える
      p.vx += Math.sin(time * 3.1 + p.seed + p.y * 0.02) * turb * dt;
      p.vy -= buoy * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  function drawFlames(ctx, list) {
    ctx.globalCompositeOperation = 'lighter';
    for (const p of list) {
      const k = p.age / p.life;
      const img = FIRE[Math.min(FIRE.length - 1, Math.floor(k * FIRE.length))];
      const a = (k < 0.1 ? k / 0.1 : Math.pow(1 - k, 1.2)) * 0.5;
      const r = p.size * (1 - k * 0.55) * scale;
      ctx.globalAlpha = a;
      ctx.drawImage(img, ox + p.x * scale - r, oy + p.y * scale - r, r * 2, r * 2);
    }
  }

  function draw() {
    bctx.globalCompositeOperation = 'source-over';
    bctx.globalAlpha = 1;
    bctx.clearRect(0, 0, W, H);
    fctx.globalCompositeOperation = 'source-over';
    fctx.globalAlpha = 1;
    fctx.clearRect(0, 0, W, H);

    // 煙（炎の奥）
    bctx.globalCompositeOperation = 'source-over';
    for (const p of smoke) {
      const k = p.age / p.life;
      const r = p.size * (1 + k * 2.2) * scale;
      bctx.globalAlpha = Math.sin(Math.PI * k) * 0.45;
      bctx.drawImage(SMOKE, ox + p.x * scale - r, oy + p.y * scale - r, r * 2, r * 2);
    }
    drawFlames(bctx, flames.back);
    drawFlames(fctx, flames.front);

    // 火の粉（またたく）
    fctx.globalCompositeOperation = 'lighter';
    for (const p of sparks) {
      const k = p.age / p.life;
      const r = p.size * (1 - k * 0.5) * scale * 2.2;
      fctx.globalAlpha = (1 - k) * (0.6 + 0.4 * Math.sin(time * 20 + p.seed));
      fctx.drawImage(SPARK, ox + p.x * scale - r, oy + p.y * scale - r, r * 2, r * 2);
    }
    fctx.globalAlpha = 1;

    // 寺に当たる火の照り返しをちらつかせる
    const flick = level * (0.7 + 0.3 * Math.sin(time * 13) * Math.sin(time * 7.3 + 1));
    lightEls.forEach((el) => { el.style.opacity = flick.toFixed(2); });
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!document.hidden) {
      time += dt;
      emit(dt);
      step(flames.back, dt, 40, 160);
      step(flames.front, dt, 40, 160);
      step(smoke, dt, 4, 20);
      step(sparks, dt, -30, 260);
      draw();
    }
    requestAnimationFrame(loop);
  }

  resize();
  window.addEventListener('resize', resize);
  if (REDUCED) {
    // 動きを減らす設定では、燃えている 1 枚の絵だけを描く
    for (let i = 0; i < 90; i++) { time += 1 / 30; emit(1 / 30); step(flames.back, 1 / 30, 40, 160); step(flames.front, 1 / 30, 40, 160); step(smoke, 1 / 30, 4, 20); }
    draw();
  } else {
    requestAnimationFrame(loop);
  }

  return {
    setLevel(v) {
      level = Math.max(0, Math.min(1, v));
      if (REDUCED) draw();
    }
  };
})();
