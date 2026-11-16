// 本能寺の変モグラ叩き：ゲームの進行・画面の切り替え・広告を出す場面
(() => {
  const t = I18N.t;
  const $ = (id) => document.getElementById(id);

  // Android / iOS アプリ（Capacitor）で動いているか。Web 版では Capacitor がないので何もしない
  const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const plugin = (name) => (NATIVE && window.Capacitor.Plugins ? window.Capacitor.Plugins[name] : null);
  if (NATIVE) document.body.classList.add('native');

  // ---- 人物ごとの得点と出やすさ ----
  const RULES = {
    mitsuhide:  { points: 5,  weight: 12 },
    hideyoshi:  { points: 2,  weight: 11 },
    ieyasu:     { points: 2,  weight: 11 },
    yoshiaki:   { points: 2,  weight: 11 },
    kuge:       { points: 2,  weight: 11 },
    missionary: { points: 2,  weight: 11 },
    sohei:      { points: 2,  weight: 11 },
    ranmaru:    { points: -3, weight: 13 },
    nobunaga:   { points: 0,  weight: 10, gameOver: true }
  };
  const KEYS = Object.keys(RULES);

  const GAME_MS = 30000;
  const HOLE_COUNT = 9;
  const REDO_MAX = 1;        // 信長を叩いたときに広告で時を戻せる回数（1 ゲーム）
  const REDO_DELAY = 2200;   // 叩いてしまった様子を見届けてから案内を出す
  const REDO_WAIT = 6;       // 案内は 6 秒で自動的に閉じて結果へ

  const state = {
    phase: 'loading',        // loading | title | howto | play | struck（信長を叩いた直後）| over
    paused: false,
    score: 0, combo: 0, maxCombo: 0,
    kills: {}, remaining: GAME_MS,
    redoUsed: 0, snapshot: null, struckLord: false,
    best: Number(I18N.store.get('best', '0')) || 0,
    newBest: false
  };
  let spawnTimer = null;

  // ---------- コマ送りアニメーション ----------
  // 人物の SVG には 12 コマ（g.f）とやられの 1 コマ（g.fhit）が入っている。表示するコマだけ class="on" にする
  const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animated = new Set();
  function animate(svgEl) {
    svgEl._frames = Array.from(svgEl.querySelectorAll(':scope > g.f'));
    svgEl._fps = Number(svgEl.dataset.fps) || 12;
    svgEl._t0 = performance.now() - Math.random() * 1000;
    svgEl._idx = -1;
    showFrame(svgEl, 0);
    if (!REDUCED) animated.add(svgEl);
  }
  function showFrame(svgEl, i) {
    if (svgEl._idx === i) return;
    if (svgEl._idx >= 0 && svgEl._frames[svgEl._idx]) svgEl._frames[svgEl._idx].classList.remove('on');
    svgEl._frames[i].classList.add('on');
    svgEl._idx = i;
  }
  function showHitFrame(svgEl) {
    animated.delete(svgEl);
    svgEl._frames.forEach((g) => g.classList.remove('on'));
    const hit = svgEl.querySelector(':scope > g.fhit');
    if (hit) hit.classList.add('on');
  }
  (function tick(now) {
    for (const el of animated) {
      if (!el.isConnected) { animated.delete(el); continue; }
      if (el._cast && state.phase !== 'howto') continue;   // 隠れている「あそびかた」の人物は動かさない
      // 描画の時刻はコマ送りを始めた時刻より少し前のことがあるので、負にならないようにする
      const n = Characters.FRAMES;
      const i = ((Math.floor((now - el._t0) / 1000 * el._fps) % n) + n) % n;
      showFrame(el, i);
    }
    requestAnimationFrame(tick);
  })(performance.now());

  // 人物の絵は起動時に 1 度だけ作っておき（<template>）、出すときは複製して名札だけ書き換える。
  // 出るたびに 13 コマ分の SVG を組み立てて読み込むと、スマホでは叩いたときの反応が遅れるため
  const figCache = {};
  function figureTemplate(key, mode) {
    const id = key + (mode || '');
    if (!figCache[id]) {
      const tpl = document.createElement('template');
      tpl.innerHTML = Characters.svg(key, '', mode);
      figCache[id] = tpl;
    }
    return figCache[id];
  }
  function makeFigure(key, mode) {
    const svgEl = figureTemplate(key, mode).content.firstElementChild.cloneNode(true);
    const label = t('chars')[key].label;
    svgEl.querySelectorAll('text.lbl').forEach((el) => { el.textContent = label; });
    animate(svgEl);
    return svgEl;
  }

  // ---------- 穴 ----------
  const gameEl = $('game');
  const holes = [];
  for (let i = 0; i < HOLE_COUNT; i++) {
    const el = document.createElement('div');
    el.className = 'hole';
    const pit = document.createElement('div');
    pit.className = 'pit';
    el.appendChild(pit);
    const hole = { el, pit, type: null, charEl: null, hideTimer: null };
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); whack(hole); });
    gameEl.appendChild(el);
    holes.push(hole);
  }

  // 穴の切り抜き：上側は広く（腕や刀がはみ出せる）、下側は穴の円の形。
  // マスク画像の重ね合わせはスマホで描画が抜けることがあるので、単純な図形（clip-path）で切る
  function fitPits() {
    const H = holes[0].el.offsetWidth;
    if (!H) return;
    const r = (v) => Math.round(v * 10) / 10;
    const W = 1.6 * H, cy = 1.2 * H, rad = 0.5 * H;
    const path = `path('M0 0 H${r(W)} V${r(cy)} H${r(0.8 * H + rad)} A${r(rad)} ${r(rad)} 0 0 1 ${r(0.8 * H - rad)} ${r(cy)} H0 Z')`;
    holes.forEach((h) => { h.pit.style.clipPath = path; });
  }
  if (window.ResizeObserver) new ResizeObserver(fitPits).observe(gameEl);
  window.addEventListener('resize', fitPits);

  function progress() { return 1 - state.remaining / GAME_MS; }

  function pickType() {
    const total = KEYS.reduce((s, k) => s + RULES[k].weight, 0);
    let r = Math.random() * total;
    for (const k of KEYS) if ((r -= RULES[k].weight) < 0) return k;
    return 'mitsuhide';
  }


  // ---------- 出方のバリエーション ----------
  // 各出方は [ポーズ, 続ける時間(ms)] の並び。ポーズは up（全身）/ peek（半分だけ顔を出す）/ bob（少し沈む）/ hide（引っ込む）
  const PATTERNS = [
    { name: 'normal', w: 46, steps: (s) => [['up', s]] },
    // ひょっこり：一瞬だけ
    { name: 'quick', w: 12, steps: (s) => [['up', s * 0.5]] },
    // フェイント：半分だけ顔を出して引っ込み、すぐに全身で出てくる
    { name: 'feint', w: 15, steps: (s) => [['peek', 380], ['hide', 300], ['up', s]] },
    // 出てきそうで出てこない：半分顔を出しては引っ込むだけ
    { name: 'tease', w: 9, steps: () => [['peek', 420], ['hide', 300], ['peek', 380], ['hide', 260], ['peek', 320]] },
    // おバカ：全然引っ込まず、ひょこひょこ上下しながら居座る
    { name: 'stubborn', w: 10, steps: () => Array.from({ length: 7 }, () => [['up', 380], ['bob', 240]]).flat() },
    // 二度出し：引っ込んだと思ったら、同じ穴からまた出てくる
    { name: 'twice', w: 8, steps: (s) => [['up', s * 0.5], ['hide', 260], ['up', s * 0.6]] }
  ];
  function pickPattern(p) {
    // 序盤は素直な出方を多めに、時間がたつほど意地悪な出方を増やす
    const weight = (pt) => pt.name === 'normal' ? pt.w * (1.4 - p) : pt.w * (0.6 + p);
    const total = PATTERNS.reduce((a, pt) => a + weight(pt), 0);
    let r = Math.random() * total;
    for (const pt of PATTERNS) if ((r -= weight(pt)) < 0) return pt;
    return PATTERNS[0];
  }
  function setPose(charEl, pose) {
    charEl.classList.toggle('up', pose === 'up' || pose === 'bob');
    charEl.classList.toggle('bob', pose === 'bob');
    charEl.classList.toggle('peek', pose === 'peek');
  }
  function runSteps(hole, charEl, steps, i) {
    if (hole.charEl !== charEl) return;           // もう叩かれた・片付けられた
    if (i >= steps.length) {
      // 叩くべき相手を逃したら連撃は途切れる
      if (hole.type && RULES[hole.type].points > 0) { state.combo = 0; updateHud(); }
      clearHole(hole, false);
      return;
    }
    const [pose, ms] = steps[i];
    setPose(charEl, pose);
    // 引っ込んでいる間は叩けない（空振りになる）
    hole.vulnerable = pose !== 'hide';
    hole.hideTimer = setTimeout(() => runSteps(hole, charEl, steps, i + 1), ms);
  }

  function spawn() {
    if (state.phase !== 'play' || state.paused) return;
    const p = progress();
    const empty = holes.filter((h) => !h.type);
    const maxUp = p < 0.4 ? 1 : p < 0.75 ? 2 : 3;
    if (empty.length && HOLE_COUNT - empty.length < maxUp) {
      const hole = empty[Math.floor(Math.random() * empty.length)];
      const type = pickType();
      const charEl = document.createElement('div');
      charEl.className = 'char';
      charEl.appendChild(makeFigure(type));
      hole.pit.appendChild(charEl);
      hole.type = type;
      hole.charEl = charEl;
      hole.vulnerable = false;
      const stay = 1150 - p * 500 + (type === 'mitsuhide' ? -150 : 0);
      const pattern = pickPattern(p);
      requestAnimationFrame(() => requestAnimationFrame(() => runSteps(hole, charEl, pattern.steps(stay), 0)));
    }
    spawnTimer = setTimeout(spawn, 650 - p * 300 + Math.random() * 250);
  }

  function clearHole(hole, wasHit) {
    clearTimeout(hole.hideTimer);
    const charEl = hole.charEl;
    hole.type = null;
    hole.charEl = null;
    hole.vulnerable = false;
    if (!charEl) return;
    if (wasHit) {
      showHitFrame(charEl.firstElementChild);
      charEl.classList.add('hit');
      setTimeout(() => charEl.classList.remove('up'), 260);
      setTimeout(() => charEl.remove(), 560);
    } else {
      charEl.classList.remove('up');
      setTimeout(() => charEl.remove(), 260);
    }
  }
  const clearAll = () => holes.forEach((h) => clearHole(h, false));

  // ---------- 成敗の演出：斬撃・火花・画面の光、人物を宙に吹き飛ばす ----------
  const fxLayer = document.createElement('div');
  fxLayer.id = 'fxLayer';
  document.body.appendChild(fxLayer);
  const flashEl = document.createElement('div');
  flashEl.id = 'flash';
  document.body.appendChild(flashEl);

  function flash(color) {
    flashEl.style.background = color;
    flashEl.classList.remove('on');
    void flashEl.offsetWidth;
    flashEl.classList.add('on');
  }

  function slashFx(hole, big) {
    const rots = big ? [-28, 30] : [Math.random() < 0.5 ? -28 : 28];
    rots.forEach((rot, i) => {
      const sl = document.createElement('div');
      sl.className = 'slash' + (big ? ' big' : '');
      sl.style.setProperty('--rot', rot + 'deg');
      sl.style.animationDelay = i * 0.07 + 's';
      hole.el.appendChild(sl);
      setTimeout(() => sl.remove(), 500);
    });
    const n = big ? 22 : 12;
    for (let i = 0; i < n; i++) {
      const sp = document.createElement('div');
      sp.className = 'spark';
      const a = Math.random() * Math.PI * 2, d = (big ? 90 : 55) + Math.random() * (big ? 90 : 50);
      sp.style.setProperty('--dx', Math.cos(a) * d + 'px');
      sp.style.setProperty('--dy', Math.sin(a) * d + 'px');
      hole.el.appendChild(sp);
      setTimeout(() => sp.remove(), 650);
    }
  }

  // 叩いた人物を、目を回したコマにして回転させながら放物線で画面の外へ飛ばす
  function launch(hole, big) {
    const charEl = hole.charEl;
    clearTimeout(hole.hideTimer);
    hole.type = null;
    hole.charEl = null;
    if (!charEl) return;
    const svgEl = charEl.firstElementChild;
    showHitFrame(svgEl);
    if (REDUCED) { charEl.remove(); return; }
    const r = charEl.getBoundingClientRect();
    const fly = document.createElement('div');
    fly.className = 'flyer';
    Object.assign(fly.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    fly.appendChild(svgEl);
    fxLayer.appendChild(fly);
    charEl.remove();
    // 左の列の穴は左へ、右の列は右へ、真ん中はどちらかへ飛ばす
    const col = holes.indexOf(hole) % 3;
    const dir = col === 0 ? -1 : col === 2 ? 1 : (Math.random() < 0.5 ? -1 : 1);
    const power = big ? 1.3 : 1;
    const vx = dir * (220 + Math.random() * 320) * power;
    const vy = -(1050 + Math.random() * 300) * power;
    const spin = dir * (540 + Math.random() * 540) * power;
    const g = 2600;
    const t0 = performance.now();
    (function step(now) {
      const t = (now - t0) / 1000;
      const x = vx * t, y = vy * t + 0.5 * g * t * t;
      const sc = 1 + (big ? 0.7 : 0.35) * Math.min(1, t * 2.5);
      fly.style.transform = `translate(${x}px, ${y}px) rotate(${spin * t}deg) scale(${sc})`;
      if (t < 1.8 && r.top + y < window.innerHeight + 300) requestAnimationFrame(step);
      else fly.remove();
    })(t0);
  }

  function shake() {
    document.body.classList.remove('shake');
    void document.body.offsetWidth;
    document.body.classList.add('shake');
  }

  function showPop(hole, text, cls) {
    const pop = document.createElement('div');
    pop.className = 'pop ' + cls;
    pop.textContent = text;
    hole.el.appendChild(pop);
    setTimeout(() => pop.remove(), 800);
  }

  function whack(hole) {
    if (state.phase !== 'play' || state.paused) return;
    if (!hole.type || !hole.vulnerable) {
      state.combo = 0;
      updateHud();
      Sound.fx('whiff');
      return;
    }
    const type = hole.type;
    const rule = RULES[type];

    if (rule.gameOver) {
      // 時を戻すときのために、叩く前の状態を覚えておく
      state.snapshot = { score: state.score, combo: state.combo, maxCombo: state.maxCombo, remaining: state.remaining, kills: { ...state.kills } };
      state.kills[type]++;
      struckLord(hole);
      return;
    }

    state.kills[type]++;
    if (rule.points > 0) {
      state.combo++;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      const gained = rule.points + (state.combo >= 10 ? 2 : state.combo >= 5 ? 1 : 0);
      state.score += gained;
      const cry = t('chars')[type].cry;
      const big = type === 'mitsuhide';
      showPop(hole, `+${gained}${cry ? ' ' + cry : ''}`, big ? 'plus big' : 'plus');
      Sound.fx('hit', { level: state.combo >= 10 ? 2 : state.combo >= 5 ? 1 : 0, big });
      slashFx(hole, big);
      if (big) { flash('rgba(255,250,230,0.85)'); shake(); }
      launch(hole, big);
      updateHud();
      return;
    } else {
      state.score = Math.max(0, state.score + rule.points);
      state.combo = 0;
      showPop(hole, `${rule.points} ${t('pop.ranmaru')}`, 'minus');
      Sound.fx('fail');
      shake();
    }
    clearHole(hole, true);
    updateHud();
  }

  // ---------- 信長を叩いてしまったとき ----------
  function struckLord(hole) {
    state.phase = 'struck';
    clearTimeout(spawnTimer);
    Sound.bgmStop();
    Sound.fx('lord');
    shake();
    showPop(hole, t('pop.lord'), 'minus big');
    flash('rgba(220,30,20,0.6)');
    holes.forEach((h) => { if (h !== hole) clearHole(h, false); });
    // 信長は沈まず、穴から大きくせり上がって怒る（時を戻すか結果画面に移るまで）
    clearTimeout(hole.hideTimer);
    const charEl = hole.charEl;
    if (charEl) {
      charEl.innerHTML = '';
      charEl.appendChild(makeFigure('nobunaga', 'angry'));
      charEl.classList.remove('peek', 'bob');
      charEl.classList.add('up', 'angry');
    }
    render();
    if (Ads.canReward && state.redoUsed < REDO_MAX) setTimeout(() => { if (state.phase === 'struck') showRedo(); }, REDO_DELAY);
    else setTimeout(() => { if (state.phase === 'struck') endGame(true); }, 1300);
  }

  // ---------- リワード広告のチート：広告を見て、信長を叩く前まで時を戻す（アプリのみ・1 ゲーム 1 回） ----------
  const redoEl = $('redo');
  const redo = { active: false, busy: false, left: 0, timer: null };
  function showRedo() {
    Object.assign(redo, { active: true, busy: false, left: REDO_WAIT });
    $('redoWatch').disabled = false;
    $('redoWatch').textContent = t('redo.watch');
    $('redoNote').textContent = t('redo.note');
    $('redoNext').textContent = t('redo.next', { s: redo.left });
    redoEl.hidden = false;
    clearInterval(redo.timer);
    redo.timer = setInterval(() => {
      if (redo.busy) return;
      redo.left--;
      $('redoNext').textContent = t('redo.next', { s: Math.max(0, redo.left) });
      if (redo.left <= 0) declineRedo();
    }, 1000);
  }
  function closeRedo() {
    redo.active = false;
    clearInterval(redo.timer);
    redoEl.hidden = true;
  }
  function declineRedo() {
    if (!redo.active || redo.busy) return;
    closeRedo();
    endGame(true);
  }
  $('redoNext').addEventListener('click', declineRedo);
  $('redoWatch').addEventListener('click', async () => {
    if (!redo.active || redo.busy) return;
    redo.busy = true;
    $('redoWatch').disabled = true;
    $('redoWatch').textContent = t('redo.loading');
    const result = await Ads.showRewarded();
    if (!redo.active) return;
    if (result === 'unavailable') {
      $('redoNote').textContent = t('redo.fail');
      setTimeout(() => { redo.busy = false; declineRedo(); }, 2000);
      return;
    }
    redo.busy = false;
    if (result !== 'rewarded') { declineRedo(); return; }
    // 信長を叩く前の状態に戻して続ける
    closeRedo();
    clearAll();
    Object.assign(state, state.snapshot);
    state.redoUsed++;
    state.phase = 'play';
    state.paused = false;
    Sound.bgmStart();
    spawnTimer = setTimeout(spawn, 600);
    render();
  });

  // ---------- 時計 ----------
  let lastTick = performance.now();
  setInterval(() => {
    const now = performance.now();
    const dt = now - lastTick;
    lastTick = now;
    if (state.phase !== 'play' || state.paused) return;
    state.remaining = Math.max(0, state.remaining - dt);
    updateHud();
    if (state.remaining <= 0) endGame(false);
  }, 100);

  // 炎の強さ。CSS の変数を書き換えると画面全体の見た目を計算し直すので、0.05 刻みで変わったときだけにする
  let fireShown = -1;
  function setFire(level) {
    const q = Math.round(level * 20) / 20;
    if (q !== fireShown) {
      fireShown = q;
      document.body.style.setProperty('--fire-level', q.toFixed(2));
    }
    if (window.Scene) Scene.setLevel(level);
  }

  function updateHud() {
    $('score').textContent = state.score;
    $('combo').textContent = state.combo;
    $('time').textContent = Math.ceil(state.remaining / 1000);
    const p = progress();
    document.querySelector('#fireBar div').style.width = (p * 100) + '%';
    Sound.setIntensity(p);
    if (state.phase === 'play' || state.phase === 'struck') setFire(0.2 + p * 0.75);
  }

  // ---------- 進行 ----------
  function startGame() {
    closeRedo();
    clearTimeout(spawnTimer);
    clearAll();
    Object.assign(state, {
      phase: 'play', paused: false, score: 0, combo: 0, maxCombo: 0,
      kills: Object.fromEntries(KEYS.map((k) => [k, 0])),
      remaining: GAME_MS, redoUsed: 0, snapshot: null, struckLord: false, newBest: false
    });
    lastTick = performance.now();
    updateHud();
    render();
    Sound.play('start');
    Sound.bgmStart();
    spawnTimer = setTimeout(spawn, 600);
  }

  function pause() {
    if (state.phase !== 'play' || state.paused) return;
    state.paused = true;
    clearTimeout(spawnTimer);
    clearAll();
    Sound.bgmStop();
    render();
  }

  function endGame(struck) {
    closeRedo();
    clearTimeout(spawnTimer);
    clearAll();
    Sound.bgmStop();
    Sound.play('end');
    state.phase = 'over';
    state.paused = false;
    state.struckLord = struck;
    if (state.score > state.best) {
      state.best = state.score;
      state.newBest = true;
      I18N.store.set('best', String(state.best));
    }
    renderResult();
    render();
  }

  function rankOf() {
    return state.struckLord ? t('lordRank') : t('ranks').find((r) => state.score >= r.min);
  }

  function renderResult() {
    const rank = rankOf();
    $('rankTitle').textContent = rank.title;
    $('finalScore').textContent = state.score;
    $('rankQuote').textContent = rank.quote;
    $('bestInfo').textContent = state.newBest ? t('result.newBest') : t('result.best', { n: state.best });
    const names = t('chars');
    const list = KEYS.filter((k) => RULES[k].points > 0).map((k) => `${names[k].short} ${state.kills[k] || 0}`);
    $('stats').textContent = t('stats')(list, state.kills.ranmaru || 0, state.maxCombo);
    $('redoInfo').hidden = !state.redoUsed;
    $('redoInfo').textContent = t('result.redo', { n: state.redoUsed });
    $('shareToast').hidden = true;
  }

  // ---------- 画面 ----------
  function render() {
    const ph = state.phase;
    $('loadingScreen').hidden = ph !== 'loading';
    $('titleScreen').hidden = ph !== 'title';
    $('howtoScreen').hidden = ph !== 'howto';
    $('gameScreen').hidden = !['play', 'struck', 'over'].includes(ph);
    $('pauseMenu').hidden = !(ph === 'play' && state.paused) || adBusy;
    $('result').hidden = ph !== 'over' || adBusy;
    $('pauseBtn').hidden = !(ph === 'play' && !state.paused);
    $('langBtn').hidden = !['title', 'howto', 'over'].includes(ph);
    $('bgmBtn').hidden = ph === 'loading';
    // プレイ中は背景の火事の描画を軽くする（盤面に隠れてほとんど見えないため）
    if (window.Scene && Scene.setBusy) Scene.setBusy(ph === 'play' || ph === 'struck');
    $('bestScore').textContent = state.best;
    if (ph === 'title' || ph === 'howto') setFire(0.45);
    // バナー広告：タイトル・あそびかた・ポーズ・結果画面だけ（プレイ中は穴と重なるので出さない）
    Ads.setBanner(!adBusy && (ph === 'title' || ph === 'howto' || ph === 'over' || (ph === 'play' && state.paused)));
  }

  // ---------- 全画面広告（アプリのみ） ----------
  // 「出陣」（タイトル・あそびかたから）・「タイトルへ」（あそびかた・ポーズ・結果から）・「再開」・「もう一度」のたびに毎回出す
  let adBusy = false;
  async function withInterstitial(next) {
    if (adBusy) return;
    if (Ads.available) {
      adBusy = true;
      render();
      await Ads.showInterstitial(3000);
      adBusy = false;
    }
    next();
    render();
  }
  function play() { if (state.phase === 'title' || state.phase === 'howto') withInterstitial(startGame); }
  function retry() { if (state.phase === 'over') withInterstitial(startGame); }
  function goTitle() {
    withInterstitial(() => {
      closeRedo();
      clearTimeout(spawnTimer);
      clearAll();
      Sound.bgmStop();
      state.phase = 'title';
      state.paused = false;
    });
  }
  function resumeFromPause() {
    if (!(state.phase === 'play' && state.paused)) return;
    withInterstitial(() => {
      state.paused = false;
      lastTick = performance.now();
      Sound.bgmStart();
      spawnTimer = setTimeout(spawn, 500);
    });
  }
  function openHowto() { if (state.phase === 'title' && !adBusy) { state.phase = 'howto'; render(); } }

  $('playBtn').addEventListener('click', play);
  $('howtoBtn').addEventListener('click', openHowto);
  $('howtoPlay').addEventListener('click', play);
  $('howtoBack').addEventListener('click', () => { if (state.phase === 'howto') goTitle(); });
  $('pauseBtn').addEventListener('click', pause);
  $('pauseResume').addEventListener('click', resumeFromPause);
  $('pauseTitle').addEventListener('click', () => { if (state.paused) goTitle(); });
  $('retryBtn').addEventListener('click', retry);
  $('titleBtn').addEventListener('click', () => { if (state.phase === 'over') goTitle(); });

  // Android の戻るボタン：プレイ中は一時停止（一時停止中なら再開）、あそびかたではタイトルへ、
  // タイトル・結果画面ではアプリを終了、信長を叩いた直後は結果へ
  if (plugin('App')) {
    plugin('App').addListener('backButton', () => {
      if (adBusy) return;
      if (state.phase === 'howto') goTitle();
      else if (state.phase === 'title' || state.phase === 'over') plugin('App').exitApp();
      else if (state.phase === 'struck') { if (redo.active) declineRedo(); }
      else if (state.paused) resumeFromPause();
      else pause();
    });
  }

  // 別のアプリに切り替えたら一時停止して音を止める（広告の表示中は広告側が音を止めている）
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pause();
      Sound.suspend();
    } else if (!Ads.showing) {
      Sound.resume();
    }
  });

  // ---------- シェア ----------
  // シェア文に付ける紹介記事の URL（アプリ・Web 版とも）
  const SHARE_URL = 'https://techgym.jp/column/claude-code-game-mogura/';
  $('shareBtn').addEventListener('click', async () => {
    const text = t('share.text', {
      score: state.score,
      rank: rankOf().title,
      redo: state.redoUsed ? t('share.redo', { n: state.redoUsed }) : ''
    });
    const nativeShare = plugin('Share');
    if (nativeShare) {
      try { await nativeShare.share({ title: t('share.title'), text, url: SHARE_URL, dialogTitle: t('share.dialog') }); } catch (e) { /* キャンセル */ }
      return;
    }
    if (navigator.share) {
      try { await navigator.share({ title: t('share.title'), text, url: SHARE_URL }); } catch (e) { /* キャンセル */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(text + ' ' + SHARE_URL);
      $('shareToast').textContent = t('share.copied');
      $('shareToast').hidden = false;
    } catch (e) { /* コピーできない環境 */ }
  });

  // ---------- 右上のボタン ----------
  function updateBgmBtn() {
    const btn = $('bgmBtn');
    btn.textContent = Sound.bgmEnabled ? t('bgm.on') : t('bgm.off');
    btn.setAttribute('aria-pressed', String(Sound.bgmEnabled));
  }
  $('bgmBtn').addEventListener('click', () => {
    if (Sound.toggleBgm() && state.phase === 'play' && !state.paused) Sound.bgmStart();
    updateBgmBtn();
  });
  $('langBtn').addEventListener('click', () => I18N.toggle());

  // ---------- あそびかたの人物一覧 ----------
  function buildCast() {
    const cast = $('cast');
    cast.innerHTML = '';
    const names = t('chars');
    for (const k of KEYS) {
      const r = RULES[k];
      const item = document.createElement('div');
      item.className = 'castItem' + (r.points > 0 ? '' : ' ng');
      const fig = makeFigure(k);
      fig._cast = true;
      item.appendChild(fig);
      const pts = r.gameOver ? t('howto.gameover') : (r.points > 0 ? '+' : '−') + Math.abs(r.points);
      item.insertAdjacentHTML('beforeend', `<div>${names[k].name}</div><div class="pts">${pts}</div>`);
      cast.appendChild(item);
    }
  }

  // ---------- タイトル画面の下：バージョン（アプリ版）・プライバシーポリシー・広告の設定（EU など） ----------
  if (window.APP_VERSION && window.APP_VERSION !== 'dev') $('buildInfo').textContent = window.APP_VERSION;
  Ads.initDone.then(() => { if (Ads.privacyOptionsRequired) $('adPrivacy').hidden = false; });
  $('adPrivacy').addEventListener('click', (e) => { e.preventDefault(); Ads.showPrivacyOptions(); });
  $('rewindNote').hidden = !Ads.canReward;

  // 言語が変わったら、文言と人物の名札を描き直す
  I18N.onChange(() => {
    buildCast();
    updateBgmBtn();
    holes.forEach((h) => {
      const label = h.charEl && h.charEl.querySelectorAll('text.lbl');
      if (label) label.forEach((el) => { el.textContent = t('chars')[h.type].label; });
    });
    if (state.phase === 'over') renderResult();
  });

  // ---------- 起動：絵と音の準備を全部済ませてからタイトルを出す ----------
  async function boot() {
    I18N.apply();
    updateBgmBtn();
    state.kills = Object.fromEntries(KEYS.map((k) => [k, 0]));
    updateHud();
    render();
    const bar = document.querySelector('#loadBar div');
    const steps = [
      ...KEYS.map((k) => () => figureTemplate(k)),
      () => figureTemplate('nobunaga', 'angry'),
      () => buildCast(),
      () => Sound.preload()
    ];
    for (let i = 0; i < steps.length; i++) {
      await steps[i]();
      bar.style.width = Math.round((i + 1) / steps.length * 100) + '%';
      // 1 つ終わるごとに画面を描き直させて、読み込み中の表示を止めない
      await new Promise((r) => requestAnimationFrame(() => r()));
    }
    fitPits();
    state.phase = 'title';
    render();
  }
  // 最初に画面に触れたときに音を出せるようにする（ブラウザは操作があるまで音を止めている）
  document.addEventListener('pointerdown', () => Sound.unlock(), { capture: true });
  boot();
})();
