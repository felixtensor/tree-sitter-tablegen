#!/usr/bin/env bash
# sync-examples-mlir.sh — Sync MLIR TableGen include files into examples/mlir/
#
# Usage:
#   ./scripts/sync-examples-mlir.sh [LLVM_PROJECT_DIR]
#
# If no argument is given, uses $LLVM_PROJECT_DIR or defaults to ../llvm-project.
# Per spec §6.2: no version pin; provenance recorded in the sync PR's commit message.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EXAMPLES_DIR="$PROJECT_DIR/examples/mlir"

LLVM_DIR="${1:-${LLVM_PROJECT_DIR:-$PROJECT_DIR/../llvm-project}}"
LLVM_DIR="$(cd "$LLVM_DIR" 2>/dev/null && pwd)" || {
  echo "Error: llvm-project directory not found at: ${1:-${LLVM_PROJECT_DIR:-../llvm-project}}"
  echo "Usage: $0 [LLVM_PROJECT_DIR]"
  exit 1
}

MLIR_INCLUDE="$LLVM_DIR/mlir/include/mlir"
MLIR_TBLGEN_REGRESS="$LLVM_DIR/mlir/test/mlir-tblgen"

if [ ! -d "$MLIR_INCLUDE" ]; then
  echo "Error: $MLIR_INCLUDE does not exist. Is this a valid llvm-project checkout?"
  exit 1
fi

echo "Syncing TableGen examples from: $LLVM_DIR"
echo "Target: $EXAMPLES_DIR"
echo ""

# ── Helpers ──────────────────────────────────────────────────────────────────
sync_dir_all() {
  local src="$1" dst="$2" glob="$3"
  local count=0 skipped=0

  mkdir -p "$dst"

  # Remove orphans
  shopt -s nullglob
  for f in "$dst"/*.td; do
    [ -f "$f" ] || continue
    local basename="$(basename "$f")"
    if [ ! -f "$src/$basename" ]; then
      rm "$f"
    fi
  done

  for f in "$src"/$glob; do
    [ -f "$f" ] || continue
    local basename="$(basename "$f")"
    if [[ "$basename" == *invalid* ]]; then
      skipped=$((skipped + 1))
      continue
    fi
    cp "$f" "$dst/"
    count=$((count + 1))
  done
  shopt -u nullglob

  echo "  $count files synced, $skipped skipped (invalid)"
}

sync_dir_globs() {
  local src="$1" dst="$2"
  shift 2
  local count=0 skipped=0

  mkdir -p "$dst"

  shopt -s nullglob
  for f in "$dst"/*.td; do
    [ -f "$f" ] || continue
    local basename="$(basename "$f")"
    local in_src=false
    for glob in "$@"; do
      if [ -f "$src/$basename" ]; then
        in_src=true
        break
      fi
    done
    if ! $in_src; then
      rm "$f"
    fi
  done

  for glob in "$@"; do
    for f in "$src"/$glob; do
      [ -f "$f" ] || continue
      local basename="$(basename "$f")"
      if [[ "$basename" == *invalid* ]]; then
        skipped=$((skipped + 1))
        continue
      fi
      cp "$f" "$dst/"
      count=$((count + 1))
    done
  done
  shopt -u nullglob

  echo "  $count files synced, $skipped skipped (invalid)"
}

# ── 1. examples/mlir/IR/ ─────────────────────────────────────────────────────
echo "IR:"
sync_dir_all "$MLIR_INCLUDE/IR" "$EXAMPLES_DIR/IR" "*.td"

# ── 2. examples/mlir/Interfaces/ ─────────────────────────────────────────────
echo "Interfaces:"
sync_dir_all "$MLIR_INCLUDE/Interfaces" "$EXAMPLES_DIR/Interfaces" "*.td"

# ── 3. examples/mlir/Dialect/<X>/ ────────────────────────────────────────────
DIALECTS="Arith Func LLVMIR SCF ControlFlow Linalg Vector GPU MemRef \
          Tensor Affine Bufferization PDL Async Transform"
for D in $DIALECTS; do
  if [ -d "$MLIR_INCLUDE/Dialect/$D/IR" ]; then
    echo "Dialect/$D:"
    sync_dir_globs "$MLIR_INCLUDE/Dialect/$D/IR" "$EXAMPLES_DIR/Dialect/$D" \
      "*Dialect.td" "*Ops.td" "*Interfaces.td" "*Attr*.td" "*Enums.td" "*Types.td"
  fi
done

# ── 4. examples/mlir/_tblgen-regress/ ────────────────────────────────────────
if [ -d "$MLIR_TBLGEN_REGRESS" ]; then
  echo "_tblgen-regress:"
  sync_dir_all "$MLIR_TBLGEN_REGRESS" "$EXAMPLES_DIR/_tblgen-regress" "*.td"
fi

echo ""
echo "Done."
