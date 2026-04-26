# examples/

Real-world TableGen `.td` files vendored from the [llvm-project](https://github.com/llvm/llvm-project) source tree, used as the **Tier 2** test set: smoke parse with `tree-sitter parse --quiet --stat examples/**/*.td`, expecting **zero ERROR nodes**.

## Layout

- `mlir/` — files from `mlir/include/mlir/` (and `mlir/test/mlir-tblgen/` under `_tblgen-regress/`)
- `llvm/` — representative LLVM backend `.td` files (M1 seed; expanded in M2)
- Future: `clang/` (M3), `lldb/` (M4)

## Sync

Use the scripts in `scripts/`:

```bash
./scripts/sync-examples-mlir.sh [LLVM_PROJECT_DIR]
./scripts/sync-examples-llvm.sh [LLVM_PROJECT_DIR]
```

`LLVM_PROJECT_DIR` defaults to `$LLVM_PROJECT_DIR` env, otherwise `../llvm-project`. No upstream version is pinned; provenance lives in each sync PR's commit message (include the LLVM commit hash).

## Conventions

- Files containing `invalid` in the name are excluded — those are LLVM's intentional negative cases.
- `examples/` is **committed**; do not gitignore it.
- A failing parse on any vendored file is a hard CI failure (no `continue-on-error`).
