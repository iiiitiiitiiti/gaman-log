#!/bin/bash
# Stop hook: Claude が終わろうとしたとき、試験（npm test）と本番ビルド（npm run build）を流す。
# 落ちたら exit 2 で失敗の内容を Claude へ返し、直すまで終わらせない（docs/decisions/008）。
#
# - 型チェックは build の tsc -b が兼ねるので lint は流さない
# - 前回通った状態からコードが変わっていなければ流さない（質問に答えるだけのターンで70秒待たせない）
# - 同じ失敗が2回続くか、5回止めても通らなければ、止めるのをやめてユーザーへ知らせる
# - 試験の数が減っていたら、そのことを1回だけ指摘する（消した理由は意味を読まないと判定できない）
#
# fail-open（jq・git・node_modules が無いなど判定できないときは exit 0）。

set -uo pipefail

MAX_BLOCKS=5
TEST_PATTERN='\b(it|test)(\.[a-z]+)*\('

INPUT=$(cat)
command -v jq >/dev/null 2>&1 || exit 0
SESSION_ID=$(printf '%s' "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)
[[ -z "$SESSION_ID" ]] && exit 0

cd "$(dirname "$0")/../.." || exit 0
[[ -d node_modules ]] || exit 0
GIT_DIR=$(git rev-parse --absolute-git-dir 2>/dev/null) || exit 0

STATE_DIR="$GIT_DIR/stop-verify"
mkdir -p "$STATE_DIR" 2>/dev/null || exit 0
SAFE_ID=${SESSION_ID//[^A-Za-z0-9._-]/_}
COUNT_FILE="$STATE_DIR/$SAFE_ID.count"
SIG_FILE="$STATE_DIR/$SAFE_ID.sig"
GAVEUP_FILE="$STATE_DIR/$SAFE_ID.gaveup"
WARNED_FILE="$STATE_DIR/$SAFE_ID.warned-tests"
PASS_FILE="$STATE_DIR/last-pass"

# 未追跡のファイルも含めて今の作業ツリーを tree にする（.gitignore は除く）
TMP_INDEX=$(mktemp) || exit 0
trap 'rm -f "$TMP_INDEX"' EXIT
cp "$GIT_DIR/index" "$TMP_INDEX" 2>/dev/null
GIT_INDEX_FILE="$TMP_INDEX" git add -A >/dev/null 2>&1 || exit 0
TREE=$(GIT_INDEX_FILE="$TMP_INDEX" git write-tree 2>/dev/null) || exit 0

BASE=""
if [[ -f "$PASS_FILE" ]]; then
  BASE=$(cat "$PASS_FILE")
  git cat-file -e "$BASE" 2>/dev/null || BASE=""
fi
[[ -z "$BASE" ]] && BASE=$(git rev-parse -q --verify 'origin/main^{tree}' 2>/dev/null)
[[ -z "$BASE" ]] && BASE=$(git rev-parse -q --verify 'HEAD^{tree}' 2>/dev/null)
[[ -z "$BASE" ]] && exit 0

reset_session() { rm -f "$COUNT_FILE" "$SIG_FILE" "$GAVEUP_FILE"; }
mark_pass() { printf '%s' "$TREE" > "$PASS_FILE"; reset_session; exit 0; }

CHANGED=$(git diff-tree -r --name-only "$BASE" "$TREE" 2>/dev/null)
[[ -z "$CHANGED" ]] && mark_pass
printf '%s\n' "$CHANGED" | grep -qvE '^docs/|\.md$' || mark_pass

# 止めるのをやめたあと、何も変えずにまた終えようとしている
[[ -f "$GAVEUP_FILE" && "$(cat "$GAVEUP_FILE")" == "$TREE" ]] && exit 0

# 試験が減った指摘は1つの状態につき1回だけ
count_tests() {
  git grep -c -E "$TEST_PATTERN" "$1" -- '*.test.ts' '*.test.tsx' 2>/dev/null \
    | awk -F: '{ s += $NF } END { print s + 0 }'
}
BEFORE=$(count_tests "$BASE")
AFTER=$(count_tests "$TREE")
if (( AFTER < BEFORE )) && [[ "$(cat "$WARNED_FILE" 2>/dev/null)" != "$TREE" ]]; then
  printf '%s' "$TREE" > "$WARNED_FILE"
  cat >&2 <<EOF
[完成の条件] 試験の数が減っています（${BEFORE}件 → ${AFTER}件）。
試験を消したり条件を緩めたりして通すことは禁止です。誤って消したなら戻してください。
機能を消したなどの理由で意図的に減らしたなら、その理由を最終報告に必ず書いてください（この指摘は1回だけです）。
EOF
  exit 2
fi

OUT=$(mktemp) || exit 0
trap 'rm -f "$TMP_INDEX" "$OUT"' EXIT
FAILED=""
if ! npm test >"$OUT" 2>&1; then
  FAILED="npm test（試験）"
elif ! npm run build >"$OUT" 2>&1; then
  FAILED="npm run build（型チェックと本番ビルド）"
fi
[[ -z "$FAILED" ]] && mark_pass

# 失敗の中身から所要時間を除いた署名。同じ署名が続いたら「同じ失敗」
SIG=$( { printf '%s\n' "$FAILED"
         grep -E 'error TS|FAIL |AssertionError|Error:|×' "$OUT" \
           | sed -E 's/[0-9]+(\.[0-9]+)? ?m?s\b//g' | sort -u
       } | git hash-object --stdin)
PREV_SIG=$(cat "$SIG_FILE" 2>/dev/null)
COUNT=$(cat "$COUNT_FILE" 2>/dev/null)
[[ "$COUNT" =~ ^[0-9]+$ ]] || COUNT=0

if [[ "$SIG" == "$PREV_SIG" ]] || (( COUNT >= MAX_BLOCKS )); then
  if [[ "$SIG" == "$PREV_SIG" ]]; then REASON="同じ失敗が2回続いた"; else REASON="${MAX_BLOCKS}回止めても通らなかった"; fi
  reset_session
  printf '%s' "$TREE" > "$GAVEUP_FILE"
  MSG="試験に通らないまま終わりました（${REASON}ため自動の繰り返しを止めました）。落ちた段: ${FAILED}"
  jq -n --arg m "$MSG" '{systemMessage: $m}'
  exit 0
fi

printf '%s' "$SIG" > "$SIG_FILE"
printf '%s' "$((COUNT + 1))" > "$COUNT_FILE"
{
  printf '[完成の条件] %s に通っていないので、まだ終われません（%s/%s回目）。\n' "$FAILED" "$((COUNT + 1))" "$MAX_BLOCKS"
  printf -- '--- 出力の末尾 ---\n'
  tail -n 60 "$OUT"
  printf -- '--- ここまで ---\n'
  printf '原因を直してから終えてください。試験を消したり条件を緩めたりして通すことは禁止です。\n'
  printf 'ユーザーの判断がないと直せないなら、何に迷っているかを書いて終えてください（同じ失敗のままなら次は止めません）。\n'
} >&2
exit 2
