// 音：効果音（mp3）と BGM（Web Audio で太鼓・篠笛・鉦を合成）。
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

  // 都節音階（D・E♭・G・A・B♭）の旋律。数値は MIDI ノート、"-" は伸ばし、null は休符
  const _ = '-';
  const MELODY = [
    74, _, 75, 74,  70, _, 69, _,   70, 69, 67, _,  69, _, _, null,
    67, _, 69, 70,  74, _, 75, _,   79, _, 75, 74,  70, _, _, null,
    74, 75, 74, 70, 69, _, 70, 69,  67, _, 63, _,   62, _, _, null,
    62, _, 63, 67,  69, _, 70, _,   69, 67, 63, _,  62, _, _, null
  ];
  const DON = [0, 3, 4, 8, 11, 12, 14];
  const KA = [2, 6, 10];

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

  function taiko(time, vel) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(130, time);
    o.frequency.exponentialRampToValueAtTime(48, time + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.6);
    o.connect(g);
    out(g, 0.4);
    o.start(time);
    o.stop(time + 0.65);
    noiseBurst(time, 'lowpass', 380, 0.7, vel * 0.5, 0.09);
  }

  function ka(time) { noiseBurst(time, 'bandpass', 3200, 2.5, 0.35, 0.04); }

  function kane(time) {
    [1, 2.76, 5.4].forEach((ratio, i) => {
      const o = ctx.createOscillator();
      o.frequency.value = 1350 * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.05 / (i + 1), time);
      g.gain.exponentialRampToValueAtTime(0.0005, time + 0.28);
      o.connect(g);
      out(g, 0.6);
      o.start(time);
      o.stop(time + 0.3);
    });
  }

  function fue(midi, time, dur) {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(0.13, time + 0.04);
    env.gain.setValueAtTime(0.13, time + dur * 0.8);
    env.gain.linearRampToValueAtTime(0, time + dur * 0.98);
    out(env, 0.9);

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.5;
    [['sine', 1, 1], ['triangle', 2, 0.12]].forEach(([type, mul, level]) => {
      const o = ctx.createOscillator();
      o.type = type;
      // 「しゃくり」：少し下から音程に入る
      o.frequency.setValueAtTime(f * mul * 0.965, time);
      o.frequency.linearRampToValueAtTime(f * mul, time + 0.07);
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(0, time);
      depth.gain.linearRampToValueAtTime(f * mul * 0.012, time + Math.min(dur, 0.4));
      lfo.connect(depth).connect(o.frequency);
      const lv = ctx.createGain();
      lv.gain.value = level;
      o.connect(lv).connect(env);
      o.start(time);
      o.stop(time + dur + 0.05);
    });
    lfo.start(time);
    lfo.stop(time + dur + 0.05);

    // 息の音
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 6;
    const bg = ctx.createGain();
    bg.gain.value = 0.25;
    src.connect(bp).connect(bg).connect(env);
    src.start(time);
    src.stop(time + dur + 0.05);
  }

  function playStep(i, time, beat) {
    const s16 = i % 16;
    if (DON.includes(s16)) taiko(time, s16 === 0 ? 0.9 : 0.6);
    else if (intensity > 0.6 && s16 % 2 === 0) taiko(time, 0.4);
    if (KA.includes(s16)) ka(time);
    if (intensity > 0.3 && s16 % 4 === 1) kane(time);

    const note = MELODY[i];
    if (typeof note === 'number') {
      let len = 1;
      while (MELODY[(i + len) % MELODY.length] === _) len++;
      fue(note, time, len * beat);
    }
  }

  function scheduler() {
    while (nextTime < ctx.currentTime + 0.15) {
      const beat = 60 / (100 + intensity * 60) / 2; // 8分音符の長さ（炎上が進むほど速く）
      playStep(step, nextTime, beat);
      nextTime += beat;
      step = (step + 1) % MELODY.length;
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
