# shellcheck shell=bash
# Sourced by scripts/ci/shellcheck.sh and its spec. Not a script itself.

# Classifies a file by its shebang. For a plain shebang (`#!/path/interp ...`
# or `#!/usr/bin/env [NAME=value]... interp ...`) it prints the interpreter and
# returns 0. It returns 1 when the file has no shebang or no interpreter, and
# 2 for an `env` shebang it does not parse: one that uses env options (such as
# `-S` or `-u`), quotes, or backslash escapes. Emulating env's parser is how
# shell scripts get silently skipped, so callers must refuse status 2 rather
# than guess.
shebang_interpreter() {
  local line word
  local -a words
  IFS= read -r line <"$1" || [[ -n "$line" ]] || return 1
  [[ "$line" == "#!"* ]] || return 1
  line="${line#\#!}"
  read -r -a words <<<"$line"
  ((${#words[@]})) || return 1
  if [[ "${words[0]##*/}" != env ]]; then
    printf '%s\n' "${words[0]##*/}"
    return 0
  fi
  if [[ "$line" == *[\"\'\\]* ]]; then
    return 2
  fi
  for word in "${words[@]:1}"; do
    case "$word" in
      -*) return 2 ;;
      *=*) ;;
      *)
        printf '%s\n' "${word##*/}"
        return 0
        ;;
    esac
  done
  return 1
}
