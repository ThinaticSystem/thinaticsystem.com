# 修正前の要件とテストの対応記録

この文書は、修正前の実装でどの要件が満たされていなかったかを、対応するテストとともに残した履歴。
既存の不具合を未修正として登録した当時の比較元（baseline）に対する評価で、
現在も同じ項目が失敗するという意味ではない。

表には、失敗した要件に加え、その時点で確認できた動作と未検証の範囲を載せる。
PASSは、名前を挙げた動作を再現可能なテストデータで検査したことだけを示す。
実CMS、本番Cloudflare、人手による表示確認、スクリーンリーダーの受け入れ確認まで完了したとは扱わない。

## 当時の結果と検証範囲

| 要件・境界 | 実行可能な証拠 | 当時の結果と範囲 |
| --- | --- | --- |
| Blogの空レスポンス | `src/app/blog/index/index.component.spec.ts` | PASS: 再現可能な空の一覧・件数データを使い、コンポーネントに描画された状態まで確認 |
| BlogのHTTP失敗 | `src/known-defects/requirements.debt.spec.ts` (`blog-http-error-loading`) | DEBT FAIL: 実際のHTTPエラーで読み込み中の表示が残り、回復可能な失敗状態がなかった。既存の未修正不具合として保持 |
| Blogの同時ページ変更 | `src/known-defects/requirements.debt.spec.ts` (`blog-concurrent-page-order`) | DEBT FAIL: 遅れて届いた古いレスポンスが最新ページを上書きした。既存の未修正不具合として保持 |
| Articleのルートパラメーター変更 | `src/known-defects/requirements.debt.spec.ts` (`article-route-parameter-transition`) | DEBT FAIL: baselineは初期スナップショットしか読まなかった。既存の未修正不具合として保持 |
| Articleの404と500 | `src/app/blog/article/article.component.spec.ts` と `src/known-defects/requirements.debt.spec.ts` | PARTIAL: 再現可能なテストデータで404のリダイレクトと500の非リダイレクトを確認。404のエラー経路では読み込み中の状態を解除できず、未修正不具合が残った |
| Article/tagの入れ子ナビゲーション | `src/known-defects/blog-card.nested-anchor.spec.ts` | REGISTERED FAIL: 両方の意味上の遷移先とキーボード操作でのフォーカス停止位置を検証。既存のアンカー要素の入れ子の不具合は意図的に未修正のまま保持 |
| Markdown/HTMLの実行可能コンテンツ | `src/app/pipes/sanitize-html.pipe.spec.ts` と `src/known-defects/requirements.debt.spec.ts` | PARTIAL: 正当なiframe/HTMLの保持テストは成功。安全でないコンテンツはセキュリティレビュー対象の失敗として登録したままで、修正済みとは扱わなかった |
| Clipboardの拒否 | `src/app/components/share/share.component.spec.ts` | PASS: コピー拒否を模した限定的なrejected-copyイベントで、成功通知を呼ばない契約を確認。実ブラウザの拒否経路とエラーメッセージ方針は未定義だった |
| 通知の寿命 | `src/known-defects/requirements.debt.spec.ts` (`notification-replacement-lifetime`) | DEBT FAIL: 最初のタイマーが差し替え後の通知を早く隠した。既存の未修正不具合として保持 |
| Discographyの画像失敗・空結果 | `src/known-defects/requirements.debt.spec.ts` | DEBT FAIL: baselineはloadイベントだけを待ち、0件やimage-error時に読み込み中の状態を終了できなかった。既存の未修正不具合として保持 |
| 日付境界の意味 | `src/app/components/blog-card/blog-card.component.spec.ts` | PASS: 実行環境のタイムゾーン解釈を明示し、安定したUTC時点で確認。タイムゾーン方針の変更には新たな判断が必要 |
| iframeの許可リスト方針 | `src/app/pipes/sanitize-html.pipe.spec.ts` と `src/known-defects/requirements.debt.spec.ts` | PARTIAL: 正当なiframeを保持。サービス別の許可リスト方針は未定義で、安全性確認を省略する処理はセキュリティレビュー対象の失敗のままだった |
| 実CMS / patron API | ブラウザ・配信用のスクリプトは管理下のループバック接続のテスト用データを使用 | NOT RUN: 実アカウント・データへのアクセスは意図的に対象外 |
| 表示とスクリーンリーダー操作 | Browser smokeでaxe・キーボード・フォーカスの観察を記録 | NOT RUN: 人手による表示確認と代表的なスクリーンリーダー操作は未実施 |

## 未修正の失敗を記録する仕組み

DEBT FAILは、baselineで見つかった失敗を保持した結果で、要件を満たしたという意味ではない。
修正には別途の範囲承認と、対象を絞ったアサーションを必要とする。
通常テスト群に残した自動生成テストは、Angularの接続を記録するためのもので、上表の要件を検証した証拠には使わない。

既知の不具合を検査するテスト群には、通常どおり失敗するアサーションを置き、`test/known-defects.json`で評価する。
skip/todo/failsによる判定の反転は使わない。
テストの失敗内容だけでなく、件数と終了状態も照合し、登録済みの不具合とテスト実行そのものの異常を区別する。

### reporterとadapterの照合

対応するVitest 4 reporterは、アサーションの識別情報、エラー名、発生元、ソース上の位置を構造化して出力する。
adapterはその記録を、次の条件で受け入れる。

| 確認対象 | 受け入れ条件 |
| --- | --- |
| describe階層 | 固定した階層の意味付けに従い、複数のdescribe suiteを受け付ける。アサーションの識別には`file`と各祖先suiteを使う |
| 件数 | suiteとtestのカウンターがレポートと一致する |
| 終了状態 | 子プロセスがstatus 1で終了する |

未知のアサーション識別情報、test以外を発生元とするアサーション、規定外のエラー種別、
テストランナーやセットアップのエラー、想定外のPASSは拒否する。

### 実際のテストランナーによる確認

実際のテストランナーを使う試験では、次の結果を区別できるか確認する。

- アサーション
- テスト本体のTypeError
- beforeEachのTypeError
- afterEachのTypeError
- 未処理の非同期TypeError
