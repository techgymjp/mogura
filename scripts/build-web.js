// Web 版とアプリ（Android）に使うファイルを www/ にまとめる。アプリ用は APP_BUILD=1（npm run build:app）
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const item of [
  'index.html', 'style.css',
  'i18n.js', 'sound.js', 'ads.js', 'characters.js', 'scene.js', 'game.js',
  'start.mp3', 'end.mp3',
]) {
  const src = path.join(root, item);
  if (!fs.existsSync(src)) {
    console.error(`${item} が見つかりません`);
    process.exit(1);
  }
  fs.cpSync(src, path.join(out, item), { recursive: true });
}
// アプリに同梱するときは、Web 版だけの部分を取り除く。
// iOS の審査では、アプリの中で隠しているだけの機能は「審査中に隠した機能」(Guideline 5.6)と見なされるため、
// アプリには最初から入れない。目印: HTML は <!-- web-only --> … <!-- /web-only -->、
// JS は // web-only:start … // web-only:end、CSS は /* web-only:start */ … /* web-only:end */（今は使っていない）
if (process.env.APP_BUILD === '1') {
  const rules = [
    [/\.html$/, /[ \t]*<!-- web-only[\s\S]*?<!-- \/web-only -->\n?/g],
    [/\.js$/, /[ \t]*\/\/ web-only:start[\s\S]*?\/\/ web-only:end\n?/g],
    [/\.css$/, /[ \t]*\/\* web-only:start \*\/[\s\S]*?\/\* web-only:end \*\/\n?/g],
  ];
  for (const rel of fs.readdirSync(out)) {
    const rule = rules.find(([ext]) => ext.test(rel));
    if (!rule) continue;
    const file = path.join(out, rel);
    const text = fs.readFileSync(file, 'utf8').replace(rule[1], '');
    // 取り除き忘れがあれば、アプリ用のビルドを止める
    if (/web-only|play\.google\.com/.test(text)) {
      console.error(`${rel} に Web 版だけの部分が残っています`);
      process.exit(1);
    }
    fs.writeFileSync(file, text);
  }
}
// Google Play 用のビルドでは本番の広告を使う
const mode = process.env.ADMOB_MODE === 'production' ? 'production' : 'test';
fs.writeFileSync(path.join(out, 'ads-config.js'), `// ビルド時に生成\nwindow.AD_MODE = '${mode}';\n`);
// タイトル画面に出すバージョン（CI では VERSION_NAME / VERSION_CODE を使う）
const version = process.env.VERSION_CODE
  ? `v${process.env.VERSION_NAME || require('../package.json').version} (build ${process.env.VERSION_CODE})`
  : 'dev';
fs.writeFileSync(path.join(out, 'build-info.js'), `// ビルド時に生成\nwindow.APP_VERSION = '${version}';\n`);
console.log(`built web assets into www/ (${process.env.APP_BUILD === '1' ? 'app' : 'web'}, ads: ${mode}, version: ${version})`);
