/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import electron from 'electron';
import { Emitter, Event } from '../../../base/common/event.js';
import { Disposable, DisposableMap, DisposableStore, toDisposable } from '../../../base/common/lifecycle.js';
import { isMacintosh } from '../../../base/common/platform.js';
import { AddFirstParameterToFunctions } from '../../../base/common/types.js';
import { URI, UriComponents } from '../../../base/common/uri.js';
import { IAuxiliaryWindowsMainService } from '../../auxiliaryWindow/electron-main/auxiliaryWindows.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { IEnvironmentMainService } from '../../environment/electron-main/environmentMainService.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { ILifecycleMainService } from '../../lifecycle/electron-main/lifecycleMainService.js';
import { ILogService } from '../../log/common/log.js';
import { useNativeFullScreen } from '../../window/common/window.js';
import { ICodeWindow } from '../../window/electron-main/window.js';
import { IWindowsMainService, OpenContext } from '../../windows/electron-main/windows.js';
import { IStateService } from '../../state/node/state.js';
import { ISingleFolderWorkspaceIdentifier, IWorkspaceIdentifier, isSingleFolderWorkspaceIdentifier, isWorkspaceIdentifier } from '../../workspace/common/workspace.js';
import { ICommonSpacesService, ISpaceOperationResult, ISpacesSnapshot, ISpaceWorkspace, SPACES_AUTO_ADOPT_SETTING, SPACES_RESTORE_ON_STARTUP_SETTING, SpaceOperationResult } from '../common/spaces.js';
import { SpacesModel } from '../common/spacesModel.js';

export const ISpacesMainService = createDecorator<ISpacesMainService>('spacesMainService');

export interface ISpacesMainService extends AddFirstParameterToFunctions<ICommonSpacesService, Promise<unknown> /* only methods, not events */, number | undefined /* window ID */> { }

interface ISpaceFrame {
	readonly bounds: electron.Rectangle;
	readonly maximized: boolean;
}

interface IPersistedSpaceEntry {
	readonly name: string;
	readonly workspace?: { readonly kind: 'folder' | 'workspace'; readonly uri: UriComponents };
	readonly isActive?: boolean;
}

interface IPersistedSpacesState {
	readonly spaces: readonly IPersistedSpaceEntry[];
	readonly lastFrame?: ISpaceFrame;
}

const SPACES_STATE_KEY = 'spaces.state';

/**
 * Hosts Spaces as regular code windows that share one on-screen frame:
 * the active Space's window is shown, all other Space windows are hidden
 * with `BrowserWindow.hide()`.
 *
 * Hiding a window runs none of the unload/load lifecycle, so extension hosts
 * (bound to window load/close in `WindowUtilityProcess`), terminals (killed
 * only on renderer shutdown) and all workbench state of inactive Spaces stay
 * alive.
 */
export class SpacesMainService extends Disposable implements ISpacesMainService {

	declare readonly _serviceBrand: undefined;

	private readonly model = this._register(new SpacesModel());

	private readonly _onDidChangeSpaces = this._register(new Emitter<ISpacesSnapshot>());
	readonly onDidChangeSpaces = this._onDidChangeSpaces.event;

	private readonly windowListeners = this._register(new DisposableMap<number, DisposableStore>());

	/** Frame of the most recently visible Space, used when the active Space window is gone. */
	private lastFrame: ISpaceFrame | undefined;

	/** Auxiliary windows (e.g. editors moved into a new window) hidden together with their Space, by Space window id. */
	private readonly hiddenAuxiliaryWindows = new Map<number, number[]>();

	/**
	 * Space whose window is being destroyed after its renderer crashed. When the
	 * user picks "Reopen", the replacement window opens before the crashed
	 * window closes and takes over the Space.
	 */
	private destroyedSpace: { readonly spaceId: string; readonly windowId: number; readonly frame: ISpaceFrame | undefined } | undefined;

	constructor(
		@IWindowsMainService private readonly windowsMainService: IWindowsMainService,
		@IAuxiliaryWindowsMainService private readonly auxiliaryWindowsMainService: IAuxiliaryWindowsMainService,
		@IEnvironmentMainService private readonly environmentMainService: IEnvironmentMainService,
		@ILifecycleMainService private readonly lifecycleMainService: ILifecycleMainService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ILogService private readonly logService: ILogService,
		@IStateService private readonly stateService?: IStateService
	) {
		super();

		this._register(this.model.onDidChange(() => {
			this._onDidChangeSpaces.fire(this.model.snapshot());
			this.persistSpacesState();
		}));
		this._register(this.windowsMainService.onDidOpenWindow(window => this.onDidOpenWindow(window)));
		if (this.lifecycleMainService?.onWillShutdown) {
			this._register(this.lifecycleMainService.onWillShutdown(() => this.persistSpacesState()));
		}
		if (electron.app?.on) {
			const beforeQuitHandler = () => this.persistSpacesState();
			electron.app.on('before-quit', beforeQuitHandler);
			this._register(toDisposable(() => {
				electron.app.removeListener('before-quit', beforeQuitHandler);
			}));
		}
	}

	async getSpaces(windowId: number | undefined): Promise<ISpacesSnapshot> {
		return this.model.snapshot();
	}

	async addCurrentWindowAsSpace(windowId: number | undefined): Promise<ISpaceOperationResult> {
		const window = this.getSupportedWindow(windowId);
		if (!window) {
			return { result: SpaceOperationResult.UnsupportedWindow };
		}

		return this.adoptAsActiveSpace(window);
	}

	async createEmptySpace(windowId: number | undefined): Promise<ISpaceOperationResult> {
		return this.openAsSpace(windowId, () => this.windowsMainService.openEmptyWindow({
			context: OpenContext.API,
			contextWindowId: windowId
		}));
	}

	async openFolderAsSpace(windowId: number | undefined, folderUri: UriComponents): Promise<ISpaceOperationResult> {
		return this.openAsSpace(windowId, () => this.windowsMainService.open({
			context: OpenContext.API,
			contextWindowId: windowId,
			cli: this.environmentMainService.args,
			urisToOpen: [{ folderUri: URI.revive(folderUri) }],
			forceNewWindow: true
		}));
	}

	async openWorkspaceAsSpace(windowId: number | undefined, workspaceUri: UriComponents): Promise<ISpaceOperationResult> {
		return this.openAsSpace(windowId, () => this.windowsMainService.open({
			context: OpenContext.API,
			contextWindowId: windowId,
			cli: this.environmentMainService.args,
			urisToOpen: [{ workspaceUri: URI.revive(workspaceUri) }],
			forceNewWindow: true
		}));
	}

	async switchToSpace(windowId: number | undefined, spaceId: string): Promise<ISpaceOperationResult> {
		return this.activate(spaceId);
	}

	async closeSpace(windowId: number | undefined, spaceId: string): Promise<ISpaceOperationResult> {
		const space = this.model.getSpace(spaceId);
		const window = space ? this.windowsMainService.getWindowById(space.windowId) : undefined;
		if (!space || !window?.win) {
			return { result: SpaceOperationResult.UnknownSpace };
		}

		// Show the Space first so that a veto dialog (e.g. unsaved changes) is visible
		const activation = this.activate(spaceId);
		if (activation.result !== SpaceOperationResult.Ok) {
			return activation;
		}

		// Regular window close: goes through the lifecycle and may be vetoed.
		// Removal and activation of the next Space happen in `onDidCloseWindow`.
		window.win.close();

		return { result: SpaceOperationResult.Ok, space };
	}

	async renameSpace(windowId: number | undefined, spaceId: string, name: string): Promise<ISpaceOperationResult> {
		if (!this.model.rename(spaceId, name)) {
			return { result: SpaceOperationResult.UnknownSpace };
		}

		return { result: SpaceOperationResult.Ok, space: this.model.getSpace(spaceId) };
	}

	async revealCurrentSpace(windowId: number | undefined): Promise<void> {
		const space = typeof windowId === 'number' ? this.model.getSpaceByWindowId(windowId) : undefined;
		if (space && space.state !== 'active') {
			this.activate(space.id);
		}
	}

	async requestAttention(windowId: number | undefined): Promise<void> {
		const space = typeof windowId === 'number' ? this.model.getSpaceByWindowId(windowId) : undefined;
		if (space) {
			this.markNeedsAttention(space.id);
		}
	}

	private markNeedsAttention(spaceId: string): void {
		if (this.model.setNeedsAttention(spaceId)) {
			this.logService.trace(`[spaces] Space ${spaceId} needs attention`);

			// Tri-factor attention notification: Trigger dock bounce or frame flash
			if (isMacintosh && electron.app.dock) {
				electron.app.dock.bounce('informational');
			} else {
				const activeWin = this.getActiveSpaceWindow()?.win;
				if (activeWin && !activeWin.isDestroyed()) {
					activeWin.flashFrame(true);
				}
			}
		}
	}

	private async openAsSpace(callerWindowId: number | undefined, open: () => Promise<ICodeWindow[]>): Promise<ISpaceOperationResult> {

		// The window that runs the first Spaces command becomes a Space itself
		const callerWindow = this.getSupportedWindow(callerWindowId);
		if (callerWindow) {
			const adoption = this.adoptAsActiveSpace(callerWindow);
			if (adoption.result !== SpaceOperationResult.Ok) {
				return adoption;
			}
		}

		const [window] = await open();
		if (!window?.win || !this.isSupportedWindow(window)) {
			return { result: SpaceOperationResult.OpenFailed };
		}

		const space = this.adopt(window);

		return this.activate(space.id);
	}

	/**
	 * Adds the window as Space and makes it the active one without moving it:
	 * the window keeps its own frame and the previously active Space is hidden.
	 */
	private adoptAsActiveSpace(window: ICodeWindow): ISpaceOperationResult {
		const space = this.adopt(window);

		return this.activate(space.id, { keepTargetFrame: true });
	}

	private adopt(window: ICodeWindow) {
		const existing = this.model.getSpaceByWindowId(window.id);
		if (existing) {
			return existing;
		}

		const space = this.model.add({ windowId: window.id, workspace: toSpaceWorkspace(window.openedWorkspace) });
		this.logService.info(`[spaces] window ${window.id} added as Space '${space.name}' (${space.id})`);

		this.registerWindowListeners(window, space.id);

		return space;
	}

	private registerWindowListeners(window: ICodeWindow, spaceId: string): void {
		const disposables = new DisposableStore();

		// A hidden Space that gets focused by any other route (window switcher,
		// opening a file into it, dock, CLI) becomes the active Space. Programmatic
		// focus of a hidden window emits no Electron events on macOS, so listen
		// on the window's own focus request; the native `focus` event covers
		// the user focusing the window directly.
		disposables.add(window.onWillFocus(() => this.onDidRevealWindow(window)));

		// Attention requests (dock bounce / taskbar flash, e.g. chat waiting for
		// input or a finished task) of a hidden Space are surfaced in the Spaces UI
		disposables.add(window.onDidRequestAttention(() => this.markNeedsAttention(spaceId)));

		const win = window.win;
		if (win) {
			disposables.add(Event.fromNodeEventEmitter(win, 'focus')(() => this.onDidRevealWindow(window)));

			// Remember the frame before the window is destroyed so the next Space can take its place
			disposables.add(Event.fromNodeEventEmitter(win, 'close')(() => {
				if (this.model.getSpaceByWindowId(window.id)?.state === 'active' && !win.isDestroyed()) {
					this.lastFrame = captureFrame(win);
				}
			}));
		}

		disposables.add(window.onDidDestroy(() => {
			this.destroyedSpace = { spaceId, windowId: window.id, frame: win && !win.isDestroyed() ? captureFrame(win) : undefined };
		}));
		disposables.add(window.onWillLoad(e => this.model.updateWorkspace(spaceId, toSpaceWorkspace(e.workspace))));
		disposables.add(window.onDidClose(() => this.onDidCloseWindow(window.id)));

		this.windowListeners.set(window.id, disposables);
	}

	private activate(spaceId: string, options?: { keepTargetFrame?: boolean }): ISpaceOperationResult {
		const target = this.model.getSpace(spaceId);
		const targetWindow = target ? this.windowsMainService.getWindowById(target.windowId) : undefined;
		const targetWin = targetWindow?.win;
		if (!target || !targetWindow || !targetWin || targetWin.isDestroyed()) {
			return { result: SpaceOperationResult.UnknownSpace };
		}

		const previousWindow = this.getActiveSpaceWindow();
		if (previousWindow === targetWindow) {
			this.awakenSpace(targetWindow);
			if (!targetWin.isVisible()) {
				targetWin.show();
				this.showAuxiliaryWindows(targetWindow.id);
			}
			targetWindow.focus();

			return { result: SpaceOperationResult.Ok, space: target };
		}

		const previousWin = previousWindow?.win && !previousWindow.win.isDestroyed() ? previousWindow.win : undefined;

		// Update the model first: the `show` and `focus` events fired below
		// must see the target as already active
		const activation = this.model.activate(target.id);
		this.logService.trace(`[spaces] switching from '${activation?.previous?.name}' to '${target.name}'`);

		if (!options?.keepTargetFrame) {
			const frame = previousWin ? captureFrame(previousWin) : this.lastFrame;
			if (frame) {
				applyFrame(targetWin, frame);
			}
		}

		// Awaken target Space to full frame rate and active rendering
		this.awakenSpace(targetWindow);

		// Show the target before hiding the previous Space so that the
		// application never ends up without a visible window mid-switch
		if (!targetWin.isVisible()) {
			targetWin.show();
		}
		this.showAuxiliaryWindows(targetWindow.id);

		if (previousWindow && previousWin?.isVisible()) {
			this.lastFrame = captureFrame(previousWin);
			this.hideAuxiliaryWindows(previousWindow.id);
			if (previousWin.isFullScreen() && !targetWin.isFullScreen()) {
				try {
					targetWin.setFullScreen(true);
				} catch {
					// Ignore fullscreen toggle errors
				}
			}
			previousWin.hide();
			// Hibernate inactive Space to free GPU/CPU and trim memory
			this.hibernateSpace(previousWindow);
		}

		targetWindow.focus();

		return { result: SpaceOperationResult.Ok, space: this.model.getSpace(target.id) };
	}

	private hibernateSpace(window: ICodeWindow): void {
		const win = window.win;
		if (!win || win.isDestroyed()) {
			return;
		}

		try {
			// 1. Enable Chromium background throttling for hidden window
			win.webContents.setBackgroundThrottling?.(true);

			// 2. Notify renderer to pause animations and switch xterm to headless buffer
			window.send('vscode:spaces:stateChange', { state: 'inactive' });
		} catch (error) {
			this.logService.warn(`[spaces] failed to hibernate window ${window.id}`, error);
		}
	}

	private awakenSpace(window: ICodeWindow): void {
		const win = window.win;
		if (!win || win.isDestroyed()) {
			return;
		}

		try {
			// 1. Restore normal background throttling
			win.webContents.setBackgroundThrottling?.(false);

			// 2. Notify renderer to resume animations and active xterm rendering
			window.send('vscode:spaces:stateChange', { state: 'active' });
		} catch (error) {
			this.logService.warn(`[spaces] failed to awaken window ${window.id}`, error);
		}
	}

	/**
	 * Auxiliary windows are independent Electron windows (not child windows),
	 * so they have to follow the visibility of their Space explicitly.
	 */
	private hideAuxiliaryWindows(spaceWindowId: number): void {
		const hidden: number[] = [];
		for (const auxiliaryWindow of this.auxiliaryWindowsMainService.getWindows()) {
			const win = auxiliaryWindow.parentId === spaceWindowId ? auxiliaryWindow.win : null;
			if (win && !win.isDestroyed() && win.isVisible() && !win.isMinimized()) {
				win.hide();
				hidden.push(auxiliaryWindow.id);
			}
		}

		this.hiddenAuxiliaryWindows.set(spaceWindowId, hidden);
	}

	private showAuxiliaryWindows(spaceWindowId: number): void {
		const hidden = this.hiddenAuxiliaryWindows.get(spaceWindowId);
		this.hiddenAuxiliaryWindows.delete(spaceWindowId);
		if (!hidden?.length) {
			return;
		}

		for (const auxiliaryWindow of this.auxiliaryWindowsMainService.getWindows()) {
			const win = hidden.includes(auxiliaryWindow.id) ? auxiliaryWindow.win : null;
			if (win && !win.isDestroyed() && !win.isVisible()) {
				win.showInactive(); // keep focus on the Space's main window
			}
		}
	}

	private onDidRevealWindow(window: ICodeWindow): void {
		const space = this.model.getSpaceByWindowId(window.id);
		if (space && space.state !== 'active') {
			this.activate(space.id);
		}
	}

	/**
	 * "Reopen" after a renderer crash destroys the crashed window and opens a
	 * new one for the same workspace (`CodeWindow.destroyWindow`). Move the
	 * Space to that window instead of dropping it, so that the replacement does
	 * not end up as a separate window next to another revealed Space.
	 */
	private onDidOpenWindow(window: ICodeWindow): void {
		const destroyed = this.destroyedSpace;
		this.destroyedSpace = undefined;
		if (destroyed && this.isSupportedWindow(window)) {
			const space = this.model.getSpace(destroyed.spaceId);
			if (space && space.windowId === destroyed.windowId) {
				this.windowListeners.deleteAndDispose(destroyed.windowId);
				this.hiddenAuxiliaryWindows.delete(destroyed.windowId);
				this.model.rebindWindow(space.id, window.id);
				this.registerWindowListeners(window, space.id);
				this.logService.info(`[spaces] Space '${space.name}' (${space.id}) moved from crashed window ${destroyed.windowId} to window ${window.id}`);

				if (space.state === 'active') {
					if (destroyed.frame && window.win) {
						applyFrame(window.win, destroyed.frame);
					}
				} else {
					this.activate(space.id); // the replacement window opens visible
				}
				return;
			}
		}

		if (!this.isSupportedWindow(window)) {
			return;
		}

		if (this.model.getSpaceByWindowId(window.id)) {
			return;
		}

		const restoreOnStartup = this.configurationService.getValue<boolean>(SPACES_RESTORE_ON_STARTUP_SETTING) === true;
		const autoAdopt = this.configurationService.getValue<boolean>(SPACES_AUTO_ADOPT_SETTING) === true;

		if (!restoreOnStartup && !autoAdopt) {
			return;
		}

		this.tryAdoptOrRestoreWindow(window, autoAdopt, restoreOnStartup);
	}

	private tryAdoptOrRestoreWindow(window: ICodeWindow, autoAdopt: boolean, restoreOnStartup: boolean): void {
		const currentSnapshot = this.model.snapshot();
		const savedState = restoreOnStartup ? this.stateService?.getItem<IPersistedSpacesState>(SPACES_STATE_KEY) : undefined;
		const windowWorkspace = toSpaceWorkspace(window.openedWorkspace);

		// Guard: If this is an initial startup, and an empty space already exists, and this window is a duplicate empty window with no unsaved files,
		// close it to avoid spawning duplicate empty windows and wasting ~500MB RAM.
		if (!windowWorkspace && currentSnapshot.spaces.some(s => !s.workspace) && window.config?.initialStartup && !window.backupPath) {
			this.logService.info(`[spaces] closing duplicate empty window ${window.id} on startup`);
			window.win?.destroy();
			return;
		}

		if (savedState && savedState.spaces.length > 0) {
			const savedEntry = savedState.spaces.find(entry => {
				if (!entry.workspace && !windowWorkspace) {
					return true; // Match empty spaces!
				}
				if (!entry.workspace || !windowWorkspace) {
					return false;
				}
				return entry.workspace.kind === windowWorkspace.kind &&
					URI.revive(entry.workspace.uri).toString() === windowWorkspace.uri.toString();
			});

			if (savedEntry) {
				if (savedEntry.isActive || currentSnapshot.spaces.length === 0) {
					const space = this.adopt(window);
					if (savedState.lastFrame && window.win && !savedState.lastFrame.maximized) {
						applyFrame(window.win, savedState.lastFrame);
					}
					this.activate(space.id, { keepTargetFrame: !savedState.lastFrame });
				} else {
					this.adopt(window);
					const activeWin = this.getActiveSpaceWindow()?.win;
					if (activeWin && !activeWin.isDestroyed() && window.win && !window.win.isDestroyed()) {
						applyFrame(window.win, captureFrame(activeWin));
						window.win.hide();
						this.hibernateSpace(window);
					}
				}
				return;
			}
		}

		if (autoAdopt) {
			const isInitialStartup = window.config?.initialStartup;
			if (currentSnapshot.spaces.length === 0) {
				this.adoptAsActiveSpace(window);
			} else if (isInitialStartup) {
				// Secondary window during startup: adopt into the background without stealing focus or flipping windows
				this.adopt(window);
				const activeWin = this.getActiveSpaceWindow()?.win;
				if (activeWin && !activeWin.isDestroyed() && window.win && !window.win.isDestroyed()) {
					applyFrame(window.win, captureFrame(activeWin));
					window.win.hide();
					this.hibernateSpace(window);
				}
			} else {
				const space = this.adopt(window);
				this.activate(space.id);
			}
		}
	}

	private persistSpacesState(): void {
		if (!this.stateService) {
			return;
		}

		try {
			const snapshot = this.model.snapshot();
			if (snapshot.spaces.length === 0) {
				this.stateService.removeItem(SPACES_STATE_KEY);
				return;
			}

			const spaces: IPersistedSpaceEntry[] = snapshot.spaces.map(space => ({
				name: space.name,
				workspace: space.workspace ? { kind: space.workspace.kind, uri: space.workspace.uri.toJSON() } : undefined,
				isActive: space.id === snapshot.activeSpaceId
			}));

			const state: IPersistedSpacesState = {
				spaces,
				lastFrame: this.lastFrame
			};

			this.stateService.setItem(SPACES_STATE_KEY, state);
		} catch (error) {
			this.logService.warn('[spaces] failed to persist spaces state', error);
		}
	}

	private onDidCloseWindow(windowId: number): void {
		this.windowListeners.deleteAndDispose(windowId);
		this.hiddenAuxiliaryWindows.delete(windowId);
		if (this.destroyedSpace?.windowId === windowId) {
			this.destroyedSpace = undefined; // closed instead of reopened
		}

		const space = this.model.getSpaceByWindowId(windowId);
		if (!space) {
			return;
		}

		// When the entire app is quitting, do NOT remove spaces from the model or state,
		// so that when the app restarts, all spaces are cleanly restored!
		if (this.lifecycleMainService.quitRequested) {
			return;
		}

		const removal = this.model.remove(space.id);
		this.logService.info(`[spaces] Space '${space.name}' (${space.id}) closed`);

		// Do not flash hidden Spaces while the application is quitting
		if (removal?.nextActiveSpace && !this.lifecycleMainService.quitRequested) {
			this.activate(removal.nextActiveSpace.id);
		}
	}

	private getActiveSpaceWindow(): ICodeWindow | undefined {
		const active = this.model.getActiveSpace();

		return active ? this.windowsMainService.getWindowById(active.windowId) : undefined;
	}

	private getSupportedWindow(windowId: number | undefined): ICodeWindow | undefined {
		const window = typeof windowId === 'number' ? this.windowsMainService.getWindowById(windowId) : undefined;

		return window && this.isSupportedWindow(window) ? window : undefined;
	}

	private isSupportedWindow(window: ICodeWindow): boolean {
		return !!window.win
			&& !window.config?.isSessionsWindow
			&& !window.isExtensionDevelopmentHost
			&& !window.isExtensionTestHost;
	}

	private isInNativeFullScreen(window: ICodeWindow): boolean {
		return isMacintosh && window.isFullScreen && useNativeFullScreen(this.configurationService);
	}
}

function toSpaceWorkspace(workspace: IWorkspaceIdentifier | ISingleFolderWorkspaceIdentifier | undefined): ISpaceWorkspace | undefined {
	if (isSingleFolderWorkspaceIdentifier(workspace)) {
		return { kind: 'folder', uri: workspace.uri };
	}

	if (isWorkspaceIdentifier(workspace)) {
		return { kind: 'workspace', uri: workspace.configPath };
	}

	return undefined;
}

function captureFrame(win: electron.BrowserWindow): ISpaceFrame {
	return { bounds: win.getNormalBounds(), maximized: win.isMaximized() };
}

function applyFrame(win: electron.BrowserWindow, frame: ISpaceFrame): void {
	const curBounds = win.getNormalBounds();
	const curMaximized = win.isMaximized();

	if (curMaximized === frame.maximized &&
		curBounds.x === frame.bounds.x && curBounds.y === frame.bounds.y &&
		curBounds.width === frame.bounds.width && curBounds.height === frame.bounds.height) {
		return;
	}

	if (frame.maximized) {
		if (curBounds.x !== frame.bounds.x || curBounds.y !== frame.bounds.y ||
			curBounds.width !== frame.bounds.width || curBounds.height !== frame.bounds.height) {
			win.setBounds(frame.bounds);
		}
		if (!win.isMaximized()) {
			win.maximize();
		}
	} else {
		if (win.isMaximized()) {
			win.unmaximize();
		}
		if (curBounds.x !== frame.bounds.x || curBounds.y !== frame.bounds.y ||
			curBounds.width !== frame.bounds.width || curBounds.height !== frame.bounds.height) {
			win.setBounds(frame.bounds);
		}
	}
}
