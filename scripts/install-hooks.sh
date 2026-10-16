#!/usr/bin/env bash
# Install this repository's hooks for this clone and every linked worktree.
# Hook installation is local: merging the hooks does not install them for
# anyone.
#
# The installer writes launchers into the repository's own hooks directory
# (the common git directory's hooks/), which every worktree shares and which
# moves with the clone. It leaves core.hooksPath unset: a relative path
# would resolve inside each worktree, where a sparse checkout can omit
# scripts/hooks, and an absolute one breaks when the clone moves.
#
# Each launcher runs the worktree's own tracked hook. When that hook is
# missing it refuses, unless the history being committed or pushed never
# had the hook, so a branch cannot bypass its hooks by deleting them.
set -euo pipefail

marker="installed by jedit scripts/install-hooks.sh"
hooks="$(git rev-parse --path-format=absolute --git-common-dir)/hooks"

configured="$(git config --local --get core.hooksPath || true)"
case "$configured" in
  "" | scripts/hooks | */jedit-hooks) git config --local --unset-all core.hooksPath || true ;;
  *)
    echo "install-hooks: core.hooksPath is set to $configured; remove it, then run this again." >&2
    exit 1
    ;;
esac

effective="$(git rev-parse --path-format=absolute --git-path hooks)"
if [[ "$effective" != "$hooks" ]]; then
  echo "install-hooks: git uses $effective for hooks, not $hooks." >&2
  echo "A core.hooksPath set outside this clone's shared config (for example per worktree or globally) overrides it; remove that setting, then run this again." >&2
  exit 1
fi

mkdir -p "$hooks"
for name in pre-commit pre-push; do
  if [[ -e "$hooks/$name" ]] && ! grep -qF "$marker" "$hooks/$name"; then
    echo "install-hooks: $hooks/$name exists and was not installed by this script; leaving it alone." >&2
    exit 1
  fi
done

for name in pre-commit pre-push; do
  cat > "$hooks/$name" <<LAUNCHER
#!/usr/bin/env bash
# $marker.
LAUNCHER
  cat >> "$hooks/$name" <<'LAUNCHER'
# Git runs hooks from the worktree's top level, so this runs that worktree's
# tracked hook. When it is missing, the launcher refuses unless the history
# at stake never had it.
set -euo pipefail
name="$(basename "$0")"
hook="$PWD/scripts/hooks/$name"
if [[ -x "$hook" ]]; then
  exec "$hook" "$@"
fi

had_hook() {
  [[ -n "$(git --no-replace-objects log -1 --format=%H "$1" -- "scripts/hooks/$name" 2>/dev/null)" ]]
}

refuse() {
  echo "jedit hooks: $1 has had scripts/hooks/$name, but this worktree does not (sparse checkout, or deleted?)." >&2
  echo "Refusing to skip it. Restore scripts/hooks in this worktree, then try again." >&2
  exit 1
}

if [[ "$name" == pre-push ]]; then
  while read -r local_ref local_oid remote_ref remote_oid; do
    if [[ ! "$local_oid" =~ ^0+$ ]] && had_hook "$local_oid"; then
      refuse "$local_ref"
    fi
  done
elif git rev-parse --verify --quiet HEAD >/dev/null && had_hook HEAD; then
  refuse "this branch"
fi
echo "jedit hooks: this history never had scripts/hooks/$name; skipping it." >&2
LAUNCHER
  chmod +x "$hooks/$name"
done

echo "hooks installed in $hooks"
