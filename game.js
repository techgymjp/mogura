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
    phase: 'title',          // title | howto | play | struck（信長を叩いた直後）| over
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
      // 描画の時刻はコマ送りを始めた時刻より少し前のことがあるので、負にならないようにする
      const n = Characters.FRAMES;
      const i = ((Math.floor((now - el._t0) / 1000 * el._fps) % n) + n) % n;
      showFrame(el, i);
    }
    requestAnimationFrame(tick);
  })(performance.now());

  function makeFigure(key) {
    const wrap = document.createElement('div');
    wrap.innerHTML = Characters.svg(key, t('chars')[key].label);
    const svgEl = wrap.firstElementChild;
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

  function progress() { return 1 - state.remaining / GAME_MS; }

  function pickType() {
    const total = KEYS.reduce((s, k) => s + RULES[k].weight, 0);
    let r = Math.random() * total;
    for (const k of KEYS) if ((r -= RULES[k].weight) < 0) return k;
    return 'mitsuhide';
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
      requestAnimationFrame(() => requestAnimationFrame(() => charEl.classList.add('up')));
      const stay = 1150 - p * 500 + (type === 'mitsuhide' ? -150 : 0);
      hole.hideTimer = setTimeout(() => {
        // 叩くべき相手を逃したら連撃は途切れる
        if (hole.type && RULES[hole.type].points > 0) { state.combo = 0; updateHud(); }
        clearHole(hole, false);
      }, stay);
    }
    spawnTimer = setTimeout(spawn, 650 - p * 300 + Math.random() * 250);
  }

  function clearHole(hole, wasHit) {
    clearTimeout(hole.hideTimer);
    const charEl = hole.charEl;
    hole.type = null;
    hole.charEl = null;
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
    if (!hole.type) {
      state.combo = 0;
      updateHud();
      Sound.play('miss');
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
      showPop(hole, `+${gained}${cry ? ' ' + cry : ''}`, 'plus');
      Sound.play('hit');
    } else {
      state.score = Math.max(0, state.score + rule.points);
      state.combo = 0;
      showPop(hole, `${rule.points} ${t('pop.ranmaru')}`, 'minus');
      Sound.play('miss');
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
    Sound.play('miss');
    shake();
    showPop(hole, t('pop.lord'), 'minus');
    holes.forEach((h) => { if (h !== hole) clearHole(h, false); });
    clearHole(hole, true);
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

  function setFire(level) {
    document.body.style.setProperty('--fire-level', level.toFixed(2));
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
    $('titleScreen').hidden = ph !== 'title';
    $('howtoScreen').hidden = ph !== 'howto';
    $('gameScreen').hidden = !['play', 'struck', 'over'].includes(ph);
    $('pauseMenu').hidden = !(ph === 'play' && state.paused) || adBusy;
    $('result').hidden = ph !== 'over' || adBusy;
    $('pauseBtn').hidden = !(ph === 'play' && !state.paused);
    $('langBtn').hidden = !['title', 'howto', 'over'].includes(ph);
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
  $('shareBtn').addEventListener('click', async () => {
    const text = t('share.text', {
      score: state.score,
      rank: rankOf().title,
      redo: state.redoUsed ? t('share.redo', { n: state.redoUsed }) : ''
    });
    const nativeShare = plugin('Share');
    if (nativeShare) {
      try { await nativeShare.share({ title: t('share.title'), text, dialogTitle: t('share.dialog') }); } catch (e) { /* キャンセル */ }
      return;
    }
    if (navigator.share) {
      try { await navigator.share({ title: t('share.title'), text, url: location.href }); } catch (e) { /* キャンセル */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(text + ' ' + location.href);
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
      item.appendChild(makeFigure(k));
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

  I18N.apply();
  buildCast();
  updateBgmBtn();
  state.kills = Object.fromEntries(KEYS.map((k) => [k, 0]));
  updateHud();
  render();
})();
