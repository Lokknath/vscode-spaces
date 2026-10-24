const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

async function generateScreenshots() {
	const outDir = path.join(__dirname, '..', 'docs', 'images');
	if (!fs.existsSync(outDir)) {
		fs.mkdirSync(outDir, { recursive: true });
	}

	const browser = await chromium.launch({ headless: true });
	const page = await browser.newPage({
		viewport: { width: 1400, height: 860 },
		deviceScaleFactor: 2
	});

	// 1. Hero Screenshot Mockup
	const heroHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0d1117;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #cccccc;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 30px;
  }
  .window {
    width: 1320px;
    height: 800px;
    background: #181818;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 25px 70px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.12);
    display: flex;
    flex-direction: column;
  }
  /* Titlebar */
  .titlebar {
    height: 44px;
    background: #1f1f1f;
    border-bottom: 1px solid #2d2d2d;
    display: flex;
    align-items: center;
    padding: 0 16px;
    user-select: none;
    position: relative;
  }
  .traffic-lights {
    display: flex;
    gap: 8px;
    margin-right: 18px;
  }
  .traffic-light {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }
  .close { background: #ff5f56; border: 1px solid #e0443e; }
  .min { background: #ffbd2e; border: 1px solid #dea123; }
  .max { background: #27c93f; border: 1px solid #1aab29; }

  /* Spaces Switcher in Title Bar */
  .spaces-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #2a2a2a;
    padding: 3px 6px;
    border-radius: 6px;
    border: 1px solid #3c3c3c;
  }
  .spaces-badge {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    background: #0078d4;
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    border-radius: 4px;
    letter-spacing: 0.3px;
  }
  .space-pill {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    font-size: 11.5px;
    border-radius: 4px;
    color: #999;
    background: transparent;
    cursor: pointer;
  }
  .space-pill.active {
    background: #383838;
    color: #ffffff;
    font-weight: 500;
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  }
  .space-pill .branch {
    color: #4ec9b0;
    font-size: 10px;
    opacity: 0.9;
  }
  .space-pill.ssh {
    color: #569cd6;
  }
  .space-pill.ssh .host {
    background: #1b3a5b;
    color: #79b8ff;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 9.5px;
    font-weight: 600;
  }
  .space-add {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    color: #aaa;
    font-size: 14px;
    cursor: pointer;
  }
  .space-add:hover {
    background: #444;
    color: #fff;
  }
  .title-center {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .search-box {
    width: 380px;
    height: 26px;
    background: #282828;
    border: 1px solid #3d3d3d;
    border-radius: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 12px;
    color: #999;
  }
  .title-right {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 12px;
    color: #888;
  }
  .quick-switch-hint {
    background: #2b2b2b;
    border: 1px solid #3a3a3a;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10.5px;
    color: #aaa;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  /* Workbench Body */
  .workbench {
    flex: 1;
    display: flex;
    overflow: hidden;
  }
  /* Activity Bar */
  .activity-bar {
    width: 48px;
    background: #181818;
    border-right: 1px solid #282828;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10px 0;
    gap: 16px;
  }
  .activity-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #858585;
    border-radius: 5px;
    position: relative;
  }
  .activity-icon.active {
    color: #ffffff;
  }
  .activity-icon.active::before {
    content: '';
    position: absolute;
    left: -8px;
    top: 6px;
    bottom: 6px;
    width: 2px;
    background: #0078d4;
  }
  .activity-icon svg { width: 20px; height: 20px; fill: currentColor; }
  .badge-dot {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 6px;
    height: 6px;
    background: #38bdf8;
    border-radius: 50%;
  }

  /* Sidebar */
  .sidebar {
    width: 240px;
    background: #181818;
    border-right: 1px solid #282828;
    display: flex;
    flex-direction: column;
    font-size: 12.5px;
  }
  .sidebar-header {
    height: 35px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    color: #bbb;
    border-bottom: 1px solid #222;
  }
  .file-tree {
    padding: 8px 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .tree-item {
    padding: 4px 16px;
    display: flex;
    align-items: center;
    gap: 6px;
    color: #cccccc;
    cursor: pointer;
  }
  .tree-item.folder { font-weight: 500; color: #e1e1e1; }
  .tree-item.active { background: #04395e; color: #fff; }
  .tree-item.nested { padding-left: 28px; }
  .file-icon { width: 14px; height: 14px; opacity: 0.8; }

  /* Main Editor Area */
  .main-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: #1e1e1e;
  }
  .editor-tabs {
    height: 35px;
    background: #181818;
    display: flex;
    align-items: flex-end;
    border-bottom: 1px solid #282828;
  }
  .tab {
    height: 35px;
    padding: 0 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #969696;
    background: #181818;
    border-right: 1px solid #282828;
    border-top: 2px solid transparent;
  }
  .tab.active {
    background: #1e1e1e;
    color: #ffffff;
    border-top: 2px solid #0078d4;
  }
  .editor-view {
    flex: 1;
    padding: 16px 20px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    font-size: 12.5px;
    line-height: 1.6;
    color: #d4d4d4;
    overflow: hidden;
  }
  .line-num { color: #5a5a5a; margin-right: 18px; display: inline-block; width: 24px; text-align: right; }
  .kw { color: #569cd6; }
  .fn { color: #dcdcaa; }
  .str { color: #ce9178; }
  .type { color: #4ec9b0; }
  .cm { color: #6a9955; font-style: italic; }

  /* Bottom Integrated Terminal */
  .terminal-panel {
    height: 230px;
    background: #181818;
    border-top: 1px solid #2b2b2b;
    display: flex;
    flex-direction: column;
  }
  .terminal-header {
    height: 32px;
    background: #181818;
    border-bottom: 1px solid #242424;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
  }
  .term-tabs {
    display: flex;
    gap: 16px;
    font-size: 11.5px;
  }
  .term-tab {
    color: #888;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .term-tab.active {
    color: #fff;
    font-weight: 500;
  }
  .term-indicator {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #38bdf8;
  }
  .terminal-body {
    flex: 1;
    padding: 10px 16px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    line-height: 1.5;
    color: #e0e0e0;
  }
  .prompt { color: #4ec9b0; }
  .branch-tag { color: #ce9178; }
  .term-accent { color: #38bdf8; }

  /* Status Bar */
  .statusbar {
    height: 24px;
    background: #0078d4;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    font-size: 11px;
    user-select: none;
  }
  .status-left, .status-right {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .status-item {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .status-remote {
    background: #107c41;
    padding: 0 8px;
    height: 24px;
    margin-left: -12px;
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
  }
</style>
</head>
<body>
  <div class="window">
    <!-- Titlebar -->
    <div class="titlebar">
      <div class="traffic-lights">
        <div class="traffic-light close"></div>
        <div class="traffic-light min"></div>
        <div class="traffic-light max"></div>
      </div>

      <!-- Spaces Control -->
      <div class="spaces-bar">
        <div class="spaces-badge">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h11A1.5 1.5 0 0 1 15 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13.5v-11zM2.5 2a.5.5 0 0 0-.5.5V5h12V2.5a.5.5 0 0 0-.5-.5h-11zm12 4H2v7.5a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5V6z"/></svg>
          SPACES
        </div>
        <div class="space-pill">
          <span>frontend-app</span>
          <span class="branch">git:(main)</span>
        </div>
        <div class="space-pill active">
          <span>backend-api</span>
          <span class="branch">git:(feature/spaces)</span>
        </div>
        <div class="space-pill ssh">
          <span class="host">SSH</span>
          <span>prod-worker</span>
          <span class="branch">(/opt/backend)</span>
        </div>
        <div class="space-add" title="New Space (⌘⌥N)">+</div>
      </div>

      <div class="title-center">
        <div class="search-box">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/></svg>
          backend-api — VS Code Spaces
        </div>
      </div>

      <div class="title-right">
        <span class="quick-switch-hint">⌘⌥S Switch</span>
        <span class="quick-switch-hint">⌘⌥Tab Previous</span>
      </div>
    </div>

    <!-- Workbench -->
    <div class="workbench">
      <!-- Activity Bar -->
      <div class="activity-bar">
        <div class="activity-icon active">
          <svg viewBox="0 0 16 16"><path d="M14.5 2h-13a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5zm-.5 11H2V3h12v10zM3 4h4v3H3V4zm5 0h5v3H8V4zM3 8h10v4H3V8z"/></svg>
        </div>
        <div class="activity-icon">
          <svg viewBox="0 0 16 16"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1z"/></svg>
        </div>
        <div class="activity-icon">
          <svg viewBox="0 0 16 16"><path d="M11.5 8a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z"/></svg>
        </div>
        <div class="activity-icon">
          <svg viewBox="0 0 16 16"><path d="M4.5 1A2.5 2.5 0 0 0 2 3.5v9A2.5 2.5 0 0 0 4.5 15h7a2.5 2.5 0 0 0 2.5-2.5v-9A2.5 2.5 0 0 0 11.5 1h-7zM3 3.5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 13 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 12.5v-9z"/></svg>
          <div class="badge-dot"></div>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="sidebar">
        <div class="sidebar-header">
          <span>EXPLORER: BACKEND-API</span>
          <span>...</span>
        </div>
        <div class="file-tree">
          <div class="tree-item folder">▾ src</div>
          <div class="tree-item nested folder">▾ controllers</div>
          <div class="tree-item nested active">📄 spacesController.ts</div>
          <div class="tree-item nested">📄 authController.ts</div>
          <div class="tree-item nested folder">▸ services</div>
          <div class="tree-item nested">📄 app.ts</div>
          <div class="tree-item">▸ test</div>
          <div class="tree-item">📄 package.json</div>
          <div class="tree-item">📄 tsconfig.json</div>
        </div>
      </div>

      <!-- Main Area -->
      <div class="main-area">
        <div class="editor-tabs">
          <div class="tab active">
            <span>spacesController.ts</span>
            <span style="opacity: 0.6; font-size: 10px;">✕</span>
          </div>
          <div class="tab">
            <span>authController.ts</span>
          </div>
          <div class="tab">
            <span>app.ts</span>
          </div>
        </div>

        <div class="editor-view">
          <div><span class="line-num">1</span><span class="kw">import</span> { <span class="type">ISpacesMainService</span> } <span class="kw">from</span> <span class="str">'vs/platform/spaces/common/spaces'</span>;</div>
          <div><span class="line-num">2</span><span class="kw">import</span> { <span class="type">CodeWindow</span> } <span class="kw">from</span> <span class="str">'vs/platform/windows/electron-main/windowImpl'</span>;</div>
          <div><span class="line-num">3</span></div>
          <div><span class="line-num">4</span><span class="cm">/**</span></div>
          <div><span class="line-num">5</span><span class="cm"> * Fast space switching with persistent background terminals and extension hosts.</span></div>
          <div><span class="line-num">6</span><span class="cm"> */</span></div>
          <div><span class="line-num">7</span><span class="kw">export class</span> <span class="type">SpacesController</span> {</div>
          <div><span class="line-num">8</span>  <span class="kw">public async</span> <span class="fn">switchSpace</span>(<span class="type">targetSpaceId</span>: <span class="type">string</span>): <span class="type">Promise</span>&lt;<span class="kw">void</span>&gt; {</div>
          <div><span class="line-num">9</span>    <span class="kw">const</span> target = <span class="kw">this</span>.spacesMainService.<span class="fn">getSpace</span>(targetSpaceId);</div>
          <div><span class="line-num">10</span>   <span class="cm">// Seamless zero-reload window transition & background throttling</span></div>
          <div><span class="line-num">11</span>   <span class="kw">await</span> <span class="kw">this</span>.spacesMainService.<span class="fn">switchTo</span>(target.windowId);</div>
          <div><span class="line-num">12</span>   <span class="kw">this</span>.terminalService.<span class="fn">refreshActiveCanvas</span>();</div>
          <div><span class="line-num">13</span> }</div>
          <div><span class="line-num">14</span>}</div>
        </div>

        <!-- Terminal -->
        <div class="terminal-panel">
          <div class="terminal-header">
            <div class="term-tabs">
              <div class="term-tab active">
                <div class="term-indicator"></div>
                <span>1: zsh (dev server)</span>
              </div>
              <div class="term-tab">
                <span>2: claude-code (active)</span>
              </div>
              <div class="term-tab">
                <span>3: SSH: prod-worker</span>
              </div>
            </div>
            <div style="font-size: 11px; color: #777;">
              Background Throttling: Active · 0 Dropped Ticks
            </div>
          </div>
          <div class="terminal-body">
            <div><span class="prompt">lokkki@mbp-spaces</span>:<span class="term-accent">~/backend-api</span> <span class="branch-tag">(feature/spaces)</span>$ ./scripts/test.sh --grep "SpacesMainService"</div>
            <div style="color: #4ec9b0;">[PASS] SpacesMainService: should create and register Space successfully (12ms)</div>
            <div style="color: #4ec9b0;">[PASS] SpacesMainService: should switch active space without disposing window (8ms)</div>
            <div style="color: #4ec9b0;">[PASS] SpacesMainService: should preserve background terminal ptys and extension host (15ms)</div>
            <div style="color: #4ec9b0;">[PASS] RemoteSSH: resolves remote folder over SSH without local fallback (24ms)</div>
            <div style="color: #569cd6; font-weight: bold; margin-top: 4px;">✓ 21 suites passed, 0 failures (360ms total)</div>
            <div style="margin-top: 6px;"><span class="prompt">lokkki@mbp-spaces</span>:<span class="term-accent">~/backend-api</span> <span class="branch-tag">(feature/spaces)</span>$ <span style="display:inline-block; width: 7px; height: 14px; background: #fff; vertical-align: middle;"></span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Status Bar -->
    <div class="statusbar">
      <div class="status-left">
        <div class="status-remote">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h11A1.5 1.5 0 0 1 15 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13.5v-11z"/></svg>
          <span>Spaces: 3 Open (1 SSH)</span>
        </div>
        <div class="status-item">
          <span>⎇ feature/spaces*</span>
        </div>
        <div class="status-item">
          <span>✓ Zero Reload Active</span>
        </div>
      </div>
      <div class="status-right">
        <div class="status-item">
          <span>UTF-8</span>
        </div>
        <div class="status-item">
          <span>TypeScript</span>
        </div>
        <div class="status-item">
          <span>⚡ Throttled Background: 0.1% CPU</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;

	await page.setContent(heroHtml);
	await page.screenshot({ path: path.join(outDir, 'vscode-spaces-hero.png') });
	console.log('Saved vscode-spaces-hero.png');

	// 2. Architecture Diagram Screenshot
	const archHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0d1117;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #e6edf3;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 24px;
  }
  .card {
    width: 1320px;
    height: 780px;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 14px;
    padding: 32px 40px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 24px;
    border-bottom: 1px solid #21262d;
    padding-bottom: 16px;
  }
  .header-left h1 {
    font-size: 24px;
    font-weight: 700;
    color: #58a6ff;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .header-left p {
    font-size: 13px;
    color: #8b949e;
    margin-top: 4px;
  }
  .badge {
    background: #238636;
    color: #fff;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
  }

  .grid {
    display: grid;
    grid-template-columns: 340px 1fr;
    gap: 24px;
    flex: 1;
  }

  /* Single OS Frame Panel */
  .frame-box {
    background: #0d1117;
    border: 1px solid #388bfd;
    border-radius: 10px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    position: relative;
  }
  .frame-title {
    font-size: 14px;
    font-weight: 600;
    color: #58a6ff;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .frame-content {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 14px;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .core-service {
    background: #1f242c;
    border: 1px solid #388bfd44;
    border-radius: 6px;
    padding: 10px;
  }
  .core-service-title {
    font-size: 12px;
    font-weight: 600;
    color: #79c0ff;
  }
  .core-service-desc {
    font-size: 11px;
    color: #8b949e;
    margin-top: 4px;
    line-height: 1.4;
  }

  /* Spaces Lifecycle Columns */
  .spaces-column {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .space-card {
    background: #0d1117;
    border-radius: 10px;
    border: 1px solid #30363d;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .space-card.active-space {
    border: 2px solid #238636;
    box-shadow: 0 4px 20px rgba(35, 134, 54, 0.15);
  }
  .space-card.background-space {
    border: 1px dashed #30363d;
    opacity: 0.88;
  }
  .space-card.remote-space {
    border: 1px solid #1f6feb;
    background: #0b1528;
  }
  .space-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .space-name {
    font-size: 14px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .space-state-tag {
    font-size: 11px;
    padding: 3px 8px;
    border-radius: 6px;
    font-weight: 500;
  }
  .tag-fg { background: #238636; color: #fff; }
  .tag-bg { background: #30363d; color: #8b949e; }
  .tag-remote { background: #1f6feb; color: #fff; }

  .sub-components {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  .comp-box {
    background: #161b22;
    border: 1px solid #21262d;
    border-radius: 6px;
    padding: 10px;
  }
  .comp-label {
    font-size: 10.5px;
    font-weight: 600;
    color: #8b949e;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .comp-val {
    font-size: 12px;
    color: #c9d1d9;
    margin-top: 4px;
    font-weight: 500;
  }
  .comp-meta {
    font-size: 10px;
    color: #7ee787;
    margin-top: 2px;
  }
  .comp-meta.throttled {
    color: #f2cc60;
  }
  .comp-meta.remote {
    color: #79c0ff;
  }
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="header-left">
        <h1>
          <svg width="24" height="24" viewBox="0 0 16 16" fill="currentColor"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h11A1.5 1.5 0 0 1 15 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13.5v-11zM2.5 2a.5.5 0 0 0-.5.5V5h12V2.5a.5.5 0 0 0-.5-.5h-11zm12 4H2v7.5a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5V6z"/></svg>
          VS Code Spaces Architecture
        </h1>
        <p>Independent JS realms & runtimes consolidated behind a single visible OS window</p>
      </div>
      <div class="badge">Production Architecture</div>
    </div>

    <div class="grid">
      <!-- Left: Host & Orchestration -->
      <div class="frame-box">
        <div class="frame-title">
          <span>macOS Desktop Host (Electron Main)</span>
        </div>
        <div class="frame-content">
          <div class="core-service">
            <div class="core-service-title">SpacesMainService</div>
            <div class="core-service-desc">
              Tracks active Spaces, bounds synchronization, simpleFullScreen management, and zero-reload window swapping.
            </div>
          </div>
          <div class="core-service">
            <div class="core-service-title">Resource Optimizer Engine</div>
            <div class="core-service-desc">
              Throttles background renderers and suspends canvas redraws while keeping terminals and tasks running full speed.
            </div>
          </div>
          <div class="core-service">
            <div class="core-service-title">Remote-SSH Bridge & Patcher</div>
            <div class="core-service-desc">
              Bypasses proprietary ExecServer challenge, handles remote TCP tunneling, and patches Minimatch for SSH config includes.
            </div>
          </div>
          <div class="core-service">
            <div class="core-service-title">Global Pty Host Starter</div>
            <div class="core-service-desc">
              Preserves terminal processes keyed by workspace ID. Never disposes shells when hiding windows.
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Spaces Instances -->
      <div class="spaces-column">
        <!-- Space 1: Foreground Active -->
        <div class="space-card active-space">
          <div class="space-header">
            <div class="space-name">
              <span>Space 1: backend-api</span>
              <span style="font-size: 11px; color: #7ee787;">[Visible / Foreground Frame]</span>
            </div>
            <span class="space-state-tag tag-fg">Active Space (60 FPS)</span>
          </div>
          <div class="sub-components">
            <div class="comp-box">
              <div class="comp-label">Renderer Realm</div>
              <div class="comp-val">Full Interactive DOM</div>
              <div class="comp-meta">Focused · Zero Latency</div>
            </div>
            <div class="comp-box">
              <div class="comp-label">Extension Host</div>
              <div class="comp-val">Utility Process #4812</div>
              <div class="comp-meta">LSP / Git Active</div>
            </div>
            <div class="comp-box">
              <div class="comp-label">Terminal / Pty</div>
              <div class="comp-val">zsh + dev server</div>
              <div class="comp-meta">Canvas Rastering ON</div>
            </div>
          </div>
        </div>

        <!-- Space 2: Background Throttled -->
        <div class="space-card background-space">
          <div class="space-header">
            <div class="space-name">
              <span>Space 2: frontend-app</span>
              <span style="font-size: 11px; color: #8b949e;">[Hidden / Preserved State]</span>
            </div>
            <span class="space-state-tag tag-bg">Background Throttled (0.1% CPU)</span>
          </div>
          <div class="sub-components">
            <div class="comp-box">
              <div class="comp-label">Renderer Realm</div>
              <div class="comp-val">Throttled Window</div>
              <div class="comp-meta throttled">Canvas Suspended</div>
            </div>
            <div class="comp-box">
              <div class="comp-label">Extension Host</div>
              <div class="comp-val">Utility Process #4819</div>
              <div class="comp-meta">Fully Preserved (No Reload)</div>
            </div>
            <div class="comp-box">
              <div class="comp-label">Terminal / Pty</div>
              <div class="comp-val">npm run build (watch)</div>
              <div class="comp-meta">Continuous Execution</div>
            </div>
          </div>
        </div>

        <!-- Space 3: Remote SSH -->
        <div class="space-card remote-space">
          <div class="space-header">
            <div class="space-name">
              <span>Space 3: SSH (prod-worker)</span>
              <span style="font-size: 11px; color: #79c0ff;">[Remote Agent Architecture]</span>
            </div>
            <span class="space-state-tag tag-remote">Connected (SSH Tunnel)</span>
          </div>
          <div class="sub-components">
            <div class="comp-box">
              <div class="comp-label">Remote Filesystem</div>
              <div class="comp-val">/opt/backend (Remote)</div>
              <div class="comp-meta remote">No Local Dir Fallback</div>
            </div>
            <div class="comp-box">
              <div class="comp-label">Remote Extension Host</div>
              <div class="comp-val">Remote Agent Linux</div>
              <div class="comp-meta remote">ExecServer Bypassed</div>
            </div>
            <div class="comp-box">
              <div class="comp-label">Remote Terminal</div>
              <div class="comp-val">Remote Bash Shell</div>
              <div class="comp-meta remote">Interactive & Responsive</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;

	await page.setContent(archHtml);
	await page.screenshot({ path: path.join(outDir, 'vscode-spaces-architecture.png') });
	console.log('Saved vscode-spaces-architecture.png');

	await browser.close();
}

generateScreenshots().catch(err => {
	console.error(err);
	process.exit(1);
});
