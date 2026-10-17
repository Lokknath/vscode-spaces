# Spaces: Claude Extension Validation

> **Result of the first run:** PASS. Two concurrent real Claude sessions survived switching, completed in the background and kept their conversations and pending input. See `docs/spaces-claude-validation-results.md`.

## 1. Purpose

Spaces host several independent VS Code windows behind one visible frame. The active Space is shown, and inactive Spaces are hidden but keep running. The scripted validation (`docs/spaces-mvp-validation.md`, section A) proves this for a generic extension: the extension host PID is unchanged, the extension is not re-activated, timers keep running, and terminals stay alive.

This manual test confirms the same thing for the main use case: **a Claude VS Code extension session in one Space survives switching to another Space and back**, exactly as it would survive switching between two separate VS Code windows.

It has to be run by a person, because the Claude extension needs your signed-in account.

## 2. Prerequisites

- **Build.** The fork is built from branch `feature/workspace-spaces-mvp` (see `docs/spaces-mvp-validation.md` §0).
- **Launch.** Start the fork with:

  ```bash
  ./scripts/code.sh
  ```

  If you launch it from a terminal that runs inside another VS Code or extension host, use `env -u ELECTRON_RUN_AS_NODE ./scripts/code.sh`.
- **Claude extension.** The Claude VS Code extension is installed in the fork, and you are signed in. Code OSS has no extension marketplace configured, so install the extension from a `.vsix` file with **Extensions: Install from VSIX...**. Then open the Claude panel once and sign in.
- **Spaces setting.** Spaces are enabled in your user `settings.json`:

  ```jsonc
  "workbench.experimental.spaces.enabled": true
  ```

  A `Space: …` entry then appears in the title bar and the status bar.
- **Test folders.** Use two throwaway git repositories, for example:

  ```bash
  mkdir -p /tmp/vscode-spaces-validation/projects && cd /tmp/vscode-spaces-validation/projects
  for p in project-a project-b; do mkdir -p $p && (cd $p && git init -q && echo "# $p" > README.md && git add . && git -c user.name=test -c user.email=test@example.com commit -qm init); done
  ```

  Use test repositories rather than real work: the prompts below tell Claude not to modify anything, but a test should never depend on that.

## 3. Create Space A and Space B

1. In the fork's window, open the Command Palette (<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>) and run **Spaces: Open Folder as New Space...**. Pick `/tmp/vscode-spaces-validation/projects/project-a`.
   - The window you ran the command from becomes a Space too. You can close it later from the Spaces picker.
2. Run **Spaces: Open Folder as New Space...** again and pick `/tmp/vscode-spaces-validation/projects/project-b`.
3. Run **Spaces: Switch Space** (or click `Space: … ▾` in the title bar). The picker lists `project-a` and `project-b`, and the current Space has a check mark.
4. Optional, but it makes the "no restart" check concrete: in each Space, run **Developer: Show Running Extensions** and note the extension host PID. **Developer: Open Process Explorer** shows one `extension-host` process per Space.

## 4. Claude test prompts

### Step 1: start Claude in Space A

Switch to **project-a**. Open the Claude panel, start a new conversation and send:

```text
This is a Spaces validation test.
Do not modify the repository.
Run this command in the integrated terminal and wait for it to finish:

i=0; while [ $i -lt 90 ]; do date "+SPACE_A %H:%M:%S"; i=$((i+1)); sleep 1; done

After the command finishes, summarize whether it completed normally.
```

Wait until Claude has actually started running the command (you see `SPACE_A` lines).

### Step 2: switch to Space B right away and start Claude there

Run **Spaces: Switch Space** and pick **project-b**. Open the Claude panel, start a new conversation and send:

```text
This is a Spaces validation test.
Do not modify the repository.
Run this command in the integrated terminal and wait for it to finish:

i=0; while [ $i -lt 90 ]; do date "+SPACE_B %H:%M:%S"; i=$((i+1)); sleep 1; done

After the command finishes, summarize whether it completed normally.
```

### Step 3: switch back and forth

1. While B's loop runs, switch to **project-a**. Stay there for about 30 seconds.
2. Switch to **project-b** and stay about 30 seconds.
3. Wait until both 90-second loops have had time to finish (about 2 minutes after step 1). Then visit each Space and read Claude's summary.

### Step 4: check for restarts

- **Developer: Show Running Extensions** in each Space shows the same extension host PID as in §3 step 4.
- **Developer: Open Process Explorer** still lists the same `extension-host` PIDs.

Claude may run the command with its own shell tool instead of the VS Code integrated terminal. Both are valid for this test, because both run inside that Space's extension host session. If you also want to check VS Code's integrated terminal, open a terminal in each Space yourself before switching and run the same loop there.

## 5. Expected pass behavior

- Claude in Space A does not reset or disappear after you switch to Space B.
- Claude in Space B does not reset or disappear after you switch to Space A.
- Both terminal loops continue: the `SPACE_A` and `SPACE_B` timestamps have no multi-second gaps while their Space was hidden, and both loops reach their natural end.
- Returning to either Space shows the same Claude chat and session, with the full conversation history and the final summary.
- No extension host restarts only because a Space was hidden. PIDs are unchanged, and there is no "Extension host terminated unexpectedly" or "Restarting extension host" notification.
- The title bar and picker never show more than one window for the same folder.

## 6. Expected fail behavior

Record any of these as a failure in the results template (`docs/spaces-claude-validation-results-template.md`):

- A Claude chat resets to an empty conversation, or asks you to sign in again.
- The Claude extension reloads: its panel re-initializes, or the extension host PID changed.
- A terminal process exits: the loop output stops before 90 lines, or the terminal shows "process exited" or "terminal process terminated".
- A hidden Space is reopened as a duplicate, for example a second `project-a` in the picker or a second visible window.
- Switching behaves like a normal **Open Folder**: the window reloads, the workbench restarts, or editors and panels are restored from scratch.

## 7. Known limitations

- **Hidden prompts.** If Claude or another extension opens a modal or permission prompt in a hidden Space, you may not see it until you switch back to that Space. The session waits for your answer; it is not killed.
  - Spaces add a small **needs attention** marker for the cases they can detect. The picker shows `project-b — needs attention`, and a bell dot appears in the title bar and status bar of the visible Space. The marker is cleared when you switch to that Space. It is raised when a hidden Space:
    - shows a VS Code modal dialog (with `window.dialogStyle: "custom"`), or
    - requests window attention (the dock bounce / taskbar flash used by built-in chat and long-running tasks).
  - **Prompts drawn inside an extension's own panel are not detected.** Claude's in-panel approval buttons are an example, unless the extension also raises a VS Code notification or attention request. Check hidden Spaces periodically while Claude works.
  - With the default `window.dialogStyle: "native"` on macOS, a VS Code modal dialog in a hidden Space makes macOS show that window. Spaces then switch to that Space automatically, instead of showing the marker.
- **Confirmed by dogfooding: Claude waiting for input inside its panel does not mark the hidden Space.** No bell appears.
- **Per-workspace enablement.** Claude may need to be enabled separately in each Space's workspace. This follows from isolated workspace extension state.
- **Mission Control / App Exposé** can show the real windows of hidden Spaces.
- **Not restored on restart.** Spaces live in memory. After quitting, every Space reopens as a separate window (if `window.restoreWindows` restores them).
- **No native fullscreen switching.** On macOS, switching or creating Spaces is refused while the visible Space is in native fullscreen.
- **Hidden Spaces keep full CPU.** Inactive Spaces are not throttled, so a busy terminal or animation in a hidden Space still uses CPU and GPU.
