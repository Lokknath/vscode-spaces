# SSH Spaces & Remote Development Guide

VS Code Spaces supports remote development over SSH. Each remote workspace runs inside its own isolated **Space**, providing seamless multitasking between local projects and remote servers within a single window frame.

---

## 1. How SSH Spaces Work

When you connect to an SSH Space:
1. **Direct Remote Resolution**: The active Space resolves the remote workspace folder directly over the SSH connection (`vscode-remote://ssh-remote+<host><path>`), without falling back to local paths or opening the repository root.
2. **Dedicated Remote Extension Host**: The remote server runs its own extension host utility process connected through an SSH tunnel.
3. **Persistent Remote Ptys**: Integrated terminal sessions spawn remote interactive shells (e.g. `bash`, `zsh`) that stay alive and running when switching between Spaces.
4. **Zero Reload Swapping**: Switching back to an SSH Space instantly restores the remote editor state and refreshes the terminal canvas raster.

---

## 2. Key Architecture & Fixes in VS Code Spaces

### 2.1 Bypassing the Proprietary ExecServer Challenge (VSDA)
- **Problem**: Microsoft's Remote-SSH extension defaults to `useExecServer = true`. In ExecServer mode, the remote server binary requires Microsoft's proprietary `vsda` (Visual Studio Data Authentication) signing challenge. On open-source Code OSS builds, this causes `CodeError(ServerAuthRequired)` and fails connection.
- **Spaces Solution**:
  - Automatically sets `remote.SSH.useExecServer = false` in user settings.
  - Runtime auto-patching of `useExecServer` in the Remote-SSH extension to fall back to standard SSH port forwarding and connection token authentication.
  - Automatic fallback in `remoteAgentConnection.ts` to `connectionToken` when proprietary signing is unavailable.

### 2.2 Minimatch Wildcard Parsing for SSH Config
- **Problem**: Parsing SSH config files containing `Include /etc/ssh/ssh_config.d/*` threw `TypeError: (r.Minimatch || ...) is not a constructor` because of an incompatible export in bundled extension modules.
- **Spaces Solution**:
  - `SpacesMainService` automatically detects and patches `Minimatch` export assignments (`t.Minimatch = t.minimatch.Minimatch = x`), ensuring all system SSH configuration wildcards resolve cleanly.

### 2.3 Terminal Canvas Throttling & Blank Screen Fix
- **Problem**: When a Space is placed in the background, Chromium's compositor throttles canvas render loops. Upon switching back, the `@xterm/xterm` canvas raster would stay unpainted (blank, black screen).
- **Spaces Solution**:
  - On Space switch, `SpacesContribution` immediately calls `xterm.raw.refresh(0, xterm.raw.rows - 1)` alongside layout updates.
  - Forces an immediate DOM and canvas redraw of the terminal viewport, providing instantaneous interactive rendering without lag.

### 2.4 macOS Shell Environment Resolution Acceleration
- **Problem**: Spawning remote processes could hang for up to 10 seconds waiting for `resolveShellEnv()` on complex macOS shell configurations.
- **Spaces Solution**:
  - Lowered the fallback timeout to 2.5 seconds when `process.env.PATH` is populated, avoiding delays during extension host bootstrapping.

---

## 3. Quick Start: Connecting to an SSH Space

### Connecting via CLI
To open an SSH target as a Space from the terminal:
```bash
code-spaces --remote ssh-remote+<hostname> /path/to/remote/project
```
Example:
```bash
code-spaces --remote ssh-remote+prod-server /var/www/my-app
```

### Connecting from the Workbench UI
1. Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Linux/Windows) to open the Command Palette.
2. Select **Remote-SSH: Connect to Host...**.
3. Choose your configured host from `~/.ssh/config` or enter `user@host`.
4. VS Code Spaces will open the remote host as a new Space in the title bar.

---

## 4. Useful Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd+Alt+S` | Show Spaces Quick Pick switcher |
| `Cmd+Alt+Tab` | Toggle between current and previous Space |
| `Cmd+Alt+N` | Add / Open a new Space |
| `Cmd+Shift+P` → *Spaces: Close Inactive Spaces* | Close all background Spaces and retain only the current active Space |
