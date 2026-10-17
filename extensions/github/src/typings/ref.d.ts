/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'tunnel';

declare module '@octokit/graphql-schema' {
	export type Repository = any;
	export type RepositoryRuleset = any;
	export type Commit = any;
	export type Maybe<T> = T | null | undefined;
}
