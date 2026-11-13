// The routing configuration (since 0.10.0). RED STUB: the exports exist with
// their final signatures; the function returns a wrong value.

import type { SearchMethod } from './search.ts';

/** The rule that chose the listed sources, and its version. */
export interface RoutingRule {
  readonly id: string;
  readonly version: string;
}

/** The inventory the sources come from: its id, version and hash. */
export interface RoutingInventory {
  readonly id: string;
  readonly version: string;
  readonly hash: string;
}

/** The routing configuration: S1's object, key for key. */
export interface RoutingConfiguration {
  readonly rule: RoutingRule;
  readonly cap: string;
  readonly search: 'none' | SearchMethod;
  readonly inventory: RoutingInventory;
}

/** A routing configuration and its hash. */
export interface RoutingConfigurationRecord {
  readonly routingConfiguration: RoutingConfiguration;
  readonly routingConfigurationHash: string;
}

/** Thrown by `routingConfiguration` for a value outside its shape. */
export class RoutingConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoutingConfigurationError';
  }
}

/** The routing configuration of `input`, and its hash. */
export function routingConfiguration(input: RoutingConfiguration): RoutingConfigurationRecord {
  return { routingConfiguration: input, routingConfigurationHash: '' };
}
