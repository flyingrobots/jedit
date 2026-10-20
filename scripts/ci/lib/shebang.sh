# shellcheck shell=bash
# Sourced by scripts/ci/shellcheck.sh and its spec. Not a script itself.

# Prints the command `env` would run given its arguments: option operands
# (`-u NAME`, `-C DIR`, `-P PATH`, attached or separate) are consumed, a split
# string (`-S`, `--split-string`) is unpacked, `NAME=value` assignments are
# skipped, and `--` ends the options. Fails when no command remains.
env_command() {
  local word
  local -a parts
  while (($#)); do
    word="$1"
    shift
    case "$word" in
      -u | -C | -P | --unset | --chdir) (($#)) && shift ;;
      --unset=* | --chdir=* | -u?* | -C?* | -P?*) ;;
      -S | --split-string) ;;
      --split-string=*)
        read -r -a parts <<<"${word#--split-string=}"
        set -- "${parts[@]}" "$@"
        ;;
      -S?*)
        read -r -a parts <<<"${word#-S}"
        set -- "${parts[@]}" "$@"
        ;;
      --)
        (($#)) || return 1
        printf '%s\n' "${1##*/}"
        return 0
        ;;
      -* | *=*) ;;
      *)
        printf '%s\n' "${word##*/}"
        return 0
        ;;
    esac
  done
  return 1
}

# Prints the interpreter a file's shebang names, looking through `env` (see
# env_command). Fails for a file with no shebang or no interpreter.
shebang_interpreter() {
  local line
  local -a words
  IFS= read -r line <"$1" || [[ -n "$line" ]] || return 1
  [[ "$line" == "#!"* ]] || return 1
  read -r -a words <<<"${line#\#!}"
  ((${#words[@]})) || return 1
  if [[ "${words[0]##*/}" == env ]]; then
    env_command "${words[@]:1}"
    return
  fi
  printf '%s\n' "${words[0]##*/}"
}
