#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKBENCH_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${WORKBENCH_DIR}/../.." && pwd)"
TEST_DIR="${REPO_ROOT}/libpolys/tests"
NODE="${NODE:-node}"

bash "${SCRIPT_DIR}/build-full-wasm.sh"

grep -qx '#define SIZEOF_LONG 4' "${REPO_ROOT}/_config.h"
test -s "${REPO_ROOT}/Singular/Singular.js"
test -s "${REPO_ROOT}/Singular/Singular.wasm"
test -s "${REPO_ROOT}/Singular/Singular.data"
file "${REPO_ROOT}/Singular/Singular.wasm" | grep -q WebAssembly

wasm_test_ldflags="$(sed -n 's/^LDFLAGS = //p' "${TEST_DIR}/Makefile")"
test -n "${wasm_test_ldflags}"
emmake make -C "${TEST_DIR}" coeffs_test \
  LDFLAGS="${wasm_test_ldflags} -fexceptions -s NODERAWFS=1"

test -e "${TEST_DIR}/gftables/25"
(
  cd "${TEST_DIR}"
  "${NODE}" ./coeffs_test
) 2>&1 | tee "${TEST_DIR}/coeffs_test.log"

grep -Eq 'Running [1-9][0-9]* tests' "${TEST_DIR}/coeffs_test.log"
grep -q 'OK!' "${TEST_DIR}/coeffs_test.log"
"${NODE}" --check "${REPO_ROOT}/Singular/Singular.js"
