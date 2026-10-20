# shellcheck shell=bash
# Sourced by scripts/ci/shellcheck.sh and its spec. Not a script itself.

# Splits $1 into words the way `env -S` does: whitespace separates words,
# '...' is literal, and "..." or unquoted text honours backslash escapes.
# Sets the array SPLIT_WORDS.
split_words() {
  local text="$1" word="" quote="" char
  local -i i in_word=0
  SPLIT_WORDS=()
  for ((i = 0; i < ${#text}; i++)); do
    char="${text:i:1}"
    if [[ "$quote" == "'" ]]; then
      if [[ "$char" == "'" ]]; then quote=""; else word+="$char"; fi
      continue
    fi
    if [[ "$char" == "\\" ]] && ((i + 1 < ${#text})); then
      i+=1
      word+="${text:i:1}"
      in_word=1
      continue
    fi
    if [[ "$quote" == '"' ]]; then
      if [[ "$char" == '"' ]]; then quote=""; else word+="$char"; fi
      continue
    fi
    case "$char" in
      "'" | '"')
        quote="$char"
        in_word=1
        ;;
      ' ' | $'\t')
        if ((in_word)); then
          SPLIT_WORDS+=("$word")
          word=""
          in_word=0
        fi
        ;;
      *)
        word+="$char"
        in_word=1
        ;;
    esac
  done
  if ((in_word)); then
    SPLIT_WORDS+=("$word")
  fi
}

# Prints the command `env` would run given its arguments. Option operands
# (`-u NAME`, `-C DIR`, `-P PATH`, attached or separate) are consumed, a split
# string (`-S`, `--split-string`) is unpacked, `-` is `-i`, and `NAME=value`
# assignments are skipped both before and after `--`, which ends only the
# options. Fails when no command remains.
env_command() {
  local word
  local -i options=1
  while (($#)); do
    word="$1"
    shift
    if ((options)); then
      case "$word" in
        -u | -C | -P | --unset | --chdir)
          (($#)) && shift
          continue
          ;;
        --split-string=* | -S?*)
          if [[ "$word" == -S?* ]]; then
            split_words "${word#-S}"
          else
            split_words "${word#--split-string=}"
          fi
          set -- "${SPLIT_WORDS[@]}" "$@"
          continue
          ;;
        --)
          options=0
          continue
          ;;
        -*) continue ;;
      esac
    fi
    if [[ "$word" == *=* ]]; then
      continue
    fi
    printf '%s\n' "${word##*/}"
    return 0
  done
  return 1
}

# Prints the interpreter a file's shebang names, looking through `env` (see
# env_command). Fails for a file with no shebang or no interpreter.
shebang_interpreter() {
  local line
  IFS= read -r line <"$1" || [[ -n "$line" ]] || return 1
  [[ "$line" == "#!"* ]] || return 1
  split_words "${line#\#!}"
  ((${#SPLIT_WORDS[@]})) || return 1
  if [[ "${SPLIT_WORDS[0]##*/}" == env ]]; then
    env_command "${SPLIT_WORDS[@]:1}"
    return
  fi
  printf '%s\n' "${SPLIT_WORDS[0]##*/}"
}
