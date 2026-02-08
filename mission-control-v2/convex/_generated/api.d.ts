/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activities from "../activities.js";
import type * as agents from "../agents.js";
import type * as cleanup from "../cleanup.js";
import type * as crons from "../crons.js";
import type * as debug from "../debug.js";
import type * as encryption from "../encryption.js";
import type * as events from "../events.js";
import type * as fly_client from "../fly_client.js";
import type * as init from "../init.js";
import type * as messages from "../messages.js";
import type * as orchestrator from "../orchestrator.js";
import type * as policies from "../policies.js";
import type * as proposals from "../proposals.js";
import type * as secrets from "../secrets.js";
import type * as seed from "../seed.js";
import type * as tasks from "../tasks.js";
import type * as teams from "../teams.js";
import type * as test_tenancy from "../test_tenancy.js";
import type * as utils from "../utils.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activities: typeof activities;
  agents: typeof agents;
  cleanup: typeof cleanup;
  crons: typeof crons;
  debug: typeof debug;
  encryption: typeof encryption;
  events: typeof events;
  fly_client: typeof fly_client;
  init: typeof init;
  messages: typeof messages;
  orchestrator: typeof orchestrator;
  policies: typeof policies;
  proposals: typeof proposals;
  secrets: typeof secrets;
  seed: typeof seed;
  tasks: typeof tasks;
  teams: typeof teams;
  test_tenancy: typeof test_tenancy;
  utils: typeof utils;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
