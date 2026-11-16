// 音：効果音と BGM。叩いたときの音（成敗・失敗・空振り）と BGM（尺八と三味線）は Web Audio で合成し、
// 出陣と終了の音は mp3 を鳴らす。広告の表示中やアプリを裏に回したときは suspend() で止め、resume() で戻す
window.Sound = (() => {
  // ---- 出陣・終了の音（mp3） ----
  const sfx = {};
  for (const name of ['start', 'end']) {
    const a = new Audio(name + '.mp3');
    a.preload = 'auto';
    sfx[name] = a;
  }
  let suspended = false;

  function play(name) {
    const a = sfx[name];
    if (!a || suspended) return;
    try {
      a.currentTime = 0;
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* 音声が再生できない環境では無視 */ }
  }

  // ---- BGM ----
  const AC = window.AudioContext || window.webkitAudioContext;
  // 音の通り道：BGM（bgmBus。止めるときに音量を絞る）と効果音（sfxBus）を分け、それぞれにお堂の響きを付ける
  let ctx = null, bgmBus, sfxBus, wet, sfxWet, noise, timer = null;
  let step = 0, nextTime = 0, playing = false;
  let intensity = 0; // 0（開始）→ 1（終了間際）。テンポと太鼓の数が増える
  let enabled = I18N.store.get('bgm', '1') === '1';

  const _ = '-';
  // 都節音階（D・E♭・G・A・B♭）。数値は MIDI ノート、"-" は伸ばし、null は休符
  // 尺八の旋律（間を多めに取り、長い音で吹く）
  const SHAKU = [
    62, _, _, 63,   67, _, _, _,    69, _, 70, 69,  67, _, _, null,
    69, _, 70, _,   74, _, _, _,    75, 74, 70, _,  69, _, _, null,
    74, _, 75, 74,  70, _, 69, _,   67, _, _, 63,   62, _, _, null,
    null, null, 67, 69, 70, _, 69, 67, 63, _, 62, _,  _, _, _, null
  ];
  // 三味線の手（チン・トン・シャンの刻み）。配列は和音（重音）
  const SHAMI = [
    [50, 57], null, 57, 58,   62, null, 58, 57,   [55, 62], null, 51, 55,   50, null, 55, 57,
    [50, 57], null, 57, 58,   62, null, 63, 62,   [58, 65], null, 57, 55,   [57, 64], null, 55, 51,
    [55, 62], null, 58, 57,   55, null, 51, 50,   [51, 58], null, 55, 57,   [50, 57], null, 50, 57,
    [50, 57], null, 51, 55,   57, null, 58, 57,   [55, 62], 51, 50, null,   [50, 57], null, null, null
  ];
  const LOOP = SHAKU.length;

  function init() {
    if (ctx) return;
    ctx = new AC();
    bgmBus = ctx.createGain();
    bgmBus.gain.value = 0;
    bgmBus.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.55;
    sfxBus.connect(ctx.destination);

    // 簡易リバーブ（お堂の響き）
    const len = ctx.sampleRate * 1.8;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    const conv = ctx.createConvolver();
    conv.buffer = ir;
    wet = ctx.createGain();
    wet.gain.value = 0.35;
    wet.connect(conv).connect(bgmBus);
    const conv2 = ctx.createConvolver();
    conv2.buffer = ir;
    sfxWet = ctx.createGain();
    sfxWet.gain.value = 0.4;
    sfxWet.connect(conv2).connect(sfxBus);

    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  }

  function out(node, reverb = 0.5, toSfx = false) {
    node.connect(toSfx ? sfxBus : bgmBus);
    if (reverb) {
      const g = ctx.createGain();
      g.gain.value = reverb;
      node.connect(g).connect(toSfx ? sfxWet : wet);
    }
  }

  function noiseBurst(time, type, freq, q, gain, decay, toSfx = false) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + decay);
    src.connect(f).connect(g);
    out(g, 0.3, toSfx);
    src.start(time);
    src.stop(time + decay + 0.05);
  }

  // ---- 三味線：はじいた弦の音（Karplus-Strong）を音の高さごとに作っておく ----
  const pluckCache = {};
  function pluckBuffer(midi) {
    if (pluckCache[midi]) return pluckCache[midi];
    const sr = ctx.sampleRate;
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const len = Math.floor(sr * 1.4);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const N = Math.max(2, Math.round(sr / f));
    const ring = new Float32Array(N);
    // 撥で強くはじく：最初の揺れは明るいノイズ
    for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    let idx = 0, prev = 0;
    for (let i = 0; i < len; i++) {
      const cur = ring[idx];
      const next = ring[(idx + 1) % N];
      // 減衰を小さめにして、三味線らしい明るく短い余韻にする
      ring[idx] = (cur * 0.62 + next * 0.38) * 0.994;
      // さわり：弦がさおに触れるビリつき（弱い折り返し歪み）
      let v = cur + 0.25 * Math.sign(cur) * cur * cur;
      d[i] = v * 0.6 + prev * 0.4;
      prev = v;
      idx = (idx + 1) % N;
    }
    pluckCache[midi] = buf;
    return buf;
  }

  function shamisen(notes, time, vel) {
    for (const midi of [].concat(notes)) {
      const src = ctx.createBufferSource();
      src.buffer = pluckBuffer(midi);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 120;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.32 * vel, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + 1.2);
      src.connect(hp).connect(g);
      out(g, 0.35);
      src.start(time);
      src.stop(time + 1.3);
    }
    // 撥が皮と弦に当たる「バチッ」という音
    noiseBurst(time, 'bandpass', 2400, 1.2, 0.22 * vel, 0.035);
  }

  // ---- 尺八：息の多い音。メリから持ち上げて入り、あとから揺りをかける ----
  function shakuhachi(midi, time, dur) {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const env = ctx.createGain();
    const peak = 0.16;
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(peak * 0.75, time + 0.07);
    // 長い音はふくらませる
    env.gain.linearRampToValueAtTime(peak, time + Math.max(0.1, dur * 0.6));
    env.gain.linearRampToValueAtTime(0, time + dur * 0.97);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.5;
    env.connect(lp);
    out(lp, 1.0);

    // 揺り：音の途中から、ゆっくり深くかける
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 4.6;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, time);
    depth.gain.setValueAtTime(0, time + Math.min(dur * 0.4, 0.35));
    depth.gain.linearRampToValueAtTime(f * 0.018, time + dur * 0.9);
    lfo.connect(depth);

    [['sine', 1, 1], ['triangle', 2, 0.09], ['sine', 3, 0.04]].forEach(([type, mul, level]) => {
      const o = ctx.createOscillator();
      o.type = type;
      // メリ（半音ほど低く）から本来の音へ持ち上げる
      o.frequency.setValueAtTime(f * mul * 0.94, time);
      o.frequency.exponentialRampToValueAtTime(f * mul, time + 0.16);
      depth.connect(o.frequency);
      const lv = ctx.createGain();
      lv.gain.value = level;
      o.connect(lv).connect(env);
      o.start(time);
      o.stop(time + dur + 0.05);
    });
    lfo.start(time);
    lfo.stop(time + dur + 0.05);

    // 息の音（音の高さのまわりのかすれ）
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = f * 1.5; bp.Q.value = 2.5;
    const bg = ctx.createGain();
    bg.gain.value = 0.55;
    src.connect(bp).connect(bg).connect(env);
    src.start(time);
    src.stop(time + dur + 0.05);
    // ムライキ：吹き始めの強い息
    noiseBurst(time, 'bandpass', f * 2, 0.8, 0.09, 0.18);
  }

  function playStep(i, time, beat) {
    // 三味線：炎上が進むと休みの拍にも刻みを入れて手数を増やす
    const sh = SHAMI[i];
    if (sh) shamisen(sh, time, Array.isArray(sh) ? 1 : 0.8);
    else if (intensity > 0.55 && i % 2 === 1) shamisen(SHAMI[(i + LOOP - 1) % LOOP] || 57, time, 0.5);

    const note = SHAKU[i];
    if (typeof note === 'number') {
      let len = 1;
      while (SHAKU[(i + len) % LOOP] === _) len++;
      shakuhachi(note, time, len * beat);
    }
  }

  function scheduler() {
    while (nextTime < ctx.currentTime + 0.15) {
      const beat = 60 / (88 + intensity * 56) / 2; // 8分音符の長さ（炎上が進むほど速く）
      playStep(step, nextTime, beat);
      nextTime += beat;
      step = (step + 1) % LOOP;
    }
  }


  // ======== 叩いたときの効果音（合成） ========
  // 時間とともに周波数が動くノイズ（刀や撥が空を切る音）
  function sweep(time, from, to, dur, gain, q = 1.2) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(from, time);
    f.frequency.exponentialRampToValueAtTime(to, time + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(f).connect(g);
    out(g, 0.15, true);
    src.start(time);
    src.stop(time + dur + 0.05);
  }

  // 音の高さが下がっていく正弦波（打撃の重み・太鼓・鼓）
  function thump(time, from, to, dur, gain, type = 'sine') {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, time);
    o.frequency.exponentialRampToValueAtTime(to, time + dur * 0.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(g);
    out(g, 0.3, true);
    o.start(time);
    o.stop(time + dur + 0.05);
  }

  // 金属の響き（刀身の「キーン」、銅鑼）。ratios は倍音、少しずつずらして唸りを出す
  function metal(time, base, ratios, dur, gain, glide = 1) {
    ratios.forEach((r, i) => {
      [1, 1.004].forEach((detune) => {
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(base * r * detune, time);
        if (glide !== 1) o.frequency.exponentialRampToValueAtTime(base * r * detune * glide, time + dur);
        const g = ctx.createGain();
        const a = gain / (i + 1) / 2;
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(a, time + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, time + dur * (1 - i * 0.08));
        o.connect(g);
        out(g, 0.6, true);
        o.start(time);
        o.stop(time + dur + 0.05);
      });
    });
  }

  // 三味線の音を、撥でかき下ろすように低く滑らせる（失敗の「ビヨーン」）
  function bend(time, midi, drop, dur, gain) {
    const src = ctx.createBufferSource();
    src.buffer = pluckBuffer(midi);
    src.playbackRate.setValueAtTime(1, time);
    src.playbackRate.exponentialRampToValueAtTime(drop, time + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur + 0.2);
    src.connect(g);
    out(g, 0.4, true);
    src.start(time);
    src.stop(time + dur + 0.3);
  }

  const FX = {
    // 成敗：刀が空を切る「シュッ」→ 手応えの「ズバッ」→ 刀身の「キーン」。
    // level（連撃ボーナス 0〜2）が上がるほど余韻が高く、big（光秀）は太鼓の「ドン」と長い余韻
    hit(t, { level = 0, big = false } = {}) {
      const up = Math.pow(1.122, level);
      sweep(t, 7000, 1400, 0.11, 0.55, 1.4);
      noiseBurst(t + 0.07, 'lowpass', 1400, 0.8, 0.75, 0.09, true);
      thump(t + 0.07, 190, 70, 0.16, 0.55);
      metal(t + 0.075, 1760 * up, [1, 1.51, 2.42, 3.1], big ? 1.1 : 0.45, big ? 0.16 : 0.1);
      if (big) {
        thump(t + 0.07, 120, 46, 0.7, 0.85);
        noiseBurst(t + 0.07, 'lowpass', 360, 0.7, 0.4, 0.12, true);
        sweep(t + 0.16, 5000, 900, 0.12, 0.3, 1.4);
      }
    },
    // 失敗（蘭丸）：鼓の「ポン」と、三味線が「ビヨーン」と下がる
    fail(t) {
      thump(t, 420, 210, 0.18, 0.5);
      noiseBurst(t, 'bandpass', 1800, 1.5, 0.25, 0.03, true);
      bend(t + 0.06, 62, 0.62, 0.45, 0.9);
      bend(t + 0.06, 69, 0.62, 0.45, 0.5);
    },
    // 失敗（信長）：大きな銅鑼の「ゴワーン」と低い地響き、下がっていく三味線
    lord(t) {
      metal(t, 98, [1, 1.47, 2.09, 2.71, 3.33, 4.18, 5.4], 3.2, 0.34, 0.94);
      thump(t, 80, 38, 2.2, 0.7);
      noiseBurst(t, 'lowpass', 900, 0.7, 0.6, 0.35, true);
      bend(t + 0.25, 57, 0.5, 1.1, 0.8);
      bend(t + 0.25, 50, 0.5, 1.1, 0.6);
    },
    // 空振り：撥が空を切る「ヒュッ」と、床に当たる小さな「コッ」
    whiff(t) {
      sweep(t, 1500, 420, 0.2, 0.35, 1.6);
      thump(t + 0.15, 900, 600, 0.05, 0.14, 'triangle');
    }
  };

  // 叩いたときの効果音を鳴らす（最初に叩いたときに音の準備をする）
  function fx(name, opts) {
    if (!AC || suspended || !FX[name]) return;
    init();
    if (ctx.state === 'suspended') ctx.resume();
    FX[name](ctx.currentTime + 0.005, opts);
  }

  function bgmStart() {
    if (!enabled || !AC || playing) return;
    init();
    if (ctx.state === 'suspended' && !suspended) ctx.resume();
    playing = true;
    step = 0;
    nextTime = ctx.currentTime + 0.08;
    bgmBus.gain.cancelScheduledValues(ctx.currentTime);
    bgmBus.gain.setValueAtTime(0.55, ctx.currentTime);
    timer = setInterval(scheduler, 25);
    scheduler();
  }

  function bgmStop() {
    if (!playing) return;
    playing = false;
    clearInterval(timer);
    bgmBus.gain.cancelScheduledValues(ctx.currentTime);
    bgmBus.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
  }

  // 起動時の準備：音の部品（響き・三味線の弦の音）を作り、mp3 を読み込んでおく。
  // 音を出すための仕組み（AudioContext）は作っておくだけで、最初に画面に触れたときに動かす
  function preload() {
    if (AC) {
      init();
      const notes = new Set([62, 69, 57, 50]);
      SHAMI.forEach((n) => [].concat(n || []).forEach((m) => notes.add(m)));
      notes.forEach((m) => pluckBuffer(m));
    }
    const waits = Object.values(sfx).map((a) => new Promise((resolve) => {
      if (a.readyState >= 3) return resolve();
      const done = () => resolve();
      a.addEventListener('canplaythrough', done, { once: true });
      a.addEventListener('error', done, { once: true });
      setTimeout(done, 4000); // 読み込めなくてもゲームは始められるようにする
      try { a.load(); } catch (e) { done(); }
    }));
    return Promise.all(waits);
  }

  function unlock() {
    if (ctx && ctx.state === 'suspended' && !suspended) ctx.resume();
  }

  return {
    play,
    fx,
    preload,
    unlock,
    bgmStart,
    bgmStop,
    setIntensity(v) { intensity = Math.max(0, Math.min(1, v)); },
    get bgmEnabled() { return enabled; },
    // BGM のオン／オフ。オンにしたときに曲を流すかどうかは呼び出し側が決める
    toggleBgm() {
      enabled = !enabled;
      I18N.store.set('bgm', enabled ? '1' : '0');
      if (!enabled) bgmStop();
      return enabled;
    },
    // 広告の表示中・アプリが裏にあるときは音を止める
    suspend() {
      suspended = true;
      Object.values(sfx).forEach((a) => { try { a.pause(); } catch (e) { /* 無視 */ } });
      if (ctx && ctx.state === 'running') ctx.suspend();
    },
    resume() {
      suspended = false;
      if (ctx && ctx.state === 'suspended') ctx.resume();
    }
  };
})();
