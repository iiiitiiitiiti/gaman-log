# がまんログ

買うのをがまんしたもの（ペットボトル・お菓子・買い食いなど）と、むだづかいしてしまったものを記録して、節約を目で見てわかるようにするアプリです。

- 公開 URL: https://iiiitiiitiiti.github.io/gaman-log/
- iPhone では Safari で開き、共有ボタン →「ホーム画面に追加」してから使います。Safari のタブとホーム画面のアプリは保存場所が別なので、記録はホーム画面のアプリでつけてください
- 記録はその端末の中（localStorage）だけに保存されます。機種変更の前に、設定 →「ファイルに書き出す」で保管し、新しい端末で「読み込む」を使います

## 画面

- **がまん**: 今月がまんした金額と、それで買えた身近なモノ（ラーメン○杯ぶん など）を表示します
- **むだづかい**: 今月のむだづかいを警報ふうに表示し、「このままだと1年で○円消えます」と知らせます
- 両方の画面の上部に「がまん − むだづかい」の収支を出します
- 1年ペースの予測は、記録を始めて7日目から出します（直近30日、または記録を始めてからの日数で1日あたりにならして365倍）

## 開発（Mac / Windows 共通）

Node.js 22 以上が必要です。

```sh
git clone https://github.com/iiiitiiitiiti/gaman-log.git
cd gaman-log
npm ci
npm run dev          # http://localhost:5173/gaman-log/
npm run dev -- --host  # 同じ Wi-Fi の iPhone から開いて確認する
```

| コマンド | 内容 |
|---|---|
| `npm run lint` | 型チェック |
| `npm test` | 集計・保存のテスト（vitest） |
| `npm run build` | 本番ビルド（`dist/`） |

`main` へ push すると GitHub Actions が型チェック・テスト・ビルドを通してから GitHub Pages へ公開します。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `src/store.ts` | 保存・読み込み・書き出しファイルの検証と統合、既定の定番ボタン |
| `src/stats.ts` | 期間の合計・1年ペース・収支（現在時刻を引数で受ける純関数） |
| `src/equivalents.ts` | 金額を身近なモノに置き換える目安の表 |
| `src/App.tsx` | 画面全体とタブ切り替え |
| `src/styles.css` | 2つの世界観（`.app--saved` / `.app--wasted` のトークン） |

設計判断は [docs/decisions/](docs/decisions/) にあります。
