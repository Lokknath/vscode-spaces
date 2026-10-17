# Spaces Claude Validation Results

This is the first manual dogfooding run with the real Claude Code VS Code extension. It follows `docs/spaces-claude-validation.md`.

Date: 2026-09-14
OS: macOS (windowed mode; see limitations for native fullscreen)
Fork branch: `feature/workspace-spaces-mvp`
Fork commit: `c779ef9bd63`
Claude extension version: not recorded
Number of Spaces tested: 2
Test folder A: `project-a` (a real repository, name replaced)
Test folder B: `project-b` (a real repository, name replaced)

## Results

Did Claude in Space A survive switching? **Yes**
Did Claude in Space B survive switching? **Yes**
Did Space A terminal continue running? **Yes** (Claude tasks kept running and completed while the Space was hidden)
Did Space B terminal continue running? **Yes**
Did either extension host restart unexpectedly? **No**
Did any hidden modal/dialog block progress? **No** (a Claude prompt waiting for input stayed pending until the user returned to that Space, as expected)
Did switching create duplicate windows? **No**
Did unsaved editors remain scoped correctly? **Yes**
Did Git/source-control remain scoped correctly? **Yes**

## Scenario results

| Scenario | Result |
|---|---|
| Two concurrent real Claude sessions, one per Space | **PASS** |
| Background completion: a Claude task finishes while its Space is hidden | **PASS** |
| Conversation preserved after switching back and forth | **PASS** |
| Claude waiting for user input stays intact while hidden; continuing works | **PASS** |
| Dirty editor preserved (`project-b` → `project-a` → `project-b`, unsaved dot kept) | **PASS** |
| Close one Space (File › Close Window / <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>W</kbd>) | **PASS**: only that Space closed, the other stayed alive, the closed Space left the picker |
| Re-create the closed Space with Open Folder as New Space | **PASS**: the remaining window was re-adopted and a two-Space group formed again |
| Quit with a dirty editor in a hidden Space (`"files.hotExit": "off"`) | **PASS**: the hidden Space was revealed and its save prompt was visible |
| Quit prompt → Cancel | **PASS**: app kept running, that Space stayed visible, the dirty editor was kept, and <kbd>Cmd</kbd>+<kbd>Q</kbd> prompted again |
| Quit prompt → Don't Save | **PASS**: app quit normally, and that Space's extension host exited cleanly |
| Quit with default hot exit | Expected VS Code behavior: no prompt, dirty editor restored on restart |
| Isolation of extension enablement | As expected: Claude had to be enabled per workspace, consistent with independent workspace extension state |

## Known unsupported / limitations confirmed

| Area | Status |
|---|---|
| Restart grouping | **Known unsupported.** VS Code restores the windows, but they reopen as separate OS windows and Spaces membership is lost |
| Native macOS fullscreen | **Known unsupported.** Switching Spaces does not work correctly in native fullscreen; windowed mode works |
| Claude in-panel "waiting for input" attention | **Known unsupported.** The hidden Space gets no needs-attention marker, because Claude's panel does not emit a VS Code attention signal (dialog or window attention request) |
| Mission Control / App Exposé | **Architectural limitation.** They can show the underlying real Electron windows of hidden Spaces, because each Space is a real window |

## Issues found and fixed after this run

- **Open Folder as New Space label.** The dialog's button showed raw mnemonic markers (`&&Open…`). The label now goes through `mnemonicButtonLabel`, and a unit test covers it.
- **Space picker selection.** The picker highlighted the first other Space instead of the current one. The current Space is now selected initially, and the scripted validator checks this.

## Notes

The real repository names and paths used during dogfooding are intentionally not recorded.

## Screenshots or logs, if any

None committed.
