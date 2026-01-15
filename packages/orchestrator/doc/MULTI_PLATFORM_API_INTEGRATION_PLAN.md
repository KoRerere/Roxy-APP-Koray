# Multi-Platform API Integration Plan

## Overview
Design a provider abstraction layer to support multiple LLM API platforms (Anthropic, OpenAI, Google Gemini) while maintaining minimal changes to the existing codebase. The system should support thinking/reasoning modes, tool calling, and streaming.

## User Requirements
- **Target Platforms**: Universal extension framework (easily add new providers)
- **Required Features**: Thinking/Reasoning mode, Tool Calling, Streaming
- **Approach**: Minimal changes to existing code structure

## Current Architecture Analysis

### Key Files
- `src/lib/OpenRouterChat.ts` - Custom OpenRouter implementation extending ChatOpenAI
- `src/config/config.ts` - LLM factory function (`createOpenRouterLLM`)
- `src/chat/ChatManager.ts` - Main orchestrator, uses LLM via abstraction
- `src/chat/Router.ts` - Uses LLM for routing decisions
- `src/agent/orchestrator.ts` - Uses LLM for planning/synthesis
- `src/agent/workers/general.ts` - Uses LLM for task execution

### Current Coupling Points
1. **Direct OpenRouter dependency**: `OpenRouterChat` hardcoded in config.ts
2. **Environment variables**: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` hardcoded
3. **Reasoning extraction**: Custom streaming logic specific to OpenRouter format
4. **Tool format conversion**: `convertToolsToOpenRouterFormat()` in ChatManager

## Proposed Solution: Provider Abstraction Layer

### Phase 1: Create Provider Interface
**New file**: `src/providers/BaseProvider.ts`

Define a unified interface that all providers must implement:
```typescript
interface ILLMProvider {
  createLLM(enableThinking: boolean): BaseChatModel;
  getName(): string;
  supportsThinking(): boolean;
  supportsToolCalling(): boolean;
  supportsStreaming(): boolean;
}
```

### Phase 2: Implement Concrete Providers
**New files**:
- `src/providers/OpenRouterProvider.ts` - Move existing OpenRouterChat logic here
- `src/providers/AnthropicProvider.ts` - Direct Anthropic API support
- `src/providers/OpenAIProvider.ts` - OpenAI API support
- `src/providers/GeminiProvider.ts` - Google Gemini API support

Each provider will:
1. Handle API-specific authentication
2. Implement custom streaming if needed (like current OpenRouterChat)
3. Extract reasoning/thinking in provider-specific way
4. Convert tools to provider-specific format

### Phase 3: Update Configuration
**Modify**: `src/config/config.ts`

Replace `createOpenRouterLLM()` with:
```typescript
function createLLM(enableThinking: boolean) {
  const provider = getProvider(); // Factory to get active provider
  return provider.createLLM(enableThinking);
}
```

Add provider selection via environment:
```
LLM_PROVIDER=openrouter|anthropic|openai|gemini
```

### Phase 4: Update Environment & Documentation
**Modify**: `.env.example`

Restructure to support multiple providers:
```
# Provider Selection
LLM_PROVIDER=openrouter

# OpenRouter
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=...

# Anthropic
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=...

# OpenAI
OPENAI_API_KEY=...
OPENAI_MODEL=...

# Google Gemini
GEMINI_API_KEY=...
GEMINI_MODEL=...
```

### Phase 5: Minimal Changes to Existing Code
**Files requiring minor updates**:
- `src/chat/ChatManager.ts` - Remove OpenRouter-specific tool conversion, let provider handle it
- `src/chat/Router.ts` - Use new `createLLM()` function
- `src/agent/orchestrator.ts` - Use new `createLLM()` function
- `src/agent/workers/general.ts` - Use new `createLLM()` function

**Key principle**: Keep all provider-specific logic contained in provider classes

## Implementation Order

1. Create `BaseProvider` interface
2. Extract current OpenRouter logic into `OpenRouterProvider` (refactor, no new functionality)
3. Update `config.ts` to use provider pattern
4. Test that everything still works with OpenRouter
5. Implement `AnthropicProvider` as first new provider
6. Implement `OpenAIProvider` and `GeminiProvider`
7. Update documentation

## Files to Create
- `src/providers/BaseProvider.ts`
- `src/providers/ProviderFactory.ts`
- `src/providers/OpenRouterProvider.ts`
- `src/providers/AnthropicProvider.ts`
- `src/providers/OpenAIProvider.ts`
- `src/providers/GeminiProvider.ts`

## Files to Modify
- `src/config/config.ts` (major refactor)
- `src/chat/ChatManager.ts` (remove OpenRouter-specific logic)
- `.env.example` (add new provider configs)
- `CLAUDE.md` (document provider system)

## Difficulty Assessment
**Difficulty: Medium** (3/5)

### Reasons it's manageable:
1. Existing code already uses abstractions (ChatOpenAI base class from LangChain)
2. Provider pattern is well-established design pattern
3. Can implement incrementally - migrate OpenRouter first, then add new providers
4. LangChain already has provider-specific classes we can leverage

### Main challenges:
1. Each provider has different streaming formats for reasoning/thinking
2. Tool calling formats differ between providers
3. Need to handle feature incompatibilities gracefully (e.g., some providers don't support thinking mode)
4. Testing across multiple providers

## Benefits of This Approach
1. **Minimal disruption**: Core orchestrator logic unchanged
2. **Easy to extend**: Add new providers by implementing interface
3. **Feature detection**: Each provider declares its capabilities
4. **Testable**: Can easily mock providers for testing
5. **Maintainable**: Provider-specific code isolated from business logic

## Next Steps for Implementation

When ready to implement, follow these steps:

1. **Step 1**: Create the provider interface and base classes
2. **Step 2**: Refactor OpenRouter into the new provider structure (no feature changes)
3. **Step 3**: Test thoroughly to ensure OpenRouter still works
4. **Step 4**: Implement Anthropic provider
5. **Step 5**: Implement OpenAI and Gemini providers
6. **Step 6**: Update documentation and examples

Each step should be tested before moving to the next one.
