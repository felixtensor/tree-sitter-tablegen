#!/usr/bin/env bash
# sync-examples-llvm.sh — Sync representative LLVM TableGen seed files into examples/llvm/
# Per spec §6.2: M1 keeps 5–10 files for grammar dialect-neutrality proof; M2 expands.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EXAMPLES_DIR="$PROJECT_DIR/examples/llvm"

LLVM_DIR="${1:-${LLVM_PROJECT_DIR:-$PROJECT_DIR/../llvm-project}}"
LLVM_DIR="$(cd "$LLVM_DIR" 2>/dev/null && pwd)" || {
  echo "Error: llvm-project not found at: ${1:-${LLVM_PROJECT_DIR:-../llvm-project}}"
  exit 1
}

mkdir -p "$EXAMPLES_DIR/IR" "$EXAMPLES_DIR/Target/X86" "$EXAMPLES_DIR/Target/AArch64"

# Curated M1 seed list (representative stress samples)
SEEDS=(
  "llvm/include/llvm/IR/Intrinsics.td:IR/Intrinsics.td"
  "llvm/include/llvm/IR/IntrinsicsX86.td:IR/IntrinsicsX86.td"
  "llvm/lib/Target/X86/X86InstrInfo.td:Target/X86/X86InstrInfo.td"
  "llvm/lib/Target/X86/X86RegisterInfo.td:Target/X86/X86RegisterInfo.td"
  "llvm/lib/Target/X86/X86.td:Target/X86/X86.td"
  "llvm/lib/Target/AArch64/AArch64InstrInfo.td:Target/AArch64/AArch64InstrInfo.td"
  "llvm/lib/Target/AArch64/AArch64.td:Target/AArch64/AArch64.td"
)

count=0
for entry in "${SEEDS[@]}"; do
  src_rel="${entry%%:*}"
  dst_rel="${entry##*:}"
  if [ -f "$LLVM_DIR/$src_rel" ]; then
    cp "$LLVM_DIR/$src_rel" "$EXAMPLES_DIR/$dst_rel"
    count=$((count + 1))
  else
    echo "  Warning: $src_rel not found, skipping"
  fi
done

echo "$count LLVM seed files synced"
