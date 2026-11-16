// 日本語 / 英語の文言。端末の言語が日本語なら日本語、それ以外は英語で始め、選んだ言語は保存する
window.I18N = (() => {
  const STR = {
    ja: {
      'title': '本能寺の変モグラ叩き',
      'loading': '読み込み中…',
      'tagline': '天正十年六月二日 ―― 敵は本能寺にあり。<br>光秀と黒幕を叩け！ ただし白い浴衣の御屋形様には触れるべからず',
      'best': 'ベスト戦功',
      'btn.play': '出陣',
      'btn.howto': 'あそびかた',
      'btn.title': 'タイトルへ',
      'btn.resume': '再開',
      'btn.retry': 'もう一度、本能寺へ',
      'btn.share': '📤 結果をシェア',
      'btn.pause': '⏸ 一時停止',
      'bgm.on': '♪ BGM 入',
      'bgm.off': '♪ BGM 切',
      'lang.btn': 'English',
      'hud.score': '戦功',
      'hud.time': '残り時間',
      'hud.combo': '連撃',
      'hud.fire': '本能寺の炎上',
      'howto.title': 'あそびかた',
      'howto.rules':
        '<li>穴から出てくる人物をタップして叩きます。制限時間は 30 秒。</li>' +
        '<li>明智光秀と、本能寺の変の「黒幕」と噂される人物を叩くと戦功が上がります。</li>' +
        '<li>続けて叩くと連撃ボーナス（5 連撃で +1、10 連撃で +2）。逃がすと連撃は途切れます。</li>' +
        '<li>時間がたつほど本能寺の炎が強まり、人物の出入りも速くなります。</li>' +
        '<li><b>白い浴衣の信長を叩くと、その場で終わり</b>です。</li>',
      'howto.rewind': '（アプリ版）信長を叩いてしまったら、広告を見て叩く前に戻せます（1 ゲーム 1 回）。',
      'howto.ok': '叩く',
      'howto.ng': '叩くな',
      'howto.gameover': '即終了',
      'pause.title': '一時停止',
      'pop.lord': '無礼者！',
      'pop.ranmaru': '蘭丸！？',
      'redo.title': '御屋形様を討ってしまった…',
      'redo.note': '広告を見ると、信長を叩く前まで時を戻して続けられます（1 ゲーム 1 回）。',
      'redo.watch': '▶ 広告を見て時を戻す',
      'redo.loading': '広告を読み込み中…',
      'redo.fail': '広告を読み込めませんでした',
      'redo.next': '結果を見る（{s}）',
      'result.score': '戦功',
      'result.best': 'ベスト {n}',
      'result.newBest': '★ 新記録！',
      'result.redo': '時戻し {n} 回',
      'legal.privacy': 'プライバシーポリシー',
      'legal.adPrivacy': '広告の設定',
      'url.privacy': 'https://techgym.jp/privacy-policy/',
      'share.title': '本能寺の変モグラ叩き',
      'share.dialog': '結果をシェア',
      'share.text': '「本能寺の変モグラ叩き」で戦功 {score} 点！ 称号「{rank}」{redo}',
      'share.redo': '（時戻し {n} 回）',
      'share.copied': 'コピーしました',
      'chars': {
        hideyoshi:  { name: '羽柴秀吉',     label: '秀吉',   short: '秀吉',   cry: '秀吉黒幕説！' },
        ieyasu:     { name: '徳川家康',     label: '家康',   short: '家康',   cry: '家康黒幕説！' },
        yoshiaki:   { name: '足利義昭',     label: '義昭',   short: '義昭',   cry: '足利義昭黒幕説！' },
        kuge:       { name: '朝廷の公家',   label: '公家',   short: '公家',   cry: '朝廷黒幕説！' },
        missionary: { name: 'イエズス会の宣教師', label: '宣教師', short: '宣教師', cry: 'イエズス会黒幕説！' },
        sohei:      { name: '比叡山の僧侶', label: '僧侶',   short: '僧侶',   cry: '比叡山黒幕説！' },
        mitsuhide:  { name: '明智光秀',     label: '光秀',   short: '光秀',   cry: '討ち取ったり！' },
        ranmaru:    { name: '森蘭丸（味方）', label: '味方', short: '蘭丸' },
        nobunaga:   { name: '白い浴衣の信長', label: '信長', short: '信長' }
      },
      'ranks': [
        { min: 90, title: '天下布武', quote: '光秀も黒幕もことごとく退け、信長は生き延びた。歴史が変わる――！' },
        { min: 60, title: '本能寺脱出', quote: '炎の中を斬り抜け、辛くも安土へ落ち延びた。' },
        { min: 30, title: '奮戦及ばず', quote: '「是非に及ばず」……それでも最後まで槍を振るった。' },
        { min: 0,  title: '是非に及ばず', quote: '本能寺は炎に包まれた。人間五十年、下天の内をくらぶれば……' }
      ],
      'lordRank': { title: '主君討ち', quote: '白い浴衣の御屋形様を討ってしまった……。これでは明智勢と変わらぬ。' },
      'stats': (list, ranmaru, maxCombo) => `${list.join('・')} ／ 蘭丸を誤って ${ranmaru} ／ 最大連撃 ${maxCombo}`
    },
    en: {
      'title': 'Honnō-ji Whack-a-Mole',
      'loading': 'Loading…',
      'tagline': 'June 21, 1582 — “The enemy is at Honnō-ji!”<br>Whack Mitsuhide and the masterminds! But never touch your lord in the white robe.',
      'best': 'Best merit',
      'btn.play': 'Charge!',
      'btn.howto': 'How to play',
      'btn.title': 'Title',
      'btn.resume': 'Resume',
      'btn.retry': 'Back to Honnō-ji',
      'btn.share': '📤 Share result',
      'btn.pause': '⏸ Pause',
      'bgm.on': '♪ Music On',
      'bgm.off': '♪ Music Off',
      'lang.btn': '日本語',
      'hud.score': 'Merit',
      'hud.time': 'Time',
      'hud.combo': 'Combo',
      'hud.fire': 'Honnō-ji is burning',
      'howto.title': 'How to play',
      'howto.rules':
        '<li>Tap the figures popping out of the holes. You have 30 seconds.</li>' +
        '<li>Whack Akechi Mitsuhide and the rumored “masterminds” of the Honnō-ji Incident to earn merit.</li>' +
        '<li>Hit in a row for a combo bonus (+1 at 5, +2 at 10). Letting one escape breaks the combo.</li>' +
        '<li>As time passes the fire grows and the figures move faster.</li>' +
        '<li><b>Whack Nobunaga in the white robe and it is over</b> on the spot.</li>',
      'howto.rewind': '(App version) If you hit Nobunaga, you can watch an ad to rewind to just before it (once per game).',
      'howto.ok': 'Whack',
      'howto.ng': 'Don’t',
      'howto.gameover': 'Game over',
      'pause.title': 'Paused',
      'pop.lord': 'How dare you!',
      'pop.ranmaru': 'Ranmaru?!',
      'redo.title': 'You struck your own lord…',
      'redo.note': 'Watch an ad to rewind time to just before you hit Nobunaga and keep playing (once per game).',
      'redo.watch': '▶ Watch an ad to rewind',
      'redo.loading': 'Loading ad…',
      'redo.fail': 'Could not load an ad',
      'redo.next': 'See results ({s})',
      'result.score': 'Merit',
      'result.best': 'Best {n}',
      'result.newBest': '★ New record!',
      'result.redo': 'Rewinds used: {n}',
      'legal.privacy': 'Privacy Policy',
      'legal.adPrivacy': 'Ad settings',
      'url.privacy': 'https://techgym.jp/privacy-policy-en/',
      'share.title': 'Honnō-ji Whack-a-Mole',
      'share.dialog': 'Share result',
      'share.text': 'I earned {score} merit in “Honnō-ji Whack-a-Mole”! Rank: “{rank}”{redo}',
      'share.redo': ' (rewinds used: {n})',
      'share.copied': 'Copied',
      'chars': {
        hideyoshi:  { name: 'Hashiba Hideyoshi', label: 'Hideyoshi', short: 'Hideyoshi', cry: 'Hideyoshi did it!' },
        ieyasu:     { name: 'Tokugawa Ieyasu',   label: 'Ieyasu',    short: 'Ieyasu',    cry: 'Ieyasu did it!' },
        yoshiaki:   { name: 'Ashikaga Yoshiaki', label: 'Yoshiaki',  short: 'Yoshiaki',  cry: 'The Shogun did it!' },
        kuge:       { name: 'Imperial court noble', label: 'Noble',  short: 'Noble',     cry: 'The Court did it!' },
        missionary: { name: 'Jesuit missionary', label: 'Jesuit',    short: 'Jesuit',    cry: 'The Jesuits did it!' },
        sohei:      { name: 'Mt. Hiei monk',     label: 'Monk',      short: 'Monk',      cry: 'Mt. Hiei did it!' },
        mitsuhide:  { name: 'Akechi Mitsuhide',  label: 'Mitsuhide', short: 'Mitsuhide', cry: 'Got him!' },
        ranmaru:    { name: 'Mori Ranmaru (ally)', label: 'Ally',    short: 'Ranmaru' },
        nobunaga:   { name: 'Nobunaga in white robe', label: 'Nobunaga', short: 'Nobunaga' }
      },
      'ranks': [
        { min: 90, title: 'Master of the Realm', quote: 'You repelled Mitsuhide and every mastermind. Nobunaga lives — history is rewritten!' },
        { min: 60, title: 'Escaped Honnō-ji', quote: 'You cut through the flames and barely made it back to Azuchi.' },
        { min: 30, title: 'Valiant to the End', quote: '“It cannot be helped…” Yet you fought on to the very last.' },
        { min: 0,  title: 'It Cannot Be Helped', quote: 'Honnō-ji is engulfed in flames. “Fifty years of human life, compared with the heavens, are but a dream…”' }
      ],
      'lordRank': { title: 'Lord Slayer', quote: 'You struck down your own lord in his white robe… You are no better than the Akechi.' },
      'stats': (list, ranmaru, maxCombo) => `${list.join(', ')} / Ranmaru hit by mistake: ${ranmaru} / Max combo: ${maxCombo}`
    }
  };

  const store = {
    get(key, fallback) { try { return localStorage.getItem('honnoji-' + key) ?? fallback; } catch (e) { return fallback; } },
    set(key, value) { try { localStorage.setItem('honnoji-' + key, value); } catch (e) { /* 保存できなくても遊べる */ } }
  };

  let lang = store.get('lang', (navigator.language || 'ja').toLowerCase().startsWith('ja') ? 'ja' : 'en');
  if (!STR[lang]) lang = 'ja';
  const listeners = [];

  // {name} を vars の値で置き換える
  function t(key, vars) {
    let s = STR[lang][key];
    if (typeof s === 'string' && vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : ''));
    return s;
  }

  function apply() {
    document.documentElement.lang = lang;
    document.title = t('title');
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
    document.querySelectorAll('[data-i18n-href]').forEach((el) => { el.href = t(el.dataset.i18nHref); });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  }

  function setLang(next) {
    if (!STR[next] || next === lang) return;
    lang = next;
    store.set('lang', lang);
    apply();
    listeners.forEach((fn) => fn(lang));
  }

  return {
    t,
    apply,
    setLang,
    store,
    get lang() { return lang; },
    toggle() { setLang(lang === 'ja' ? 'en' : 'ja'); },
    onChange(fn) { listeners.push(fn); }
  };
})();
