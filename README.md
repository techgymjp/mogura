# 本能寺の変モグラ叩き (Honnō-ji Whack-a-Mole)

天正十年六月二日、炎に包まれる本能寺を舞台にしたモグラ叩きのブラウザゲームです。
穴から出てくる **明智光秀** と、本能寺の変の「黒幕」と噂される人物を叩いて戦功を上げます。
ただし、**白い浴衣の信長** を叩いたらその場で終わりです。

`index.html` をブラウザで開くだけで遊べます（Web 版はビルド不要）。GitHub Pages などの静的ホスティングにそのまま置けます。
Android アプリ版もあります（下記）。

## 登場人物

| 人物 | 戦功 | 12 コマの動き |
| --- | --- | --- |
| 明智光秀 | +5 | 刀を振りかぶって斬り下ろす |
| 羽柴秀吉 | +2 | 千成瓢箪を振って跳ねる |
| 徳川家康 | +2 | 腕組みでうたた寝し、はっと目を覚ます |
| 足利義昭 | +2 | 密書を書き、左右をうかがって掲げる |
| 朝廷の公家 | +2 | 扇で口元を隠して「ほほほ」と笑い、あおぐ |
| イエズス会の宣教師 | +2 | 十字架を高く掲げて説く |
| 比叡山の僧侶 | +2 | 薙刀を回す |
| 森蘭丸（味方） | −3 | 両手を振って「味方です」と慌てる |
| 白い浴衣の信長 | 即終了 | 扇を手に敦盛を舞う |

- 人物は肖像画に寄せて描いています（月代と茶筅髷の信長、唐冠の秀吉、ふくよかな家康、侍烏帽子の光秀、立烏帽子の義昭、引眉とお歯黒の公家、裹頭の僧兵、前髪の蘭丸など）。家紋は桔梗・桐・三つ葉葵・二つ引両・木瓜
- 動きは伸び縮みではなく、ポーズを 1 コマずつ描いた **12 コマのコマ送り**（`characters.js`）。叩かれると目を回すコマに切り替わる
- 出方は 6 通り：普通・ひょっこり（一瞬だけ）・フェイント（半分顔を出して引っ込み、すぐ全身で出る）・出てきそうで出てこない・おバカ（ひょこひょこ上下しながら居座る）・二度出し。時間がたつほど意地悪な出方が増える。引っ込んでいる間に叩くと空振り
- 成敗すると斬撃と火花が走り、人物は目を回して回転しながら宙へ吹き飛ぶ（光秀は画面が光って揺れ、より高く飛ぶ）
- 信長を叩くと、穴から大きくせり上がって激怒する（赤い顔・青筋・湯気、扇を突き付けて「無礼者！」。怒りの 12 コマ）

## ルール

- 制限時間 30 秒。続けて叩くと連撃ボーナス（5 連撃で +1、10 連撃で +2）。叩くべき相手を逃がすと連撃が途切れる
- 時間がたつほど本能寺の炎が強まり、人物の出入りが速く、同時に出る数も増える
- 結果画面で戦功に応じた称号（天下布武・本能寺脱出・奮戦及ばず・是非に及ばず。信長を叩いたら「主君討ち」）
- ベスト記録はブラウザ（アプリ）に保存。結果はシェアできる（シェア文には紹介記事 https://techgym.jp/column/claude-code-game-mogura/ が入る）

## 画面と音

- 背景は入母屋造・本瓦葺の本堂（組物・垂木・格子戸・高欄・石の基壇と石段・石灯籠・築地塀・明智勢の水色桔梗の幟）。
  火事は粒子（炎・煙・火の粉）を重ねて描き、寺の奥と手前の 2 層で燃える（`scene.js`）。炎は残り時間が減るほど強くなる
- BGM は Web Audio API で合成した尺八と三味線（都節音階）。三味線ははじいた弦の合成（Karplus-Strong）と撥の音・さわり、尺八は息の音・メリからの持ち上げ・揺り。炎上が進むとテンポが上がり、三味線の手数が増える（`sound.js`）。効果音のうち、成敗（刀の「シュッ・ズバッ・キーン」。光秀は太鼓つき）・失敗（蘭丸は鼓と下がる三味線、信長は銅鑼）・空振り（「ヒュッ」と床の「コッ」）も Web Audio で合成。出陣と終了は `start.mp3` `end.mp3`
- 起動時に「読み込み中」を出し、人物の絵（`<template>` にして複製するだけにする）と音の部品・mp3 の準備を済ませてからタイトルを出す。スマホでは火事の粒子を減らし、プレイ中は背景の描画を 30 コマ／秒に落とす
- 日本語と英語に対応。端末の言語で始まり、右上のボタンで切り替え（`i18n.js`）

## Android アプリ

[Capacitor](https://capacitorjs.com/) でゲームのファイルをアプリに同梱し、Android アプリにしています（オフラインで遊べます）。
構成は techgymjp/jet-fighter の `docs/ANDROID_PORTING.md`、techgymjp/corner-kick と同じです。

- パッケージ名: `jp.techgym.mogura`
- アプリ名: ストアは「本能寺の変モグラ叩き」/「Honnoji Whack-a-Mole」、ホーム画面は「本能寺モグラ」/「Honnoji」
- 縦画面固定・全画面・プレイ中は画面を消さない
- 戻るボタン: プレイ中は一時停止（一時停止中なら再開）、あそびかたではタイトルへ、タイトル・結果画面ではアプリを終了
- 別アプリに切り替えると自動で一時停止して音を止める
- シェアは Android の共有メニュー
- 広告（AdMob）
  - バナー: タイトル画面・あそびかた・一時停止・結果画面の下中央（プレイ中は穴と重なるので出さない）
  - 全画面広告（インタースティシャル）: 「出陣」（タイトル・あそびかたから）、「タイトルへ」（あそびかた・一時停止・結果画面から）、一時停止からの「再開」、結果画面の「もう一度」のたびに毎回
  - リワード広告（チート）: 信長を叩いてしまったら「広告を見て時を戻す」（1 ゲーム 1 回。叩いた様子を見届けられるよう 2.2 秒後に出し、6 秒で自動的に結果へ）。
    最後まで見ると、信長を叩く前の戦功・連撃・残り時間に戻して続けられる。使ったことは結果画面とシェア文に「時戻し N 回」と出る
  - EU など同意が必要な地域ではタイトル画面に「広告の設定」
- タイトル画面にバージョン（ビルド番号）とプライバシーポリシーへのリンク

ビルドは GitHub Actions（`.github/workflows/android.yml`）で行います。

1. `npm ci` → `npm run build:app`（`www/` に Web ファイルをコピーし、`ads-config.js` と `build-info.js` を生成）→ `npx cap sync android` → `./gradlew assembleDebug`
2. 既定ブランチなら、Release `android-latest` の `mogura.apk` を差し替え（動作確認用・テスト広告）
   - リリース画面: https://github.com/techgymjp/mogura/releases/tag/android-latest （QR コード: `docs/apk-qr.png`）
   - APK 直接: https://github.com/techgymjp/mogura/releases/latest/download/mogura.apk

   ![リリース画面の QR コード](docs/apk-qr.png)
3. GitHub Secrets に署名鍵（`ANDROID_KEYSTORE_BASE64` / `ANDROID_KEYSTORE_PASSWORD` / `ANDROID_KEY_ALIAS` / `ANDROID_KEY_PASSWORD`）があれば、本番広告で署名付き AAB を作り Artifact に上げる

AdMob のアプリ ID は `android/app/src/main/res/values/strings.xml` の `admob_app_id`、本番の広告ユニット ID は `ads.js` の `UNITS.android.production` にあります（バナー・インタースティシャル・リワードとも登録済み）。
動作確認用 APK はどれもテスト広告、Google Play 用の AAB は本番の広告です（広告ユニット ID が空の種類は出さない）。

手元で試すとき: `npm install` → `npm run android:sync` → `npm run android:open`（Android Studio が必要）。
アイコンと起動画面は `assets/` の元画像から `npx @capacitor/assets generate --android` で生成し、起動画面は色数を減らして軽くしています。

## ファイル

| ファイル | 内容 |
| --- | --- |
| `index.html` / `style.css` | 画面（タイトル・あそびかた・プレイ・一時停止・やり直し・結果）と背景の寺 |
| `game.js` | ゲームの進行・画面の切り替え・広告を出す場面・シェア |
| `characters.js` | 人物の絵（12 コマ + やられの 1 コマ） |
| `scene.js` | 背景の火事（粒子の炎・煙・火の粉） |
| `sound.js` | 効果音と BGM |
| `i18n.js` | 日本語 / 英語の文言 |
| `ads.js` | 広告（Android アプリのときだけ動く） |
| `android/` | Android アプリのプロジェクト（Capacitor） |

## ライセンス

著作権はテックジム株式会社に帰属します（All rights reserved）。許可なく複製・改変・再配布すること、Web サイトやアプリとして公開・販売すること、名前・ロゴ・アイコン・画像を使うことを禁止します。
テックジムの受講生が学習目的で複製・改変することは許可しますが、アプリストアでの公開・広告の掲載・販売などの商用利用は禁止し、著作権表示を残してください。
詳しくは [LICENSE](LICENSE) を見てください。

## English

**Honnō-ji Whack-a-Mole** — a whack-a-mole game set in the burning Honnō-ji temple on June 21, 1582.

- Whack Akechi Mitsuhide (+5) and the rumored masterminds of the Honnō-ji Incident — Hideyoshi, Ieyasu, Shogun Yoshiaki, a court noble, a Jesuit missionary and a Mt. Hiei warrior monk (+2 each).
- Don’t hit Mori Ranmaru, Nobunaga’s page (−3), and never hit Nobunaga in his white robe — that ends the game at once.
- 30 seconds per game; the fire grows and the figures speed up as time runs out. Each figure moves with 12 hand-posed animation frames.
- Open `index.html` in a browser to play. An Android app (Capacitor) is built by GitHub Actions.
