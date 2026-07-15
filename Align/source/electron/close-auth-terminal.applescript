on run argv
  set wantedTTY to item 1 of argv
  tell application "Terminal"
    repeat with terminalWindow in windows
      repeat with terminalTab in tabs of terminalWindow
        if (tty of terminalTab) is wantedTTY then
          close terminalWindow
          return "closed"
        end if
      end repeat
    end repeat
  end tell
  return "not-found"
end run
