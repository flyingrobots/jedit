#!/usr/bin/env bash
# ShellCheck every tracked shell script, plus the hook launchers that
# scripts/install-hooks.sh generates. The launchers exist only inside an
# installed hooks directory, so they are installed into a throwaway
# repository and checked there.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"

# Prints the interpreter a file's shebang names, looking through `env` and its
# options (`env -S bash -e`, `env NAME=value sh`). Fails for a file with no
# shebang or no interpreter.
shebang_interpreter() {
  local line word
  local -a words
  IFS= read -r line <"$1" || [[ -n "$line" ]] || return 1
  [[ "$line" == "#!"* ]] || return 1
  read -r -a words <<<"${line#\#!}"
  ((${#words[@]})) || return 1
  if [[ "${words[0]##*/}" != env ]]; then
    printf "%s\n" "${words[0]##*/}"
    return 0
  fi
  for word in "${words[@]:1}"; do
    if [[ "$word" != -* && "$word" != *=* ]]; then
      printf "%s\n" "${word##*/}"
      return 0
    fi
  done
  return 1
}

scripts=()
while IFS= read -r -d '' path; do
  case "$path" in
    *.sh) scripts+=("$path") ;;
    *)
      if [[ -f "$path" ]] && interpreter="$(shebang_interpreter "$path")"; then
        case "$interpreter" in
          bash | sh) scripts+=("$path") ;;
        esac
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
