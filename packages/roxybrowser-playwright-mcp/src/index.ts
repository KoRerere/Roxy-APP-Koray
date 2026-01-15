/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as mcpServer from './mcp/server.js';
import { commaSeparatedList, resolveCLIConfig, semicolonSeparatedList } from './config.js';
import { packageJSON } from './utils/package.js';
import { Context } from './context.js';
import { contextFactory } from './browserContextFactory.js';
import { runLoopTools } from './loopTools/main.js';
import { ProxyBackend } from './mcp/proxyBackend.js';
import { BrowserServerBackend } from './browserServerBackend.js';
import { ExtensionContextFactory } from './extension/extensionContextFactory.js';
import { createDynamicCdpContextFactory } from './browserContextFactory.js';

import { runVSCodeTools } from './vscode/host.js';
import type { MCPProvider } from './mcp/proxyBackend.js';
import type { CLIOptions } from './config.js';

function envToBoolean(value: string | undefined): boolean | undefined {
  if (value === 'true' || value === '1')
    return true;
  if (value === 'false' || value === '0')
    return false;
  return undefined;
}

function envToString(value: string | undefined): string | undefined {
  return value ? value.trim() : undefined;
}

function envToNumber(value: string | undefined): number | undefined {
  if (!value)
    return undefined;
  return +value;
}

function getOptionsFromEnv(): CLIOptions & { extension?: boolean; vscode?: boolean; loopTools?: boolean; roxyMode?: boolean; connectTool?: boolean; vision?: boolean } {
  const options: CLIOptions & { extension?: boolean; vscode?: boolean; loopTools?: boolean; roxyMode?: boolean; connectTool?: boolean; vision?: boolean } = {};

  // 从环境变量读取所有配置选项
  options.allowedOrigins = semicolonSeparatedList(process.env.PLAYWRIGHT_MCP_ALLOWED_ORIGINS);
  options.blockedOrigins = semicolonSeparatedList(process.env.PLAYWRIGHT_MCP_BLOCKED_ORIGINS);
  options.blockServiceWorkers = envToBoolean(process.env.PLAYWRIGHT_MCP_BLOCK_SERVICE_WORKERS);
  options.browser = envToString(process.env.PLAYWRIGHT_MCP_BROWSER);
  options.caps = commaSeparatedList(process.env.PLAYWRIGHT_MCP_CAPS);
  options.cdpEndpoint = envToString(process.env.PLAYWRIGHT_MCP_CDP_ENDPOINT);
  options.config = envToString(process.env.PLAYWRIGHT_MCP_CONFIG);
  options.device = envToString(process.env.PLAYWRIGHT_MCP_DEVICE);
  options.executablePath = envToString(process.env.PLAYWRIGHT_MCP_EXECUTABLE_PATH);
  options.headless = envToBoolean(process.env.PLAYWRIGHT_MCP_HEADLESS);
  options.host = envToString(process.env.PLAYWRIGHT_MCP_HOST);
  options.ignoreHttpsErrors = envToBoolean(process.env.PLAYWRIGHT_MCP_IGNORE_HTTPS_ERRORS);
  options.isolated = envToBoolean(process.env.PLAYWRIGHT_MCP_ISOLATED);
  if (process.env.PLAYWRIGHT_MCP_IMAGE_RESPONSES === 'omit')
    options.imageResponses = 'omit';
  if (process.env.PLAYWRIGHT_MCP_SNAPSHOT_MODE && ['aria', 'optimized', 'auto'].includes(process.env.PLAYWRIGHT_MCP_SNAPSHOT_MODE))
    options.snapshotMode = process.env.PLAYWRIGHT_MCP_SNAPSHOT_MODE as 'aria' | 'optimized' | 'auto';
  options.sandbox = envToBoolean(process.env.PLAYWRIGHT_MCP_SANDBOX);
  options.outputDir = envToString(process.env.PLAYWRIGHT_MCP_OUTPUT_DIR);
  options.port = envToNumber(process.env.PLAYWRIGHT_MCP_PORT);
  options.proxyBypass = envToString(process.env.PLAYWRIGHT_MCP_PROXY_BYPASS);
  options.proxyServer = envToString(process.env.PLAYWRIGHT_MCP_PROXY_SERVER);
  options.saveSession = envToBoolean(process.env.PLAYWRIGHT_MCP_SAVE_SESSION);
  options.saveTrace = envToBoolean(process.env.PLAYWRIGHT_MCP_SAVE_TRACE);
  options.storageState = envToString(process.env.PLAYWRIGHT_MCP_STORAGE_STATE);
  options.userAgent = envToString(process.env.PLAYWRIGHT_MCP_USER_AGENT);
  options.userDataDir = envToString(process.env.PLAYWRIGHT_MCP_USER_DATA_DIR);
  options.viewportSize = envToString(process.env.PLAYWRIGHT_MCP_VIEWPORT_SIZE);

  // 特殊选项
  options.extension = envToBoolean(process.env.PLAYWRIGHT_MCP_EXTENSION);
  options.vscode = envToBoolean(process.env.PLAYWRIGHT_MCP_VSCODE);
  options.loopTools = envToBoolean(process.env.PLAYWRIGHT_MCP_LOOP_TOOLS);
  options.roxyMode = envToBoolean(process.env.PLAYWRIGHT_MCP_ROXY_MODE) ?? true; // 默认为 true
  options.connectTool = envToBoolean(process.env.PLAYWRIGHT_MCP_CONNECT_TOOL);
  options.vision = envToBoolean(process.env.PLAYWRIGHT_MCP_VISION);

  return options;
}

async function main() {
  setupExitWatchdog();

  const options = getOptionsFromEnv();

  if (options.vision) {
    // eslint-disable-next-line no-console
    console.error('The PLAYWRIGHT_MCP_VISION option is deprecated, use PLAYWRIGHT_MCP_CAPS=vision instead');
    options.caps = ['vision'];
  }

  const config = await resolveCLIConfig(options);
  const browserContextFactory = contextFactory(config);
  const extensionContextFactory = new ExtensionContextFactory(config.browser.launchOptions.channel || 'chrome', config.browser.userDataDir);

  if (options.extension) {
    const serverBackendFactory: mcpServer.ServerBackendFactory = {
      name: 'Playwright w/ extension',
      nameInConfig: 'playwright-extension',
      version: packageJSON.version,
      create: () => new BrowserServerBackend(config, extensionContextFactory)
    };
    await mcpServer.start(serverBackendFactory, config.server);
    return;
  }

  if (options.vscode) {
    await runVSCodeTools(config);
    return;
  }

  if (options.loopTools) {
    await runLoopTools(config);
    return;
  }

  if (options.roxyMode) {
    const factory: mcpServer.ServerBackendFactory = {
      name: 'Playwright w/ RoxyBrowser',
      nameInConfig: 'playwright-roxy',
      version: packageJSON.version,
      create: () => {
        // Create a new factory instance for each HTTP session to ensure proper isolation
        const dynamicContextFactory = createDynamicCdpContextFactory(config);
        return new BrowserServerBackend(config, dynamicContextFactory);
      }
    };
    await mcpServer.start(factory, config.server);
    return;
  }

  if (options.connectTool) {
    const providers: MCPProvider[] = [
      {
        name: 'default',
        description: 'Starts standalone browser',
        connect: () => mcpServer.wrapInProcess(new BrowserServerBackend(config, browserContextFactory)),
      },
      {
        name: 'extension',
        description: 'Connect to a browser using the Playwright MCP extension',
        connect: () => mcpServer.wrapInProcess(new BrowserServerBackend(config, extensionContextFactory)),
      },
    ];
    const factory: mcpServer.ServerBackendFactory = {
      name: 'Playwright w/ switch',
      nameInConfig: 'playwright-switch',
      version: packageJSON.version,
      create: () => new ProxyBackend(providers),
    };
    await mcpServer.start(factory, config.server);
    return;
  }

  const factory: mcpServer.ServerBackendFactory = {
    name: 'Playwright',
    nameInConfig: 'playwright',
    version: packageJSON.version,
    create: () => new BrowserServerBackend(config, browserContextFactory)
  };
  await mcpServer.start(factory, config.server);
}

function setupExitWatchdog() {
  let isExiting = false;
  const handleExit = async () => {
    if (isExiting)
      return;
    isExiting = true;
    setTimeout(() => process.exit(0), 15000);
    await Context.disposeAll();
    process.exit(0);
  };

  process.stdin.on('close', handleExit);
  process.on('SIGINT', handleExit);
  process.on('SIGTERM', handleExit);
}

void main();
