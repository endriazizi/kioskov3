#!/usr/bin/env bash
set -euo pipefail
# -e: stop al primo errore
# -u: errore se uso variabili non definite
# -o pipefail: fallisce l’intera pipe se un comando fallisce

# ===================== CONFIG (modificabile via env) =====================
ROOT="${ROOT:-src}"                    # SOLO src/
OUT="${OUT:-SRC_SNAPSHOT.md}"          # file markdown di output
INCLUDE_BIN="${INCLUDE_BIN:-0}"        # 0 = esclude asset/binari (consigliato)
NORMALIZE_CRLF="${NORMALIZE_CRLF:-1}"  # 1 = rimuove \r (CRLF→LF)
MAX_BYTES_PER_FILE="${MAX_BYTES_PER_FILE:-120000}"  # 120 KB default (0 = no limit)
MAX_FILES="${MAX_FILES:-0}"            # 0 = nessun limite sul numero di file
# ========================================================================

# ---- sottodirectory da escludere DENTRO src/ (tree + find) ----
PRUNE_DIRS=(
  "$ROOT/node_modules" "$ROOT/.git" "$ROOT/dist" "$ROOT/build"
  "$ROOT/coverage" "$ROOT/tmp" "$ROOT/www"
)

# ---- pattern binari (esclusi se INCLUDE_BIN=0) ----
BIN_GLOBS=(
  "*.png" "*.jpg" "*.jpeg" "*.gif" "*.webp" "*.ico" "*.svg" "*.svgz"
  "*.pdf" "*.zip" "*.gz" "*.rar" "*.7z"
  "*.mp3" "*.wav" "*.mp4" "*.webm" "*.mov"
  "*.woff" "*.woff2" "*.ttf" "*.otf" "*.eot"
  "*.exe" "*.dll" "*.jar" "*.psd" "*.ai"
)

# ===================== FUNZIONI =====================

# lingua per i code fence Markdown
ext_to_lang () {
  case "$1" in
    ts|js|mjs|cjs|jsx|tsx|html|scss|css|less|sass|json|md|yml|yaml|xml|toml|ini|conf|sh|bash|bat|ps1|env|sql|Dockerfile|dockerfile)
      printf "%s" "$1" ;;
    Dockerfile|dockerfile) printf "dockerfile" ;;
    *) printf "" ;;
  esac
}

# ===================== 1) TREE DI src/ =====================
[ -d "$ROOT" ] || { echo "Cartella '$ROOT' non trovata"; exit 1; }
TREE_FILE="$(mktemp)"

# Esclusioni per tree-cli in forma virgole (es. "node_modules,.git,dist")
# (niente sed/regex complicate: solo join con virgole)
TREE_EXCL_COMMA=""
for d in "${PRUNE_DIRS[@]}"; do
  sub="${d#"$ROOT/"}"           # rimuove prefisso "src/"
  [ -n "$sub" ] && TREE_EXCL_COMMA+="${sub},"
done
TREE_EXCL_COMMA="${TREE_EXCL_COMMA%,}"   # toglie l’ultima virgola

if [ -x "./node_modules/.bin/tree" ]; then
  # tree-cli: -l (elle) = profondità, -I con virgole
  ./node_modules/.bin/tree "$ROOT" -a -l 100 --dirs-first -I "$TREE_EXCL_COMMA" > "$TREE_FILE" || true
else
  # Fallback Windows: comando TREE nativo
  if command -v cmd >/dev/null 2>&1; then
    ( cd "$ROOT" && cmd //c "tree /F /A" ) | tr -d '\r' > "$TREE_FILE" || true
  else
    # Fallback minimale: elenco ricorsivo (non grafico)
    find "$ROOT" -print > "$TREE_FILE"
  fi
fi

# Post-filtro semplice e compatibile: rimuovi righe del tree che parlano delle dir escluse
# (usa grep -F = “fixed strings”, NO regex → addio errori con { } )
if [ -s "$TREE_FILE" ]; then
  TMPF="${TREE_FILE}.filtered"
  cp "$TREE_FILE" "$TMPF"
  for d in "${PRUNE_DIRS[@]}"; do
    base="${d#"$ROOT/"}"
    # rimuove qualsiasi riga che contenga "\base\" o "/base/" (case-insensitive)
    grep -viF "\\${base}\\" "$TMPF" | grep -viF "/${base}/" > "${TMPF}.2" || true
    mv "${TMPF}.2" "$TMPF"
  done
  mv "$TMPF" "$TREE_FILE"
fi

# ===================== 2) LISTA FILE (ordinati) =====================
LIST_FILE="$(mktemp)"

# Costruisci find con -prune per le dir rumorose
FIND_CMD=( find "$ROOT" )
if ((${#PRUNE_DIRS[@]})); then
  FIND_CMD+=( \( )
  for d in "${PRUNE_DIRS[@]}"; do FIND_CMD+=( -path "$d" -o ); end=1; done
  # rimuovi ultimo -o
  unset 'FIND_CMD[${#FIND_CMD[@]}-1]'
  FIND_CMD+=( \) -prune -o )
fi
FIND_CMD+=( -type f )

# Escludi binari (se richiesto)
if (( INCLUDE_BIN == 0 )); then
  for g in "${BIN_GLOBS[@]}"; do FIND_CMD+=( ! -iname "$g" ); done
fi

FIND_CMD+=( -print )

# Esegui find, normalizza eventuale prefisso "./" con cut e ordina
# (nessun sed con regex: usiamo cut e sort)
"${FIND_CMD[@]}" \
  | awk '{sub(/^\.\//,""); print}' \
  | LC_ALL=C sort > "$LIST_FILE"

TOTAL_FILES=$(wc -l < "$LIST_FILE" | tr -d '[:space:]')
if (( MAX_FILES > 0 && TOTAL_FILES > MAX_FILES )); then
  head -n "$MAX_FILES" "$LIST_FILE" > "${LIST_FILE}.cut" && mv "${LIST_FILE}.cut" "$LIST_FILE"
fi

# ===================== 3) HEADER + TREE =====================
OUT_TMP="$(mktemp)"
exec 3>"$OUT_TMP"

{
  echo "# Snapshot src/"
  echo
  echo "Generato: $(date '+%Y-%m-%d %H:%M:%S')"
  echo
  echo "Root: \`$ROOT\` — Esclusi: ${TREE_EXCL_COMMA:-—} — Binari inclusi: $([ $INCLUDE_BIN -eq 1 ] && echo sì || echo no)"
  echo "Limiti: $([ $MAX_BYTES_PER_FILE -gt 0 ] && echo "${MAX_BYTES_PER_FILE}B/file" || echo "nessun limite")"
  echo
  echo "## Tree di \`$ROOT/\`"
  echo
  echo '```'
  cat "$TREE_FILE"
  echo '```'
  echo
  echo "## Contenuti dei file (ordinati per percorso)"
} >&3

# ===================== 4) DUMP CONTENUTI =====================
COUNT=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  lang="$(ext_to_lang "${f##*.}")"

  {
    echo
    echo '---'
    echo
    echo "### ${f}"
    echo
    printf '```%s\n' "$lang"
  } >&3

  # Scrivi contenuto (troncamento + CRLF→LF opzionali, senza sed)
  if (( MAX_BYTES_PER_FILE > 0 )); then
    size=$(wc -c < "$f")
    if (( size > MAX_BYTES_PER_FILE )); then
      if (( NORMALIZE_CRLF == 1 )); then head -c "$MAX_BYTES_PER_FILE" -- "$f" | tr -d '\r' >&3
      else head -c "$MAX_BYTES_PER_FILE" -- "$f" >&3
      fi
      echo -e "\n... [TRONCATO a ${MAX_BYTES_PER_FILE} byte; originale ${size} byte]" >&3
    else
      if (( NORMALIZE_CRLF == 1 )); then tr -d '\r' < "$f" >&3
      else cat -- "$f" >&3
      fi
    fi
  else
    if (( NORMALIZE_CRLF == 1 )); then tr -d '\r' < "$f" >&3
    else cat -- "$f" >&3
    fi
  fi

  echo '```' >&3
  COUNT=$((COUNT+1))
done < "$LIST_FILE"

exec 3>&-
mv "$OUT_TMP" "$OUT"
echo "Creato ${OUT} — inclusi ${COUNT} file (su ${TOTAL_FILES} trovati in $ROOT/)."
