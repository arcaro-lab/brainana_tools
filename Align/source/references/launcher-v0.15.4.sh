#!/bin/bash
set -u

BUNDLE_ID="org.brainana.align"
APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME="$APP_ROOT/Resources/runtime"
REMOTE_HELPER="$APP_ROOT/Resources/remote-launch.sh"
APP_SUPPORT="$HOME/Library/Application Support/Brainana Align"
# New clean profile store. This deliberately avoids the malformed profile files
# created by the 0.14.0/0.14.1 migration attempts.
PROFILES_FILE="$APP_SUPPORT/remote-connections.tsv"
LOG_DIR="$HOME/Library/Logs/Brainana Align"

show_message() {
  /usr/bin/osascript -e 'on run argv' \
    -e 'display dialog (item 1 of argv) buttons {"OK"} default button "OK" with title "Brainana Align"' \
    -e 'end run' -- "$1" >/dev/null
}

notify() {
  /usr/bin/osascript -e 'on run argv' \
    -e 'display notification (item 1 of argv) with title "Brainana Align"' \
    -e 'end run' -- "$1" >/dev/null 2>&1 || true
}

ask_text() {
  local prompt="$1"
  local default_value="$2"
  /usr/bin/osascript -e 'on run argv' \
    -e 'display dialog (item 1 of argv) default answer (item 2 of argv) buttons {"Cancel", "Continue"} default button "Continue" with title "Brainana Align"' \
    -e 'text returned of result' \
    -e 'end run' -- "$prompt" "$default_value"
}

ask_yes_no() {
  local prompt="$1"
  /usr/bin/osascript -e 'on run argv' \
    -e 'display dialog (item 1 of argv) buttons {"No", "Yes"} default button "Yes" with title "Brainana Align"' \
    -e 'button returned of result' \
    -e 'end run' -- "$prompt"
}

choose_mode() {
  /usr/bin/osascript -e 'set choices to {"Remote workstation", "Local files on this Mac"}' \
    -e 'set picked to choose from list choices with title "Brainana Align" with prompt "Where are the MRI and CT data located?" default items {"Remote workstation"} OK button name "Continue" cancel button name "Cancel"' \
    -e 'if picked is false then error number -128' \
    -e 'item 1 of picked'
}

choose_from_lines() {
  local title="$1"
  local prompt="$2"
  local default_item="$3"
  shift 3
  /usr/bin/osascript - "$title" "$prompt" "$default_item" "$@" <<'APPLESCRIPT'
on run argv
  set dialogTitle to item 1 of argv
  set dialogPrompt to item 2 of argv
  set defaultItem to item 3 of argv
  set choiceList to items 4 thru -1 of argv
  set defaultChoices to {}
  if defaultItem is not "" then set defaultChoices to {defaultItem}
  set picked to choose from list choiceList with title dialogTitle with prompt dialogPrompt default items defaultChoices OK button name "Continue" cancel button name "Cancel"
  if picked is false then error number -128
  return item 1 of picked
end run
APPLESCRIPT
}

choose_folder() {
  local prompt="$1"
  local default_path="$2"
  if [[ -d "$default_path" ]]; then
    /usr/bin/osascript -e 'on run argv' \
      -e 'set chosenFolder to choose folder with prompt (item 1 of argv) default location (POSIX file (item 2 of argv))' \
      -e 'POSIX path of chosenFolder' \
      -e 'end run' -- "$prompt" "$default_path"
  else
    /usr/bin/osascript -e 'on run argv' \
      -e 'set chosenFolder to choose folder with prompt (item 1 of argv)' \
      -e 'POSIX path of chosenFolder' \
      -e 'end run' -- "$prompt"
  fi
}

read_default() {
  local key="$1"
  local fallback="$2"
  local value
  value="$(/usr/bin/defaults read "$BUNDLE_ID" "$key" 2>/dev/null || true)"
  if [[ -n "$value" ]]; then printf '%s' "$value"; else printf '%s' "$fallback"; fi
}

save_default() {
  /usr/bin/defaults write "$BUNDLE_ID" "$1" "$2" >/dev/null 2>&1 || true
}

port_is_free() {
  ! /usr/sbin/lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

find_free_port() {
  local candidate="$1"
  local limit=$((candidate + 100))
  while (( candidate <= limit )); do
    if port_is_free "$candidate"; then
      printf '%s' "$candidate"
      return 0
    fi
    candidate=$((candidate + 1))
  done
  return 1
}

random_port() {
  local value
  value="$(/usr/bin/od -An -N4 -tu4 /dev/urandom | /usr/bin/tr -d ' ')"
  printf '%s' $((20000 + (value % 40000)))
}

sanitize_profile_field() {
  printf '%s' "$1" | tr '\t\r\n' '   '
}

ensure_profiles_file() {
  /bin/mkdir -p "$APP_SUPPORT"
  if [[ ! -f "$PROFILES_FILE" ]]; then
    {
      printf 'Penn workstation\tekim\t128.91.12.238\t/mnt/DataDrive3/swap/test_brainana/preproc/frosty/preprocessed\t5173\n'
      printf 'Bigbox\tmsl1\tbigbox.med.harvard.edu\t/data/brainana/output\t5173\n'
    } > "$PROFILES_FILE"
    chmod 600 "$PROFILES_FILE"
  fi
}

profile_names() {
  awk -F '\t' 'NF >= 5 {print $1}' "$PROFILES_FILE"
}

load_profile() {
  local wanted="$1"
  local line
  line="$(awk -F '\t' -v n="$wanted" '$1 == n {print; exit}' "$PROFILES_FILE")"
  [[ -n "$line" ]] || return 1
  IFS=$'\t' read -r PROFILE_NAME USERNAME HOST DATA_ROOT PROFILE_PORT <<< "$line"
}

save_profile() {
  local original_name="$1"
  local new_name="$2"
  local username="$3"
  local host="$4"
  local data_root="$5"
  local port="$6"
  local tmp
  tmp="$(/usr/bin/mktemp -t brainana-align-profiles.XXXXXX)" || return 1
  awk -F '\t' -v n="$original_name" '$1 != n' "$PROFILES_FILE" > "$tmp"
  printf '%s\t%s\t%s\t%s\t%s\n' \
    "$(sanitize_profile_field "$new_name")" \
    "$(sanitize_profile_field "$username")" \
    "$(sanitize_profile_field "$host")" \
    "$(sanitize_profile_field "$data_root")" \
    "$(sanitize_profile_field "$port")" >> "$tmp"
  mv "$tmp" "$PROFILES_FILE"
  chmod 600 "$PROFILES_FILE"
}

delete_profile() {
  local name="$1"
  local tmp
  tmp="$(/usr/bin/mktemp -t brainana-align-profiles.XXXXXX)" || return 1
  awk -F '\t' -v n="$name" '$1 != n' "$PROFILES_FILE" > "$tmp"
  mv "$tmp" "$PROFILES_FILE"
  chmod 600 "$PROFILES_FILE"
}

resolve_node() {
  local candidate
  candidate="$(/bin/zsh -lic 'command -v node 2>/dev/null' 2>/dev/null | tail -n 1)"
  [[ -n "$candidate" && -x "$candidate" ]] && { printf '%s' "$candidate"; return 0; }
  for candidate in /opt/homebrew/bin/node /usr/local/bin/node "$HOME/miniconda3/bin/node" "$HOME/anaconda3/bin/node" "$HOME/opt/anaconda3/bin/node" "$HOME/.nvm/versions/node"/*/bin/node; do
    [[ -x "$candidate" ]] && { printf '%s' "$candidate"; return 0; }
  done
  return 1
}

# Terminal execution path. This mirrors the working Viewer launcher: the GUI
# writes a temporary configuration and opens this same executable in Terminal.
if [[ "${1:-}" == "--terminal" ]]; then
  CONFIG_FILE="${2:-}"
  if [[ -z "$CONFIG_FILE" || ! -f "$CONFIG_FILE" ]]; then
    echo "Launcher configuration file is missing."
    exit 1
  fi
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
  rm -f "$CONFIG_FILE"

  echo "Brainana Align"
  echo "=============="
  echo "Mode: ${MODE_LABEL}"
  echo "Data directory: ${DATA_ROOT}"
  echo "Local address: http://localhost:${LOCAL_PORT}"
  echo
  echo "Keep this Terminal window open while using Brainana Align."
  echo "Press Control-C here when finished."
  echo

  if [[ "$MODE" == "remote" ]]; then
    exec "$REMOTE_HELPER" \
      "$PROFILE_NAME" "${USERNAME}@${HOST}" "$DATA_ROOT" "$REMOTE_PORT" \
      "$LOCAL_PORT" "$RUNTIME" "$LOG_FILE" ".brainana-align/app-v0.15.3"
  fi

  NODE_BIN="$(resolve_node)" || {
    echo "ERROR: Node.js is not available on this Mac."
    exit 33
  }
  exec "$NODE_BIN" "$RUNTIME/server.mjs" \
    --host 127.0.0.1 --port "$LOCAL_PORT" --root "$DATA_ROOT" \
    --mode local --label "This Mac"
fi

MODE_PICK="$(choose_mode)" || exit 0
MODE="remote"
MODE_LABEL="Remote workstation"
PROFILE_NAME=""
USERNAME=""
HOST=""
DATA_ROOT=""
PREFERRED_PORT="5173"
REMOTE_PORT="5173"

if [[ "$MODE_PICK" == "Remote workstation" ]]; then
  RANDOM_PORT="$(random_port)"
  ensure_profiles_file
  SAVED_NAMES=()
  while IFS= read -r profile_name; do
    [[ -n "$profile_name" ]] && SAVED_NAMES+=("$profile_name")
  done < <(profile_names)
  MENU_ITEMS=("${SAVED_NAMES[@]}" "Add a new connection..." "Delete a saved connection...")
  LAST_PROFILE="$(read_default lastRemoteProfile "${SAVED_NAMES[0]:-}")"
  PICKED="$(choose_from_lines "Brainana Align" "Choose a saved remote connection:" "$LAST_PROFILE" "${MENU_ITEMS[@]}")" || exit 0

  if [[ "$PICKED" == "Delete a saved connection..." ]]; then
    if (( ${#SAVED_NAMES[@]} == 0 )); then
      show_message "There are no saved connections to delete."
      exit 0
    fi
    TO_DELETE="$(choose_from_lines "Delete Connection" "Choose the connection to delete:" "${SAVED_NAMES[0]}" "${SAVED_NAMES[@]}")" || exit 0
    CONFIRM="$(ask_yes_no "Delete the saved connection ‘${TO_DELETE}’? This does not remove any data or application files.")" || exit 0
    if [[ "$CONFIRM" == "Yes" ]]; then
      delete_profile "$TO_DELETE"
      show_message "Deleted the saved connection ‘${TO_DELETE}’."
    fi
    exit 0
  fi

  ORIGINAL_PROFILE_NAME=""
  if [[ "$PICKED" == "Add a new connection..." ]]; then
    PROFILE_NAME="$(ask_text "Name for this saved connection:" "New workstation")" || exit 0
    USERNAME="$(ask_text "Remote workstation username:" "")" || exit 0
    HOST="$(ask_text "Workstation hostname or IP address:" "")" || exit 0
    DATA_ROOT="$(ask_text "Brainana data directory on the workstation:" "")" || exit 0
    PREFERRED_PORT="$(ask_text "Port for this launch. A random available candidate is provided; edit it for full control:" "$RANDOM_PORT")" || exit 0
  else
    load_profile "$PICKED" || {
      show_message "The selected connection could not be loaded."
      exit 1
    }
    ORIGINAL_PROFILE_NAME="$PROFILE_NAME"
    PROFILE_NAME="$(ask_text "Saved connection name:" "$PROFILE_NAME")" || exit 0
    USERNAME="$(ask_text "Remote workstation username:" "$USERNAME")" || exit 0
    HOST="$(ask_text "Workstation hostname or IP address:" "$HOST")" || exit 0
    DATA_ROOT="$(ask_text "Brainana data directory on the workstation:" "$DATA_ROOT")" || exit 0
    PREFERRED_PORT="$(ask_text "Port for this launch. A random available candidate is provided; edit it for full control:" "$RANDOM_PORT")" || exit 0
  fi

  if [[ -z "$PROFILE_NAME" || -z "$USERNAME" || -z "$HOST" || -z "$DATA_ROOT" ]]; then
    show_message "Connection name, username, host, and data directory are required."
    exit 1
  fi
  if [[ -z "$PREFERRED_PORT" ]] || ! [[ "$PREFERRED_PORT" =~ ^[0-9]+$ ]] || (( PREFERRED_PORT < 1024 || PREFERRED_PORT > 65435 )); then
    show_message "The preferred port must be a number between 1024 and 65435."
    exit 1
  fi

  SAVE_CHOICE="$(ask_yes_no "Save these settings as ‘${PROFILE_NAME}’? Existing settings with that name will be updated.")" || exit 0
  if [[ "$SAVE_CHOICE" == "Yes" ]]; then
    save_profile "$ORIGINAL_PROFILE_NAME" "$PROFILE_NAME" "$USERNAME" "$HOST" "$DATA_ROOT" "$PREFERRED_PORT" || {
      show_message "The connection settings could not be saved."
      exit 1
    }
  fi
  save_default lastRemoteProfile "$PROFILE_NAME"
  REMOTE_PORT="$PREFERRED_PORT"
else
  MODE="local"
  MODE_LABEL="Local files on this Mac"
  LOCAL_ROOT_DEFAULT="$(read_default localDataRoot "$HOME")"
  PREFERRED_PORT="$(read_default localPreferredPort 5173)"
  DATA_ROOT="$(choose_folder "Choose the folder containing the MRI and CT data." "$LOCAL_ROOT_DEFAULT")" || exit 0
  DATA_ROOT="${DATA_ROOT%/}"
  if [[ ! -d "$DATA_ROOT" ]]; then
    show_message "The selected data folder does not exist."
    exit 1
  fi
  PREFERRED_PORT="$(ask_text "Preferred local port. If it is busy, the launcher will select the next available port:" "$PREFERRED_PORT")" || exit 0
  if [[ -z "$PREFERRED_PORT" ]] || ! [[ "$PREFERRED_PORT" =~ ^[0-9]+$ ]] || (( PREFERRED_PORT < 1024 || PREFERRED_PORT > 65435 )); then
    show_message "The preferred port must be a number between 1024 and 65435."
    exit 1
  fi
  save_default localDataRoot "$DATA_ROOT"
  save_default localPreferredPort "$PREFERRED_PORT"
fi

LOCAL_PORT="$(find_free_port "$PREFERRED_PORT")" || {
  show_message "No available local port was found between ${PREFERRED_PORT} and $((PREFERRED_PORT + 100))."
  exit 1
}

/bin/mkdir -p "$APP_SUPPORT" "$LOG_DIR"
LOG_FILE="$LOG_DIR/${PROFILE_NAME:-local}-remote-launch.log"
CONFIG_FILE="$(/usr/bin/mktemp -t brainana-align-launcher.XXXXXX)" || {
  show_message "Could not create a temporary launcher configuration."
  exit 1
}
chmod 600 "$CONFIG_FILE"
printf 'MODE=%q\n' "$MODE" > "$CONFIG_FILE"
printf 'MODE_LABEL=%q\n' "$MODE_LABEL" >> "$CONFIG_FILE"
printf 'PROFILE_NAME=%q\n' "$PROFILE_NAME" >> "$CONFIG_FILE"
printf 'USERNAME=%q\n' "$USERNAME" >> "$CONFIG_FILE"
printf 'HOST=%q\n' "$HOST" >> "$CONFIG_FILE"
printf 'DATA_ROOT=%q\n' "$DATA_ROOT" >> "$CONFIG_FILE"
printf 'REMOTE_PORT=%q\n' "$REMOTE_PORT" >> "$CONFIG_FILE"
printf 'LOCAL_PORT=%q\n' "$LOCAL_PORT" >> "$CONFIG_FILE"
printf 'LOG_FILE=%q\n' "$LOG_FILE" >> "$CONFIG_FILE"

SELF="$0"
printf -v SELF_Q '%q' "$SELF"
printf -v CONFIG_Q '%q' "$CONFIG_FILE"
TERMINAL_CMD="$SELF_Q --terminal $CONFIG_Q"

if [[ "$MODE" == "remote" ]]; then
  notify "Opening Terminal and connecting using ‘${PROFILE_NAME}’."
else
  notify "Opening Terminal and starting Brainana Align locally."
fi

/usr/bin/osascript -e 'on run argv' \
  -e 'tell application "Terminal"' \
  -e 'activate' \
  -e 'do script (item 1 of argv)' \
  -e 'end tell' \
  -e 'end run' -- "$TERMINAL_CMD" >/dev/null || {
    show_message "Could not open Terminal."
    exit 1
  }

URL="http://localhost:${LOCAL_PORT}"
for attempt in $(seq 1 180); do
  if /usr/bin/curl -fsS --max-time 1 "${URL}/api/config" >/dev/null 2>&1; then
    notify "Brainana Align is ready on port ${LOCAL_PORT}."
    /usr/bin/open "$URL"
    exit 0
  fi
  sleep 1
done

show_message "Brainana Align did not become available at ${URL} within three minutes. Check the Terminal window for details."
exit 1
