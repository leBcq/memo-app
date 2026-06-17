# Freavia — 開発ログ

> **Freavia** は、幾何学的なダークテーマを纏った自分専用の最強アウトライナー／ナレッジベース。  
> Next.js 16 (Turbopack) + React + Zustand + Supabase で構築。

---

## プロジェクト概要

| 項目 | 内容 |
|---|---|
| フレームワーク | Next.js 16.2.6 (Turbopack), React |
| 状態管理 | Zustand, useMemos フック (localStorage + Supabase 同期) |
| スタイリング | Tailwind CSS v4 (ダークテーマ固定) |
| DB / Auth | Supabase (PostgreSQL + Row Level Security) |
| ビルド環境 | Windows 11 / PowerShell, `NODE_OPTIONS=--max-old-space-size=4096` |

---

## アップデート履歴

---

### 2026-06-17 — クリップボード干渉バグ修正（Ctrl+V / Win+V / テキスト選択コピー）

**種別**: バグ修正（重篤）

#### 修正した内容

| # | 現象 | 修正内容 |
|---|---|---|
| 1 | 一度ノードをコピーすると `_nodeClipboard` が残り続け、Win+V や別アプリからのテキストペーストが常にノード貼り付けに上書きされる | `onPaste` に `active?.isContentEditable` ガードを追加。contenteditable がフォーカス中は構造ペーストを完全スキップし、ネイティブテキストペーストにフォールスルー |
| 2 | コンテキストメニューから「コピー」「切り取り」すると、テキストを部分選択していてもノード全体が操作される | `handleContextMenuCopy` / `handleContextMenuCut` の冒頭に `window.getSelection()?.toString()` チェックを追加。テキスト選択中は `document.execCommand("copy"/"cut")` で選択テキストのみを操作し早期リターン |

#### 変更ファイル

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `src/app/page.tsx` | 修正 | `onPaste`: `document.activeElement?.isContentEditable` が true の場合は即 return（Win+V・クロスアプリペースト・通常テキスト編集を完全保護）。`handleContextMenuCopy`/`handleContextMenuCut`: テキスト選択中は `document.execCommand` でブラウザ標準動作を実行して return、選択なしの場合のみ階層コピペ処理へ進む |

#### 設計上の重要な判断

- **構造ペーストの発動条件を厳格化**: `_nodeClipboard` にデータがあっても、contenteditable がアクティブな場合はネイティブペーストを一切妨害しない。構造ペーストが発動するのは「ブロック選択モード中」や「ノードからフォーカスが外れた状態」のみ。
- **コンテキストメニューの `onMouseDown` と連携**: NodeContextMenu は `onMouseDown` で `e.preventDefault()` を呼ぶことでボタンクリック時もブラウザのテキスト選択を保持する。この仕様を利用し、コピーボタンクリック時点で `window.getSelection().toString()` が選択テキストを返す。

#### ビルド確認

```
npx tsc --noEmit  → 出力なし（エラーゼロ）
npm run build     → ✓ Compiled successfully
```

---

### 2026-06-15 — コンテキストメニューUIバグ修正・Ctrl+C/V 階層コピペ完全対応

**種別**: バグ修正

#### 修正した内容

| # | 内容 | 種別 |
|---|---|---|
| 1 | コンテキストメニューの「カードを追加」「表を追加」が絵文字アイコン二重表示になっていたバグを修正 | バグ修正 |
| 2 | Ctrl+C / Ctrl+X がブロック選択なし（単一フォーカスノード）でも階層コピー・カットできるよう修正 | バグ修正 |
| 3 | Ctrl+V（paste イベント）が完全に未実装だったため、内部クリップボードからの階層ペーストを追加 | バグ修正 |

#### 変更ファイル

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `src/i18n/messages.ts` | 修正 | `ctx.addCard`・`ctx.addTable` のEN/JA翻訳文から絵文字プレフィックスを削除（絵文字は `NodeContextMenu` の `icon` prop 側で一元管理） |
| `src/app/page.tsx` | 修正 | `onCopy`/`onCut`: `selectedIds` が空の場合も `activeId`（フォーカス中ノード）にフォールバックして階層コピー実行。`onPaste`: `document.addEventListener("paste", ...)` を新規追加。`pasteNodesAfter(activeId)` が `true` を返した場合のみ `preventDefault()` し、`_nodeClipboard` が空の場合はブラウザ標準テキストペーストにフォールスルー |

#### 設計上の重要な判断

- **Ctrl+V フォールスルー設計**: 内部クリップボード (`_nodeClipboard`) が空の場合は `pasteNodesAfter` が `false` を返すため `preventDefault()` を呼ばない。これにより、階層データがない場合はブラウザのネイティブテキストペーストが通常通り動作する。
- **絵文字の二重管理を排除**: i18nメッセージ文字列に絵文字を含めるとコンポーネント側の `icon` prop と重複する。絵文字はUI層（`NodeContextMenu.tsx` の `icon` prop）のみで管理し、翻訳文は純粋なラベル文字列とする。

#### ビルド確認

```
npx tsc --noEmit  → 出力なし（エラーゼロ）
npm run build     → ✓ Compiled successfully
```

---

### 2026-06-11 — アウトライナー操作性の強化（階層コピペ・複数選択Cut修正）

**種別**: バグ修正 / 新機能

#### 修正・実装した内容

| # | 内容 | 種別 |
|---|---|---|
| 1 | 階層構造（子・孫ノード）を含む構造コピペ機能の実装 | 新機能 |
| 2 | Ctrl複数選択時の切り取り（Cut）が1ノードしか削除されないバグを修正 | バグ修正 |
| 3 | 複数選択ノードをペースト時に文頭に余分なスペースが入るバグを修正 | バグ修正 |
| 4 | 右クリックメニュー（コンテキストメニュー）に「コピー」「切り取り」「貼り付け」ボタンを追加 | 新機能 |

#### 変更ファイル

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `src/hooks/useMemos.ts` | 修正 | モジュールレベル内部クリップボード `_nodeClipboard` を追加。`collectSelectionRoots`・`cloneTreeWithFreshIds` ヘルパーを追加。`storeSelectedToClipboard`・`deleteSelectedNodes`・`pasteNodesAfter` 関数を追加。`insertSiblingWithPlainTextAfter` で各行を `trimStart()` するよう修正 |
| `src/app/page.tsx` | 修正 | `collectSelectedText` を深さ正規化（最小深さ=0）+ 各行 `.trim()` に改修。desktop `onCopy` イベントを構造クリップボード対応に更新。desktop `onCut` イベントハンドラを新規追加（これまで未実装）。モバイルのコピー/カット/ペーストを構造クリップボード優先ロジックに更新。`handleContextMenuCopy`・`handleContextMenuCut`・`handleContextMenuPaste` を追加し `NodeList` へ配線 |
| `src/i18n/messages.ts` | 修正 | `ctx.copy`, `ctx.cut`, `ctx.paste` を EN/JA 両方に追加 |
| `src/components/Editor/NodeContextMenu.tsx` | 修正 | `onCopyNode`・`onCutNode`・`onPasteNode` props 追加。STRUCTURE セクション末尾にクリップボードアクションバーを追加（📋/✂️/📥 ボタン） |
| `src/components/Editor/NoteNode.tsx` | 修正 | `onCopyNode`・`onCutNode`・`onPasteNode` props 追加。NodeContextMenu・子ノードへ伝達 |
| `src/components/Editor/NodeList.tsx` | 修正 | 同 props を追加・伝達 |

#### 設計上の重要な判断

- **内部クリップボード (`_nodeClipboard`)**: モジュールレベル変数に `NoteNode[]`（サブツリーごと）を保持。ページリロードで消えるが、通常操作では問題なし。Zustand store にしないのは、ペーストが Undo/Redo と干渉しないよう管理を明示的に分離するため。
- **構造ペーストのID採番**: `cloneTreeWithFreshIds` で全ノードに `makeId()` による新 ID を割り当て、重複を防止。
- **深さ正規化**: `collectSelectedText` は選択ノードの最小深さを 0 にリマップするため、選択がどの階層から始まっても文頭タブが入らない。
- **desktop Cut 追加**: これまで `onCopy` イベントのみ補足していたため、`Ctrl+X` は単一フォーカスノードの native cut しか動作しなかった。`onCut` ハンドラを追加し選択全ノードを一括削除するよう修正。
- **モバイルペースト**: 内部クリップボードが空の場合のみ `navigator.clipboard.readText()` で外部テキストにフォールバック。

#### ビルド確認

```
npx tsc --noEmit  → 出力なし（エラーゼロ）
npm run build     → ✓ Compiled successfully in 2.7s
```

---

### 2026-06-10 — ループ型チェックリスト機能の実装

**種別**: 新機能

#### 概要

チェックリストノードに自動リセット間隔（1時間 / 1日）を設定できる機能を実装。  
設定した時間が経過すると `completed` が自動的に `false` にリセットされ、繰り返しタスクに活用できる。

#### 変更ファイル

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `src/types/note.ts` | 修正 | `ResetInterval` 型（`"none" \| "1hour" \| "1day"`）追加。`NoteNode` に `resetInterval?` / `checkedAt` フィールド追加。`createNode` / `normalizeNode` / `cloneNoteTreeForPersistence` を対応 |
| `src/i18n/messages.ts` | 修正 | `ctx.autoReset`, `ctx.autoResetOff`, `ctx.autoReset1h`, `ctx.autoReset1d` を EN/JA 両方に追加 |
| `src/hooks/useMemos.ts` | 修正 | `toggleCompleted` を更新して `checkedAt` をセット。`setResetInterval` 関数追加。`resetExpiredTasks` 関数追加（`setMemos` 直接呼び出しで Undo 履歴を汚染しない）。60秒間隔の定期実行 `useEffect` 追加 |
| `src/components/Editor/NodeContextMenu.tsx` | 修正 | `onSetResetInterval` prop 追加。TASK セクション末尾にリセット間隔セレクタ UI 追加（OFF / 1h / 1d の 3 ボタン） |
| `src/components/Editor/NoteNode.tsx` | 修正 | `onSetResetInterval` prop 追加。チェックボックス横に 🔄 インジケーター追加、子ノードへ props を伝達 |
| `src/components/Editor/NodeList.tsx` | 修正 | `onSetResetInterval` prop を追加・伝達 |
| `src/app/page.tsx` | 修正 | `setResetInterval` を `useMemos` から destructure し `NodeList` へ渡す |

#### データスキーマ

```typescript
export type ResetInterval = "none" | "1hour" | "1day";

// NoteNode への追加フィールド
resetInterval?: ResetInterval;  // undefined / "none" はリセットなし
checkedAt: string | null;       // ISO 文字列。チェック時にセット、解除時に null
```

#### UI 仕様

- 右クリックメニュー → TASK セクション → チェックボックス ON 時のみ「🔄 自動リセット」行を表示
- 選択肢: `OFF` / `1h` / `1d`（現在の設定をハイライト）
- 定期リセット設定済みタスクのチェックボックス横に 🔄 を表示

#### リセットロジック

- `resetExpiredTasks` はアプリ起動時（`isHydrated` 直後）と 60 秒間隔で実行
- `completed === true` かつ `resetInterval` 設定済みかつ `checkedAt` から指定時間経過した場合のみリセット
- `setMemos` 直接呼び出し（`updateActiveNodes` を経由しない）で Undo 履歴を汚染しない

#### ビルド確認

```
npx tsc --noEmit  → 出力なし（エラーゼロ）
npm run build     → ✓ Compiled successfully in 5.2s
```

---

### 2026-06-10 — 汎用テーブル（表）機能の実装

**種別**: 新機能

#### 概要

ノード単位でスプレッドシート型テーブルをアタッチできる機能を実装。  
既存のテキストエディタ・カーソル挙動に一切干渉しない独立コンポーネント設計。

#### 変更ファイル

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `src/types/note.ts` | 修正 | `TableColumn`, `TableRow`, `TableData` 型追加。`NoteNode.tableData?` フィールド追加。`normalizeTableData()` 追加。`createNode` / `normalizeNode` / `cloneNoteTreeForPersistence` を対応 |
| `src/i18n/messages.ts` | 修正 | `ctx.addTable`, `table.badge`, `table.removeTable`, `table.removeTableConfirm`, `table.addColumn`, `table.addRow`, `table.colPh` を EN/JA 両方に追加 |
| `src/components/Editor/TableNodeCard.tsx` | 新規 | テーブル UI コンポーネント。列追加・名前変更・削除、行追加・削除、セル編集、削除確認ダイアログ、ダークテーマ対応 |
| `src/hooks/useMemos.ts` | 修正 | `addTableToNode`, `removeTable`, `addTableColumn`, `renameTableColumn`, `removeTableColumn`, `addTableRow`, `removeTableRow`, `patchTableCell` の 8 CRUD 関数を追加 |
| `src/components/Editor/NodeContextMenu.tsx` | 修正 | `onAddTable` prop 追加。NODE セクションに「📊 表を追加」メニュー項目を追加（テーブル未付与時のみ表示） |
| `src/components/Editor/NoteNode.tsx` | 修正 | テーブル 8 props 追加、`TableNodeCard` をノート欄の下にマウント、子ノードへ props を伝達 |
| `src/components/Editor/NodeList.tsx` | 修正 | テーブル props を NodeList → NoteNode へフル配線 |
| `src/app/page.tsx` | 修正 | `useMemos` からテーブル関数を destructure し `NodeList` へ渡す |

#### データスキーマ

```typescript
interface TableColumn { id: string; label: string; }
interface TableRow    { id: string; cells: Record<string, string>; }
interface TableData   { columns: TableColumn[]; rows: TableRow[]; }

// NoteNode への追加フィールド
tableData?: TableData;  // cardData / pluginData / gameData と独立して共存可能
```

#### UI 仕様

- テーブルはノード本文・ノート欄の **下部**に独立マウント（`CustomNodeCard` と同アーキテクチャ）
- 列ヘッダーはインライン編集可能（`<input>`）
- セルは `onChange` でリアルタイム更新、`onBlur` で `"immediate"` 履歴コミット
- テーブル削除は確認ダイアログ付き（誤操作防止）
- 右クリックメニュー → NODE セクション → 「📊 表を追加」でアタッチ
- `readOnly` モード（共有閲覧者）では全編集 UI が非表示

#### ビルド確認

```
npx tsc --noEmit  → 出力なし（エラーゼロ）
npm run build     → ✓ Compiled successfully in 3.0s
```

---

### 2026-06-08〜09 — エディタ致命的バグ修正 6件

**種別**: バグ修正

#### 修正したバグ

| # | バグ内容 | 根本原因 | 修正内容 |
|---|---|---|---|
| 1 | Glossary オーバーレイの ON/OFF トグルが効かない（常に生テキスト表示） | `g` フラグ付き module-level 正規表現の `lastIndex` 競合 + SSR 時の `localStorage` 読み取り | `GlossaryOverlay.tsx`: 呼び出しごとに `new RegExp()` を生成。`glossaryStore.ts`: `"use client"` 追加・SSR セーフ初期化 |
| 2 | ペーストがカーソル位置ではなくテキスト先頭に入る | `savedSelectionRef` が DOM ノード参照を保存 → `el.innerHTML` 書き換えで参照が無効化 | `NoteNode.tsx`: キャレット保存をキャラクタオフセット整数に変更（`getCaretCharOffset` / `setCaretToOffset`） |
| 3 | 文章途中で Enter を押すと後半テキストが消える | 同上（DOM 参照無効化） | Enter ハンドラを `Range.extractContents()` ベースに書き換え。`splitNode` 関数を `useMemos.ts` に追加 |
| 4 | Shift+Tab でノードが消える | `unindentNode` のアルゴリズム調査→明確な再現条件が見つからず | 保留（不定期発生・低優先度） |
| 5 | 長い単語が container からはみ出す | `break-words` では word boundary のない文字列に非対応 | エディタ div と GlossaryOverlay に `[overflow-wrap:anywhere]` (Tailwind 任意値) を追加 |
| 6 | ビルド確認 | — | `npx tsc --noEmit` エラーゼロ、`npm run build` 成功を確認 |

#### 主要変更ファイル

- `src/components/Editor/GlossaryOverlay.tsx` — 正規表現の共有状態バグ修正
- `src/stores/glossaryStore.ts` — `"use client"` + SSR セーフ初期化
- `src/components/Editor/NoteNode.tsx` — キャレット保存方式の変更、Enter キー split ロジック
- `src/hooks/useMemos.ts` — `splitNode` 関数追加

---

### 2026-06-08 — インライン用語解説（Glossary）オーバーレイ 実装

**種別**: 新機能

#### 概要

`[[単語:解説]]` 記法でノード本文に用語定義を埋め込み、非フォーカス時にインタラクティブなオーバーレイとして表示する機能。

#### 仕様

| 項目 | 内容 |
|---|---|
| 記法 | `[[単語:解説]]` （コロンは半角 `:` / 全角 `：` / パイプ `\|` に対応） |
| 表示条件 | エディタが非フォーカス状態 かつ 用語パターンが存在する場合 |
| オーバーレイ | ホバーでツールチップ表示（用語説明）、クリックで編集モード復帰 |
| ON/OFF | コンテキストメニュー → NODE → 「📖 用語解説オーバーレイ」トグル |
| 永続化 | `localStorage` (`freavia-glossary-enabled`) に状態保存 |

#### 変更ファイル

- `src/components/Editor/GlossaryOverlay.tsx` — オーバーレイ本体
- `src/stores/glossaryStore.ts` — Zustand ストア（ON/OFF 状態管理）
- `src/components/Editor/NoteNode.tsx` — マウント・表示条件
- `src/components/Editor/NodeContextMenu.tsx` — トグル UI 追加

---

### 過去の主要実装（詳細記録以前）

#### UI / UX ブラッシュアップ

- **スクロールバーのカスタム**: 極細化（幅 4px）、ダークテーマ対応カラー
- **サイドバー境界線の z-index 修正**: コンテキストメニュー等の重なり問題を解決
- **コンテキストメニューのアコーディオン化**: 各セクション（STRUCTURE / TASK / NODE / TEXT / STYLE）をアコーディオン形式で折りたたみ可能に。文字色を明るくし視認性向上
- **カラーパレットの整理**: 不要なプリセットカラーを非表示

#### コア機能（既存）

- **アウトライン編集**: ノードの追加・削除・インデント・アンインデント、ドラッグ並び替え
- **ノードタイプ**: 標準テキスト / プラグインカード / ゲーム仕様カード / カスタムカード
- **テーマシステム**: ノード行ごとの背景色・見出しレベル・チェックボックス対応
- **画像アタッチ**: ドラッグ&ドロップ / クリップボードペースト → Supabase Storage アップロード
- **フォーカスモード**: 特定ノードにズームイン（パンくずリスト付き）
- **多言語対応**: 日本語・英語の切り替え（`src/i18n/messages.ts`）
- **クラウド同期**: Supabase Auth + PostgreSQL によるリアルタイム同期
- **履歴管理**: Undo / Redo（ワークスペーススナップショット方式）
- **バックアップ**: JSON エクスポート / インポート

---

## 今後の実装候補

> このセクションは随時更新する。

- [ ] モバイル UX のさらなる改善（フローティングツールバー）
- [ ] テーブルのドラッグ＆ドロップによる列・行の並び替え
- [ ] Glossary オーバーレイのホバーアニメーション改善
- [ ] Shift+Tab ノード消失バグの根本原因特定と修正

---

*最終更新: 2026-06-10 (ループ型チェックリスト追加)*
