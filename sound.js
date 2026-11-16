// 音：効果音（mp3）と BGM（Web Audio で尺八と三味線を合成）。
// 広告の表示中やアプリを裏に回したときは suspend() で止め、resume() で戻す
window.Sound = (() => {
  // ---- 効果音 ----
  const sfx = {};
  for (const name of ['hit', 'miss', 'start', 'end']) {
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
  let ctx = null, master, wet, noise, timer = null;
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
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

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
    wet.connect(conv).connect(master);

    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  }

  function out(node, reverb = 0.5) {
    node.connect(master);
    if (reverb) {
      const g = ctx.createGain();
      g.gain.value = reverb;
      node.connect(g).connect(wet);
    }
  }

  function noiseBurst(time, type, freq, q, gain, decay) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + decay);
    src.connect(f).connect(g);
    out(g, 0.3);
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

  function bgmStart() {
    if (!enabled || !AC || playing) return;
    if (!ctx) init();
    if (ctx.state === 'suspended' && !suspended) ctx.resume();
    playing = true;
    step = 0;
    nextTime = ctx.currentTime + 0.08;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(0.55, ctx.currentTime);
    timer = setInterval(scheduler, 25);
    scheduler();
  }

  function bgmStop() {
    if (!playing) return;
    playing = false;
    clearInterval(timer);
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
  }

  return {
    play,
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
