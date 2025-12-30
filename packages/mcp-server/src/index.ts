#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListResourceTemplatesRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { toolDefinitions, executeTool, ToolName } from './tools.js';
import { listResources, readResource, listResourceTemplates } from './resources.js';
import { closeDb } from './db.js';

const server = new Server(
  { name: 'claudin-linkedin', version: '0.1.0' },
  { 
    capabilities: { 
      tools: { listChanged: false },
      resources: { subscribe: false, listChanged: false },
    } 
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: toolDefinitions };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    const result = executeTool(name as ToolName, args || {});
    return {
      content: [{ type: 'text', text: result }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return { resources: listResources() };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  const result = readResource(uri);
  
  if (!result) {
    throw new Error(`Resource not found: ${uri}`);
  }
  
  return {
    contents: [{
      uri,
      mimeType: result.mimeType,
      text: result.contents,
    }],
  };
});

server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
  return { resourceTemplates: listResourceTemplates() };
});

async function main() {
  const transport = new StdioServerTransport();
  
  process.on('SIGINT', () => {
    closeDb();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    closeDb();
    process.exit(0);
  });
  
  await server.connect(transport);
  console.error('ClaudIn MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
