// @typedstandards/civic-typed-router — the package entry.
//
// Two directories, one boundary: `core/` is the domain-free router (manifest
// types, selection by configuration, the composer's join, the offered-tools
// filter, the tool-to-source index); `civic/` is the civic content that fills
// it (the three sources, their texts, the one-portal lock, the configuration
// reader). Core imports nothing from civic and nothing from any package.

export * from './core/index.ts';
export * from './civic/index.ts';
