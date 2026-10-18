/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { mnemonicButtonLabel } from '../../../../base/common/labels.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { URI } from '../../../../base/common/uri.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { basename } from '../../../../base/common/resources.js';
import { IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { INativeHostService } from '../../../../platform/native/common/native.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IQuickInputButton, IQuickInputService, IQuickPickItem, IQuickPickSeparator } from '../../../../platform/quickinput/common/quickInput.js';
import { ISpace, ISpaceOperationResult, ISpacesService, SPACES_ENABLED_SETTING, SpaceOperationResult } from '../../../../platform/spaces/common/spaces.js';
import { WORKSPACE_FILTER } from '../../../../platform/workspace/common/workspace.js';
import { ITerminalService } from '../../terminal/browser/terminal.js';

export const SPACES_CATEGORY = localize2('spaces', "Spaces");

export const SpacesEnabledContext = ContextKeyExpr.equals(`config.${SPACES_ENABLED_SETTING}`, true);

export const enum SpacesCommandId {
	AddNewSpace = 'workbench.action.spaces.addNewSpace',
	TitleBarNewSpace = 'workbench.action.spaces.titleBarNewSpace',
	RemoveSpace = 'workbench.action.spaces.removeSpace',
	NewEmptySpace = 'workbench.action.spaces.newEmptySpace',
	OpenFolderAsNewSpace = 'workbench.action.spaces.openFolderAsNewSpace',
	OpenWorkspaceAsNewSpace = 'workbench.action.spaces.openWorkspaceAsNewSpace',
	AddCurrentWindowAsSpace = 'workbench.action.spaces.addCurrentWindowAsSpace',
	SwitchSpace = 'workbench.action.spaces.switchSpace',
	CloseCurrentSpace = 'workbench.action.spaces.closeCurrentSpace',
	RenameCurrentSpace = 'workbench.action.spaces.renameCurrentSpace',
	ListSpaces = 'workbench.action.spaces.listSpaces',
	TitleBarPicker = 'workbench.action.spaces.titleBarPicker',
	OpenRemoteSSHSpace = 'workbench.action.spaces.openRemoteSSHSpace',
	OpenOnGitHub = 'workbench.action.spaces.openOnGitHub',
	CreatePullRequest = 'workbench.action.spaces.createPullRequest',
	CreateWorktreeSpace = 'workbench.action.spaces.createWorktreeSpace',
	SwitchToSpace1 = 'workbench.action.spaces.switchToSpace1',
	SwitchToSpace2 = 'workbench.action.spaces.switchToSpace2',
	SwitchToSpace3 = 'workbench.action.spaces.switchToSpace3',
	SwitchToSpace4 = 'workbench.action.spaces.switchToSpace4',
	SwitchToSpace5 = 'workbench.action.spaces.switchToSpace5',
	SwitchToSpace6 = 'workbench.action.spaces.switchToSpace6',
	SwitchToSpace7 = 'workbench.action.spaces.switchToSpace7',
	SwitchToSpace8 = 'workbench.action.spaces.switchToSpace8',
	SwitchToSpace9 = 'workbench.action.spaces.switchToSpace9'
}

function reportResult(notificationService: INotificationService, operation: ISpaceOperationResult): boolean {
	switch (operation.result) {
		case SpaceOperationResult.Ok:
			return true;
		case SpaceOperationResult.NativeFullScreen:
			return true;
		case SpaceOperationResult.UnsupportedWindow:
			notificationService.info(localize('spaces.unsupportedWindow', "Spaces are not supported in this window."));
			return false;
		case SpaceOperationResult.UnknownSpace:
			notificationService.warn(localize('spaces.unknownSpace', "The Space no longer exists."));
			return false;
		case SpaceOperationResult.OpenFailed:
			notificationService.error(localize('spaces.openFailed', "Unable to open the Space."));
			return false;
	}
}

function getCurrentSpace(spaces: readonly ISpace[], windowId: number): ISpace | undefined {
	return spaces.find(space => space.windowId === windowId);
}

export class NewEmptySpaceAction extends Action2 {
	constructor() {
		super({
			id: SpacesCommandId.NewEmptySpace,
			title: localize2('spaces.newEmptySpace', "New Empty Space"),
			category: SPACES_CATEGORY,
			precondition: SpacesEnabledContext,
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const spacesService = accessor.get(ISpacesService);
		const notificationService = accessor.get(INotificationService);

		reportResult(notificationService, await spacesService.createEmptySpace());
	}
}

export class OpenFolderAsNewSpaceAction extends Action2 {
	constructor() {
		super({
			id: SpacesCommandId.OpenFolderAsNewSpace,
			title: localize2('spaces.openFolderAsNewSpace', "Open Folder as New Space..."),
			category: SPACES_CATEGORY,
			precondition: SpacesEnabledContext,
			f1: true
		});
	}

	/**
	 * @param folder optional folder to open without showing a dialog (for automation)
	 */
	async run(accessor: ServicesAccessor, folder?: URI | string): Promise<void> {
		const spacesService = accessor.get(ISpacesService);
		const fileDialogService = accessor.get(IFileDialogService);
		const notificationService = accessor.get(INotificationService);

		let folderUri = typeof folder === 'string' ? URI.file(folder) : URI.isUri(folder) ? folder : undefined;
		if (!folderUri) {
			const picked = await fileDialogService.showOpenDialog({
				title: localize('spaces.pickFolder', "Open Folder as New Space"),
				openLabel: mnemonicButtonLabel(localize({ key: 'spaces.openSpace', comment: ['&& denotes a mnemonic'] }, "&&Open as Space")),
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				defaultUri: await fileDialogService.defaultFolderPath()
			});
			folderUri = picked?.[0];
		}

		if (folderUri) {
			reportResult(notificationService, await spacesService.openFolderAsSpace(folderUri));
		}
	}
}

export class OpenWorkspaceAsNewSpaceAction extends Action2 {
	constructor() {
		super({
			id: SpacesCommandId.OpenWorkspaceAsNewSpace,
			title: localize2('spaces.openWorkspaceAsNewSpace', "Open Workspace as New Space..."),
			category: SPACES_CATEGORY,
			precondition: SpacesEnabledContext,
			f1: true
		});
	}

	/**
	 * @param workspace optional `.code-workspace` file to open without showing a dialog (for automation)
	 */
	async run(accessor: ServicesAccessor, workspace?: URI | string): Promise<void> {
		const spacesService = accessor.get(ISpacesService);
		const fileDialogService = accessor.get(IFileDialogService);
		const notificationService = accessor.get(INotificationService);

		let workspaceUri = typeof workspace === 'string' ? URI.file(workspace) : URI.isUri(workspace) ? workspace : undefined;
		if (!workspaceUri) {
			const picked = await fileDialogService.showOpenDialog({
				title: localize('spaces.pickWorkspace', "Open Workspace as New Space"),
				openLabel: mnemonicButtonLabel(localize({ key: 'spaces.openSpace', comment: ['&& denotes a mnemonic'] }, "&&Open as Space")),
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
				filters: WORKSPACE_FILTER,
				defaultUri: await fileDialogService.defaultWorkspacePath()
			});
			workspaceUri = picked?.[0];
		}

		if (workspaceUri) {
			reportResult(notificationService, await spacesService.openWorkspaceAsSpace(workspaceUri));
		}
	}
}

export class AddCurrentWindowAsSpaceAction extends Action2 {
	constructor() {
		super({
			id: SpacesCommandId.AddCurrentWindowAsSpace,
			title: localize2('spaces.addCurrentWindowAsSpace', "Add Current Window as Space"),
			category: SPACES_CATEGORY,
			precondition: SpacesEnabledContext,
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const spacesService = accessor.get(ISpacesService);
		const notificationService = accessor.get(INotificationService);

		reportResult(notificationService, await spacesService.addCurrentWindowAsSpace());
	}
}

export class SwitchSpaceAction extends Action2 {
	constructor() {
		super({
			id: SpacesCommandId.SwitchSpace,
			title: localize2('spaces.switchSpace', "Switch Space..."),
			category: SPACES_CATEGORY,
			precondition: SpacesEnabledContext,
			f1: true,
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyS
			}
		});
	}

	/**
	 * @param target optional Space id or name to switch to without showing the picker (for automation)
	 */
	async run(accessor: ServicesAccessor, target?: string): Promise<void> {
		if (typeof target === 'string') {
			const spacesService = accessor.get(ISpacesService);
			const notificationService = accessor.get(INotificationService);

			const { spaces } = await spacesService.getSpaces();
			const space = spaces.find(space => space.id === target) ?? spaces.find(space => space.name === target);
			reportResult(notificationService, space ? await spacesService.switchToSpace(space.id) : { result: SpaceOperationResult.UnknownSpace });
			return;
		}

		return showSpacesPicker(accessor, 'switch');
	}
}

export class TitleBarSpacesPickerAction extends Action2 {
	constructor() {
		super({
			id: SpacesCommandId.TitleBarPicker,
			title: localize2('spaces.titleBarPicker', "Spaces"),
			f1: false,
			precondition: SpacesEnabledContext,
			menu: {
				id: MenuId.TitleBarAdjacentCenter,
				order: -2000,
				when: SpacesEnabledContext
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		return showSpacesPicker(accessor, 'switch');
	}
}

export class TitleBarNewSpaceAction extends Action2 {
	constructor() {
		super({
			id: SpacesCommandId.TitleBarNewSpace,
			title: localize2('spaces.titleBarNewSpace', "New Empty Space"),
			icon: Codicon.plus,
			f1: false,
			precondition: SpacesEnabledContext,
			menu: {
				id: MenuId.TitleBarAdjacentCenter,
				order: -1999,
				when: SpacesEnabledContext
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const spacesService = accessor.get(ISpacesService);
		const notificationService = accessor.get(INotificationService);
		reportResult(notificationService, await spacesService.createEmptySpace());
	}
}

export class AddNewSpaceAction extends Action2 {
	constructor() {
		super({
			id: SpacesCommandId.AddNewSpace,
			title: localize2('spaces.addNewSpace', "Add New Space..."),
			category: SPACES_CATEGORY,
			f1: true,
			precondition: SpacesEnabledContext
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const quickInputService = accessor.get(IQuickInputService);
		const commandService = accessor.get(ICommandService);

		interface IAddSpaceItem extends IQuickPickItem {
			readonly commandId: SpacesCommandId;
		}

		const items: IAddSpaceItem[] = [
			{
				commandId: SpacesCommandId.NewEmptySpace,
				label: `$(${Codicon.add.id}) ${localize('spaces.pick.new', "New Empty Space")}`,
				description: localize('spaces.pick.newDesc', "Create a clean, empty workspace window as a new Space")
			},
			{
				commandId: SpacesCommandId.OpenFolderAsNewSpace,
				label: `$(${Codicon.folderOpened.id}) ${localize('spaces.pick.openFolder', "Open Folder as New Space...")}`,
				description: localize('spaces.pick.openFolderDesc', "Select and open an existing local folder in a new Space")
			},
			{
				commandId: SpacesCommandId.OpenRemoteSSHSpace,
				label: `$(${Codicon.remote.id}) ${localize('spaces.pick.openRemoteSSH', "Open Remote / SSH as New Space...")}`,
				description: localize('spaces.pick.openRemoteSSHDesc', "Connect to an SSH server or remote folder as a new Space")
			},
			{
				commandId: SpacesCommandId.CreateWorktreeSpace,
				label: `$(${Codicon.gitFork.id}) ${localize('spaces.pick.createWorktree', "Create Space from Git Worktree...")}`,
				description: localize('spaces.pick.createWorktreeDesc', "Branch or isolate your git repository in a linked worktree Space")
			},
			{
				commandId: SpacesCommandId.OpenWorkspaceAsNewSpace,
				label: `$(${Codicon.fileCode.id}) ${localize('spaces.pick.openWorkspace', "Open Workspace as New Space...")}`,
				description: localize('spaces.pick.openWorkspaceDesc', "Open a multi-root .code-workspace file as a new Space")
			}
		];

		const pick = await quickInputService.pick(items, {
			title: localize('spaces.addNewSpaceTitle', "Add New Space"),
			placeholder: localize('spaces.addNewSpacePlaceholder', "Select how you would like to create a new Space")
		});

		if (pick) {
			await commandService.executeCommand(pick.commandId);
		}
	}
}

export class RemoveSpaceAction extends Action2 {
	constructor() {
		super({
			id: SpacesCommandId.RemoveSpace,
			title: localize2('spaces.removeSpace', "Remove Space..."),
			category: SPACES_CATEGORY,
			f1: true,
			precondition: SpacesEnabledContext
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const spacesService = accessor.get(ISpacesService);
		const quickInputService = accessor.get(IQuickInputService);
		const notificationService = accessor.get(INotificationService);
		const labelService = accessor.get(ILabelService);

		const { spaces } = await spacesService.getSpaces();
		if (spaces.length === 0) {
			notificationService.info(localize('spaces.noSpacesToRemove', "No Spaces found to remove."));
			return;
		}

		interface IRemoveSpaceItem extends IQuickPickItem {
			readonly spaceId: string;
		}

		const items: IRemoveSpaceItem[] = spaces.map(s => ({
			spaceId: s.id,
			label: `$(${Codicon.trash.id}) ${s.name}`,
			description: s.workspace ? labelService.getUriLabel(s.workspace.uri) : localize('spaces.empty', "No folder"),
			detail: localize('spaces.removeDetail', "Click to close and remove this Space")
		}));

		const pick = await quickInputService.pick(items, {
			title: localize('spaces.removeSpaceTitle', "Remove Space"),
			placeholder: localize('spaces.removeSpacePlaceholder', "Select a Space to close and remove...")
		});

		if (pick) {
			reportResult(notificationService, await spacesService.closeSpace(pick.spaceId));
		}
	}
}

export class CloseCurrentSpaceAction extends Action2 {
	constructor() {
		super({
			id: SpacesCommandId.CloseCurrentSpace,
			title: localize2('spaces.closeCurrentSpace', "Close Current Space"),
			category: SPACES_CATEGORY,
			precondition: SpacesEnabledContext,
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const spacesService = accessor.get(ISpacesService);
		const nativeHostService = accessor.get(INativeHostService);
		const notificationService = accessor.get(INotificationService);

		const { spaces } = await spacesService.getSpaces();
		const current = getCurrentSpace(spaces, nativeHostService.windowId);
		if (!current) {
			notificationService.info(localize('spaces.notASpace', "This window is not a Space."));
			return;
		}

		reportResult(notificationService, await spacesService.closeSpace(current.id));
	}
}

export class RenameCurrentSpaceAction extends Action2 {
	constructor() {
		super({
			id: SpacesCommandId.RenameCurrentSpace,
			title: localize2('spaces.renameCurrentSpace', "Rename Current Space..."),
			category: SPACES_CATEGORY,
			precondition: SpacesEnabledContext,
			f1: true
		});
	}

	/**
	 * @param newName optional name to apply without showing an input box (for automation)
	 */
	async run(accessor: ServicesAccessor, newName?: string): Promise<void> {
		const spacesService = accessor.get(ISpacesService);
		const nativeHostService = accessor.get(INativeHostService);
		const quickInputService = accessor.get(IQuickInputService);
		const notificationService = accessor.get(INotificationService);

		const { spaces } = await spacesService.getSpaces();
		const current = getCurrentSpace(spaces, nativeHostService.windowId);
		if (!current) {
			notificationService.info(localize('spaces.notASpace', "This window is not a Space."));
			return;
		}

		await renameSpace(spacesService, quickInputService, notificationService, current, newName);
	}
}

export class ListSpacesAction extends Action2 {
	constructor() {
		super({
			id: SpacesCommandId.ListSpaces,
			title: localize2('spaces.listSpaces', "List Spaces"),
			category: SPACES_CATEGORY,
			precondition: SpacesEnabledContext,
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		return showSpacesPicker(accessor, 'manage');
	}
}

export class OpenRemoteSSHSpaceAction extends Action2 {
	constructor() {
		super({
			id: SpacesCommandId.OpenRemoteSSHSpace,
			title: localize2('spaces.openRemoteSSHSpace', "Open Remote / SSH as New Space..."),
			category: SPACES_CATEGORY,
			precondition: SpacesEnabledContext,
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const commandService = accessor.get(ICommandService);
		await commandService.executeCommand('workbench.action.remote.showMenu');
	}
}

export class OpenOnGitHubAction extends Action2 {
	constructor() {
		super({
			id: SpacesCommandId.OpenOnGitHub,
			title: localize2('spaces.openOnGitHub', "Spaces: Open on GitHub"),
			category: SPACES_CATEGORY,
			precondition: SpacesEnabledContext,
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const spacesService = accessor.get(ISpacesService);
		const nativeHostService = accessor.get(INativeHostService);
		const fileService = accessor.get(IFileService);
		const notificationService = accessor.get(INotificationService);

		const { spaces } = await spacesService.getSpaces();
		const current = getCurrentSpace(spaces, nativeHostService.windowId);
		if (!current?.workspace?.uri) {
			notificationService.info(localize('spaces.noRepoOpen', "No repository folder is open in the current Space."));
			return;
		}

		const gitHubUrl = await getGitHubUrlForUri(fileService, current.workspace.uri);
		if (!gitHubUrl) {
			notificationService.info(localize('spaces.notGitHubRepo', "The current Space is not linked to a GitHub remote repository."));
			return;
		}

		await nativeHostService.openExternal(gitHubUrl);
	}
}

export class CreatePullRequestAction extends Action2 {
	constructor() {
		super({
			id: SpacesCommandId.CreatePullRequest,
			title: localize2('spaces.createPullRequest', "Spaces: Create GitHub Pull Request"),
			category: SPACES_CATEGORY,
			precondition: SpacesEnabledContext,
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const spacesService = accessor.get(ISpacesService);
		const nativeHostService = accessor.get(INativeHostService);
		const fileService = accessor.get(IFileService);
		const notificationService = accessor.get(INotificationService);

		const { spaces } = await spacesService.getSpaces();
		const current = getCurrentSpace(spaces, nativeHostService.windowId);
		if (!current?.workspace?.uri) {
			notificationService.info(localize('spaces.noRepoOpen', "No repository folder is open in the current Space."));
			return;
		}

		const gitHubUrl = await getGitHubUrlForUri(fileService, current.workspace.uri);
		if (!gitHubUrl) {
			notificationService.info(localize('spaces.notGitHubRepo', "The current Space is not linked to a GitHub remote repository."));
			return;
		}

		const branch = await getGitBranchForUri(fileService, current.workspace.uri);
		const prUrl = branch && branch !== 'main' && branch !== 'master'
			? `${gitHubUrl}/compare/${encodeURIComponent(branch)}?expand=1`
			: `${gitHubUrl}/pulls`;

		await nativeHostService.openExternal(prUrl);
	}
}

export class CreateWorktreeSpaceAction extends Action2 {
	constructor() {
		super({
			id: SpacesCommandId.CreateWorktreeSpace,
			title: localize2('spaces.createWorktreeSpace', "Spaces: Create Space from Git Worktree..."),
			category: SPACES_CATEGORY,
			precondition: SpacesEnabledContext,
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const spacesService = accessor.get(ISpacesService);
		const quickInputService = accessor.get(IQuickInputService);
		const nativeHostService = accessor.get(INativeHostService);
		const notificationService = accessor.get(INotificationService);
		const terminalService = accessor.get(ITerminalService);

		const { spaces } = await spacesService.getSpaces();
		const current = getCurrentSpace(spaces, nativeHostService.windowId);
		if (!current?.workspace?.uri || current.workspace.uri.scheme !== 'file') {
			notificationService.info(localize('spaces.worktreeRequiresLocal', "Git Worktrees can only be created from local folder spaces."));
			return;
		}

		const branchName = await quickInputService.input({
			title: localize('spaces.worktreeBranchTitle', "Create Git Worktree Space"),
			prompt: localize('spaces.worktreeBranchPrompt', "Enter branch name for the new worktree space (e.g. feature-login)"),
			validateInput: async val => {
				if (!val || !val.trim()) {
					return localize('spaces.branchRequired', "Branch name cannot be empty");
				}
				if (/\s/.test(val)) {
					return localize('spaces.branchNoSpaces', "Branch name cannot contain spaces");
				}
				return undefined;
			}
		});

		if (!branchName) {
			return;
		}

		const cleanBranch = branchName.trim();
		const repoDir = current.workspace.uri.fsPath;
		const repoName = basename(current.workspace.uri);
		const parentDir = URI.joinPath(current.workspace.uri, '..').fsPath;
		const worktreePath = `${parentDir}/${repoName}-${cleanBranch}`;

		try {
			const terminal = await terminalService.createTerminal({
				name: `Git Worktree: ${cleanBranch}`,
				cwd: repoDir
			});
			terminalService.setActiveInstance(terminal);
			terminal.sendText(`git worktree add -b ${cleanBranch} "${worktreePath}" || git worktree add "${worktreePath}" ${cleanBranch}`);

			// Give the worktree command a moment to initiate the directory, then open as space
			setTimeout(async () => {
				reportResult(notificationService, await spacesService.openFolderAsSpace(URI.file(worktreePath)));
			}, 1500);
		} catch (err: any) {
			notificationService.error(localize('spaces.worktreeFailed', "Failed to create Git worktree: {0}", err.message));
		}
	}
}

function createSwitchToSpaceAction(index: number) {
	return class extends Action2 {
		constructor() {
			super({
				id: `workbench.action.spaces.switchToSpace${index}`,
				title: localize2(`spaces.switchToSpace${index}`, "Switch to Space {0}", index),
				category: SPACES_CATEGORY,
				precondition: SpacesEnabledContext,
				f1: true,
				keybinding: {
					weight: KeybindingWeight.WorkbenchContrib,
					primary: KeyMod.CtrlCmd | KeyMod.Alt | (KeyCode.Digit1 + index - 1)
				}
			});
		}

		async run(accessor: ServicesAccessor): Promise<void> {
			const spacesService = accessor.get(ISpacesService);
			const notificationService = accessor.get(INotificationService);
			const { spaces } = await spacesService.getSpaces();
			const target = spaces[index - 1];
			if (target) {
				reportResult(notificationService, await spacesService.switchToSpace(target.id));
			}
		}
	};
}

export const SwitchToSpace1Action = createSwitchToSpaceAction(1);
export const SwitchToSpace2Action = createSwitchToSpaceAction(2);
export const SwitchToSpace3Action = createSwitchToSpaceAction(3);
export const SwitchToSpace4Action = createSwitchToSpaceAction(4);
export const SwitchToSpace5Action = createSwitchToSpaceAction(5);
export const SwitchToSpace6Action = createSwitchToSpaceAction(6);
export const SwitchToSpace7Action = createSwitchToSpaceAction(7);
export const SwitchToSpace8Action = createSwitchToSpaceAction(8);
export const SwitchToSpace9Action = createSwitchToSpaceAction(9);

export function extractGitHubUrl(gitConfigContent: string): string | undefined {
	const match = gitConfigContent.match(/url\s*=\s*(?:git@github\.com:|https?:\/\/github\.com\/)([^/\s]+)\/([^\s]+?)(?:\.git)?\s*$/m);
	if (match) {
		return `https://github.com/${match[1]}/${match[2]}`;
	}
	return undefined;
}

export function extractGitBranch(headContent: string): string | undefined {
	const match = headContent.match(/ref:\s*refs\/heads\/(.+)/);
	return match?.[1]?.trim();
}

export async function getGitHubUrlForUri(fileService: IFileService, uri: URI): Promise<string | undefined> {
	try {
		const configUri = URI.joinPath(uri, '.git', 'config');
		const content = (await fileService.readFile(configUri)).value.toString();
		return extractGitHubUrl(content);
	} catch {
		try {
			const dotGitUri = URI.joinPath(uri, '.git');
			const dotGitContent = (await fileService.readFile(dotGitUri)).value.toString();
			const gitDirMatch = dotGitContent.match(/gitdir:\s*(.+)/);
			if (gitDirMatch) {
				const gitDirPath = gitDirMatch[1].trim();
				const commonConfigUri = URI.file(gitDirPath + '/config');
				const configContent = (await fileService.readFile(commonConfigUri)).value.toString();
				return extractGitHubUrl(configContent);
			}
		} catch {
			// Not a git repository
		}
		return undefined;
	}
}

export async function getGitBranchForUri(fileService: IFileService, uri: URI): Promise<string | undefined> {
	try {
		const headUri = URI.joinPath(uri, '.git', 'HEAD');
		const content = (await fileService.readFile(headUri)).value.toString();
		return extractGitBranch(content);
	} catch {
		try {
			const dotGitUri = URI.joinPath(uri, '.git');
			const dotGitContent = (await fileService.readFile(dotGitUri)).value.toString();
			const gitDirMatch = dotGitContent.match(/gitdir:\s*(.+)/);
			if (gitDirMatch) {
				const gitDirPath = gitDirMatch[1].trim();
				const headFileUri = URI.file(gitDirPath + '/HEAD');
				const content = (await fileService.readFile(headFileUri)).value.toString();
				return extractGitBranch(content);
			}
		} catch {
			// Not a git repository
		}
		return undefined;
	}
}

async function renameSpace(spacesService: ISpacesService, quickInputService: IQuickInputService, notificationService: INotificationService, space: ISpace, newName?: string): Promise<void> {
	const name = newName ?? await quickInputService.input({
		title: localize('spaces.renameTitle', "Rename Space"),
		value: space.name,
		prompt: localize('spaces.renamePrompt', "Enter a new name. Leave empty to use the folder or workspace name.")
	});

	if (typeof name === 'string') {
		reportResult(notificationService, await spacesService.renameSpace(space.id, name));
	}
}

interface ISpacePickItem extends IQuickPickItem {
	readonly space?: ISpace;
	readonly commandId?: SpacesCommandId | string;
	readonly githubUrl?: string;
}

let activeSpacesPickerDisposables: DisposableStore | undefined;

/**
 * The Spaces dropdown: all Spaces categorized followed by Space management actions.
 * `manage` mode adds details and inline rename/close buttons.
 */
async function showSpacesPicker(accessor: ServicesAccessor, mode: 'switch' | 'manage'): Promise<void> {
	if (activeSpacesPickerDisposables) {
		activeSpacesPickerDisposables.dispose();
		activeSpacesPickerDisposables = undefined;
	}

	const spacesService = accessor.get(ISpacesService);
	const quickInputService = accessor.get(IQuickInputService);
	const labelService = accessor.get(ILabelService);
	const commandService = accessor.get(ICommandService);
	const nativeHostService = accessor.get(INativeHostService);
	const notificationService = accessor.get(INotificationService);
	const fileService = accessor.get(IFileService);

	const disposables = new DisposableStore();
	activeSpacesPickerDisposables = disposables;

	const renameButton: IQuickInputButton = { iconClass: ThemeIcon.asClassName(Codicon.edit), tooltip: localize('spaces.renameButton', "Rename Space") };
	const removeButton: IQuickInputButton = { iconClass: ThemeIcon.asClassName(Codicon.close), tooltip: localize('spaces.removeButton', "Remove Space (Close)") };
	const githubButton: IQuickInputButton = { iconClass: ThemeIcon.asClassName(Codicon.github), tooltip: localize('spaces.githubButton', "Open on GitHub") };

	const toItems = (spaces: readonly ISpace[], gitHubUrls: Map<string, string>): Array<ISpacePickItem | IQuickPickSeparator> => {
		const current = getCurrentSpace(spaces, nativeHostService.windowId);
		const items: Array<ISpacePickItem | IQuickPickSeparator> = [];

		// 1. Prominent "Add New Space" section at the very top of dropdown
		items.push({ type: 'separator', label: localize('spaces.addNewCategory', "Add New Space") });
		items.push({ commandId: SpacesCommandId.NewEmptySpace, label: `$(${Codicon.add.id}) ${localize('spaces.pick.new', "New Empty Space")}` });
		items.push({ commandId: SpacesCommandId.OpenFolderAsNewSpace, label: `$(${Codicon.folderOpened.id}) ${localize('spaces.pick.openFolder', "Open Folder as New Space...")}` });
		items.push({ commandId: SpacesCommandId.OpenRemoteSSHSpace, label: `$(${Codicon.remote.id}) ${localize('spaces.pick.openRemoteSSH', "Open Remote / SSH as New Space...")}` });
		items.push({ commandId: SpacesCommandId.CreateWorktreeSpace, label: `$(${Codicon.gitFork.id}) ${localize('spaces.pick.createWorktree', "Create Space from Git Worktree...")}` });
		items.push({ commandId: SpacesCommandId.OpenWorkspaceAsNewSpace, label: `$(${Codicon.fileCode.id}) ${localize('spaces.pick.openWorkspace', "Open Workspace as New Space...")}` });

		const createSpaceItem = (space: ISpace, isCurrent: boolean): ISpacePickItem => {
			const ghUrl = gitHubUrls.get(space.id);
			const buttons: IQuickInputButton[] = [];
			if (ghUrl) {
				buttons.push(githubButton);
			}
			if (mode === 'manage') {
				buttons.push(renameButton, removeButton);
			} else {
				buttons.push(removeButton);
			}

			return {
				space,
				githubUrl: ghUrl,
				label: space.needsAttention
					? `$(${Codicon.bellDot.id}) ${localize('spaces.needsAttention', "{0} — needs attention", space.name)}`
					: `$(${isCurrent ? Codicon.check.id : Codicon.blank.id}) ${space.name}`,
				description: space.workspace ? labelService.getUriLabel(space.workspace.uri) : localize('spaces.empty', "No folder"),
				detail: mode === 'manage'
					? localize('spaces.detailState', "{0} · last active {1}", space.state === 'active' ? localize('spaces.stateActive', "Active") : localize('spaces.stateInactive', "Running in background"), space.lastActiveAt ? new Date(space.lastActiveAt).toLocaleTimeString() : localize('spaces.never', "never"))
					: undefined,
				buttons
			};
		};

		// 2. Categorized sections: Active, Local, Remote SSH, Worktrees
		if (current) {
			items.push({ type: 'separator', label: localize('spaces.activeCategory', "Active Space") });
			items.push(createSpaceItem(current, true));
		}

		const otherSpaces = spaces.filter(s => s.id !== current?.id);
		const localSpaces: ISpace[] = [];
		const remoteSpaces: ISpace[] = [];
		const worktreeSpaces: ISpace[] = [];

		for (const space of otherSpaces) {
			if (space.workspace?.uri.scheme === 'vscode-remote') {
				remoteSpaces.push(space);
			} else if (space.workspace && (space.name.includes('[worktree') || space.workspace.uri.fsPath.includes('-worktree-') || space.workspace.uri.fsPath.includes('.worktrees'))) {
				worktreeSpaces.push(space);
			} else {
				localSpaces.push(space);
			}
		}

		if (localSpaces.length > 0) {
			items.push({ type: 'separator', label: localize('spaces.localCategory', "Local Spaces") });
			for (const s of localSpaces) {
				items.push(createSpaceItem(s, false));
			}
		}

		if (remoteSpaces.length > 0) {
			items.push({ type: 'separator', label: localize('spaces.remoteCategory', "Remote SSH Spaces") });
			for (const s of remoteSpaces) {
				items.push(createSpaceItem(s, false));
			}
		}

		if (worktreeSpaces.length > 0) {
			items.push({ type: 'separator', label: localize('spaces.worktreeCategory', "Git Worktrees") });
			for (const s of worktreeSpaces) {
				items.push(createSpaceItem(s, false));
			}
		}

		// 3. Space Management actions
		items.push({ type: 'separator', label: localize('spaces.actionsCategory', "Space Management") });
		if (current) {
			items.push({ commandId: SpacesCommandId.CloseCurrentSpace, label: `$(${Codicon.close.id}) ${localize('spaces.pick.removeCurrent', "Remove Current Space")}` });
		}
		items.push({ commandId: SpacesCommandId.RemoveSpace, label: `$(${Codicon.trash.id}) ${localize('spaces.pick.removeSpace', "Remove Space...")}` });
		if (current) {
			items.push({ commandId: SpacesCommandId.RenameCurrentSpace, label: `$(${Codicon.edit.id}) ${localize('spaces.pick.rename', "Rename Current Space...")}` });
			items.push({ commandId: SpacesCommandId.OpenOnGitHub, label: `$(${Codicon.github.id}) ${localize('spaces.pick.openOnGitHub', "Open Active Space on GitHub")}` });
			items.push({ commandId: SpacesCommandId.CreatePullRequest, label: `$(${Codicon.gitPullRequest.id}) ${localize('spaces.pick.createPR', "Create GitHub Pull Request...")}` });
		} else {
			items.push({ commandId: SpacesCommandId.AddCurrentWindowAsSpace, label: `$(${Codicon.window.id}) ${localize('spaces.pick.addCurrent', "Add Current Window as Space")}` });
		}
		if (mode === 'switch') {
			items.push({ commandId: SpacesCommandId.ListSpaces, label: `$(${Codicon.listUnordered.id}) ${localize('spaces.pick.manage', "Manage Spaces...")}` });
		}

		return items;
	};

	const picker = disposables.add(quickInputService.createQuickPick<ISpacePickItem>({ useSeparators: true }));
	disposables.add(picker.onDidHide(() => {
		if (activeSpacesPickerDisposables === disposables) {
			activeSpacesPickerDisposables = undefined;
		}
		disposables.dispose();
	}));

	picker.title = mode === 'manage' ? localize('spaces.manageTitle', "Manage Spaces") : localize('spaces.switchTitle', "Switch Space");
	picker.placeholder = localize('spaces.placeholder', "Select a Space to switch to, create a new Space, or remove a Space...");
	picker.matchOnDescription = true;
	picker.busy = true;
	picker.show();

	const resolveGitHubUrls = async (spaces: readonly ISpace[]): Promise<Map<string, string>> => {
		const map = new Map<string, string>();
		await Promise.all(spaces.map(async space => {
			if (space.workspace?.uri) {
				try {
					const url = await getGitHubUrlForUri(fileService, space.workspace.uri);
					if (url) {
						map.set(space.id, url);
					}
				} catch {
					// Ignore URL error
				}
			}
		}));
		return map;
	};

	spacesService.getSpaces().then(async snapshot => {
		let gitHubUrls = new Map<string, string>();
		picker.items = toItems(snapshot.spaces, gitHubUrls);
		picker.activeItems = picker.items.filter((item): item is ISpacePickItem => item.type !== 'separator' && item.space?.windowId === nativeHostService.windowId);
		picker.busy = false;

		try {
			gitHubUrls = await resolveGitHubUrls(snapshot.spaces);
			picker.items = toItems(snapshot.spaces, gitHubUrls);
		} catch {
			// Ignore GitHub URL resolution error
		}
	}).catch(err => {
		picker.busy = false;
		notificationService.error(err);
	});

	disposables.add(spacesService.onDidChangeSpaces(async newSnapshot => {
		picker.keepScrollPosition = true;
		try {
			const urls = await resolveGitHubUrls(newSnapshot.spaces);
			picker.items = toItems(newSnapshot.spaces, urls);
		} catch {
			picker.items = toItems(newSnapshot.spaces, new Map());
		}
	}));

	disposables.add(picker.onDidTriggerItemButton(async ({ item, button }) => {
		if (!item.space) {
			return;
		}

		if (button === removeButton) {
			reportResult(notificationService, await spacesService.closeSpace(item.space.id));
		} else if (button === renameButton) {
			picker.hide();
			await renameSpace(spacesService, quickInputService, notificationService, item.space);
		} else if (button === githubButton && item.githubUrl) {
			await nativeHostService.openExternal(item.githubUrl);
		}
	}));

	disposables.add(picker.onDidAccept(async () => {
		const [item] = picker.selectedItems;
		picker.hide();

		if (item?.space) {
			reportResult(notificationService, await spacesService.switchToSpace(item.space.id));
		} else if (item?.commandId) {
			await commandService.executeCommand(item.commandId);
		}
	}));
}
