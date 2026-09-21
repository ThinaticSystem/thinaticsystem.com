# 現行性能検証

`corepack pnpm run perf:current`は通常motion下の利用可能コンテンツとページ内時計を使う比較工学gateである。旧`perf:paired`/v4・historical control・functional budget v1は再現用に残し、古いFAILを上書きしない

## 実行

- Node・Corepack・歴史的baseline用Node・Cコンパイラーは既存Nix devShellまたはCI設定を使う
- `corepack pnpm run test:performance-contract`: 純粋な観測検証・判定・request所有fixture
- `corepack pnpm run test:performance-recorder`: 実Chromiumによる計測器canary
- `corepack pnpm run perf:current`: 固定historical baselineと現在のcandidateをbuildし、candidate同士のA/Aを4観測、ABBA/BAABを8観測する。raw・process終了・source/build identityを`.artifacts/performance-v2/run-*/`に残す
- `corepack pnpm run test:e2e`: 機能・accessibilityの独立gate。旧smokeの所要時間は新性能判定へ入力しない

## 意味と範囲

コンテンツ導線はdesktopのcold Home/article/作品詳細、一覧から本文/作品詳細への遷移、一覧へ戻るを対象とする。mobileは現段階ではmenu開閉のみを判定し、mobile本文表示の受入は未実装である。本文を覆う要素を待ち、操作を妨げない装飾終了は待たない。ページ内イベント→DOM/rAF観測は物理paintやfield INPではない。themeは保存値だけでなく、bodyの実computed背景/文字色と存在するaria-pressedの一致を待つ。両凍結build共通のwhite/gray-800 paletteを契約とし、色設計が変わる場合はこの限定adapterも見直す

Playwright routeによる合成CMSを使い、HTTP cacheは無効である。SPA/moduleのwarmとHTTP cache hitを区別する。CMS本文・画像はfixtureであり、実CMSや外部playerのpayload/availabilityを代表しない。viewportは実端末CPUの代用ではない

requestは開始時に所有し、終端・bodyをbounded drainで確認する。後続資源はtailへ区別する。tailはdriverによるendpoint取得後250msにdrainを加えた可変観測窓であり、ページ時刻のendpoint+250msぴったりのcutではない。このscopeを旧warm budgetへ自動継承しない。decoded bytesとwire bytesは別物であり、観測不能は0にしない。画像・CMSをcode bytesへ混ぜず、codeだけを画面全体の転送量と呼ばない

既存承認のinitial index集合と全出力JS/CSS上限を継承する。加えてbaseline/candidateの両方を同一process/compressorで集計し、未訪問lazy chunkを含む静的全出力の大幅な増分も、上限内だからという理由だけで自動合格にしない。初期index集合はcold依存閉包ではない。新しい資源scope・画像/APIの絶対上限は未確定のまま記録する

50msかつ20%、1,024Bかつ20%は事前固定する暫定的な工学的重要度filterである。利用者承認済みの絶対UX SLOでも、小さなbyte差が非ボトルネックである証明でもない。A/Aがこの幅で不安定ならINCONCLUSIVE、継続的な有意量の比較悪化はREVIEW_REQUIRED、承認済みサイズ予算超過はFAILとする。4回からp95・統計的有意性を主張しない。最速結果の選別や緑になるまでのretryはしない

`PASS_WITH_NOTES`は**この比較gateの通過**であり、絶対UX・実端末・本番配信・screen readerの全受入ではない。出力の`absoluteUxAcceptance: NOT_ESTABLISHED`を残す。source/build/profile不整合・欠落・未知error・不完全cleanupはINVALID_EVIDENCEである

## CIと旧結果

build成功を条件として機能/a11y・性能・TypeDoc・fixture配信smokeを独立実行する。性能失敗で後続docs/smokeをskipせず、各stepの失敗はjobに残す。`continue-on-error`で未知失敗を握り潰さない。raw uploadは失敗時も実行する

旧記事遷移+650BのFAILは旧ゼロ増分方針の結果として残る。新しい比較は新schema/readiness/fixtureに紐づく別観測であり、旧データの時刻を新しい測定と称して再利用しない。本番公開・Renovate有効化・default branchへの設定反映はこのgateの権限に含まれない

## メニューのmotion回帰

`node scripts/performance/verify-menu-motion.mjs --dist dist/app/browser --output .artifacts/menu-motion`でproduction buildのメニューを実Chromiumで確認する。出力先は未使用のdirectoryを指定する

標準animationの所要時間は`--animate-duration`を参照し、未指定時のみ1秒へfallbackする。app shellの既存指定0.5秒を保ち、reduced-motionでは1msを優先する。fadeの廃止、keyframeの変更、readiness条件や性能filterの緩和では解決しない

この回帰はnative animationの時間設定・opacity推移・繰返し開閉・Blog遷移を確認する。実ブラウザーのfixture検証であり、人間の見た目評価、実端末の応答性、公開配信の受入とは区別する
