#!/usr/bin/env bash
# ShellCheck every tracked shell script, plus the hook launchers that
# scripts/install-hooks.sh generates. The launchers exist only inside an
# installed hooks directory, so they are installed into a throwaway
# repository and checked there.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"

scripts=()
while IFS= read -r -d '' path; do
  case "$path" in
    *.sh) scripts+=("$path") ;;
    *)
      if [[ -f "$path" ]] && head -n 1 "$path" | grep -qE '^#!.*\b(bash|sh)\b'; then
        scripts+=("$path")
      fi
      ;;
  esac
done < <(git ls-files -z)

if ((${#scripts[@]} == 0)); then
  echo "shellcheck: no tracked shell scripts found" >&2
  exit 1
fi
shellcheck -x "${scripts[@]}"

scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
git -C "$scratch" init -q
mkdir -p "$scratch/scripts"
cp scripts/install-hooks.sh "$scratch/scripts/"
(cd "$scratch" && GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 scripts/install-hooks.sh >/dev/null)
shellcheck "$scratch/.git/hooks/pre-commit" "$scratch/.git/hooks/pre-push"

echo "shellcheck: ${#scripts[@]} tracked scripts and 2 generated launchers are clean"
