// The harness definition (ADR-0037): what one composition was made of, as an
// output with its own hash. The domain, the composed sources, the
// components as the consumer's composition states them, and who chose the
// sources. Its hash is the lowercase hex SHA-256 of the canonical JSON of
// the other four fields. It carries no task: nothing in the composition
// declares one.

import { canonicalJson } from './canonical-json.ts';
import { sha256Hex } from './sha256.ts';
import type { ChosenBy, HarnessDefinition, HarnessDefinitionComponent } from './types.ts';

/** Every value `chosenBy` takes: the reader chose the sources, the model
 *  chose them (in-loop routing), or the instance did (its configuration). */
export const CHOSEN_BY: readonly ChosenBy[] = Object.freeze(['reader', 'model', 'instance']);

const LOWERCASE_SHA256_HEX = /^[0-9a-f]{64}$/;

/** Thrown by `harnessDefinitionOf` for a field outside its shape. */
export class HarnessDefinitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HarnessDefinitionError';
  }
}

/** What a definition is made of, before its hash. */
export interface HarnessDefinitionParts {
  /** The domain the composition is for, a value the domain layer passes. */
  readonly domain: string;
  /** The composed source ids, in composition order. */
  readonly sources: readonly string[];
  /** The composition's components, in its order. Only `id`, `version` and
   *  `guidanceHash` are read; any other key is not part of the definition. */
  readonly components: readonly HarnessDefinitionComponent[];
  readonly chosenBy: ChosenBy;
}

const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

function componentOf(component: HarnessDefinitionComponent, i: number): HarnessDefinitionComponent {
  if (typeof component !== 'object' || component === null) {
    throw new HarnessDefinitionError(`components[${i}] is not an object.`);
  }
  const { id, version, guidanceHash } = component;
  if (!nonEmptyString(id)) throw new HarnessDefinitionError(`components[${i}].id must be a non-empty string.`);
  if (version !== undefined && !nonEmptyString(version)) {
    throw new HarnessDefinitionError(`components[${i}].version, when present, must be a non-empty string.`);
  }
  if (guidanceHash !== undefined && !(typeof guidanceHash === 'string' && LOWERCASE_SHA256_HEX.test(guidanceHash))) {
    throw new HarnessDefinitionError(`components[${i}].guidanceHash, when present, must be 64 lowercase hex characters.`);
  }
  return {
    id,
    ...(version === undefined ? {} : { version }),
    ...(guidanceHash === undefined ? {} : { guidanceHash }),
  };
}

/**
 * The harness definition of `parts`: `{ domain, sources, components,
 * chosenBy, hash }`. Refuses an empty domain or source id, a `chosenBy`
 * outside `CHOSEN_BY`, and a component whose `id` is empty, whose `version`
 * is present and empty, or whose `guidanceHash` is present and not 64
 * lowercase hex characters.
 */
export function harnessDefinitionOf(parts: HarnessDefinitionParts): HarnessDefinition {
  if (!nonEmptyString(parts.domain)) throw new HarnessDefinitionError('domain must be a non-empty string.');
  if (!Array.isArray(parts.sources) || !parts.sources.every(nonEmptyString)) {
    throw new HarnessDefinitionError('sources must be an array of non-empty strings.');
  }
  if (!CHOSEN_BY.includes(parts.chosenBy)) {
    throw new HarnessDefinitionError(`chosenBy must be one of ${CHOSEN_BY.map((v) => `"${v}"`).join(', ')}; got ${JSON.stringify(parts.chosenBy)}.`);
  }
  if (!Array.isArray(parts.components)) throw new HarnessDefinitionError('components must be an array.');
  const body = {
    domain: parts.domain,
    sources: [...parts.sources],
    components: parts.components.map(componentOf),
    chosenBy: parts.chosenBy,
  };
  return { ...body, hash: sha256Hex(canonicalJson(body)) };
}
