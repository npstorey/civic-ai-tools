#!/usr/bin/env node
// Wrapper script to bootstrap global-agent for NTLM proxy support
// This is used by city workers behind corporate proxies that require NTLM authentication
//
// Usage: Copy this file to .mcp-servers/socrata-mcp-server/proxy-wrapper.js
// See SETUP.md for full instructions

import { bootstrap } from 'global-agent';

// Bootstrap global-agent to use proxy from environment variables
// (GLOBAL_AGENT_HTTP_PROXY, GLOBAL_AGENT_HTTPS_PROXY set in mcp.json)
bootstrap();

// Now import and run the main server
import './dist/index.js';
