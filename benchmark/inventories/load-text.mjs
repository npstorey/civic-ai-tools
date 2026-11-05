// The one fixed text a load of an MCP Registry entry returns (the seat's
// ruling 2, hub #302 comment 6604092796). A registry entry carries no tools:
// its server's tools were never captured, and the benchmark calls no source.
// Loading one adds no tools and returns this text; a registry entry is scored
// on the first request only. P3's runner imports it; the preregistration
// quotes it word for word.

export const REGISTRY_LOAD_TEXT =
  'This source is listed in the MCP Registry, but its tools were not captured for this benchmark, so loading it added no tools.';
