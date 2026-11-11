# Svelte MCP server

The Svelte team's MCP server gives an agent the Svelte 5 and SvelteKit documentation and a static analyser for the code it writes. It is set up for the three tools used on this project: Claude Code, OpenCode and Pi. Source: <https://svelte.dev/docs/ai/mcp>.

## What is committed

| File                                 | Tool        | What it does                                                                                                   |
| ------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------- |
| `.claude/settings.json`              | Claude Code | Registers the `sveltejs/ai-tools` marketplace and turns on the `svelte` plugin (`svelte@svelte`).             |
| `opencode.json`                      | OpenCode    | Lists the `@sveltejs/opencode` plugin.                                                                         |
| `.opencode/svelte.json`              | OpenCode    | Plugin settings: local MCP server, skills and the `svelte-file-editor` subagent on, built-in instructions off. |
| `.pi/svelte.json`                    | Pi          | Package settings: local MCP server on, built-in instructions off.                                              |

The built-in instructions are off in OpenCode and Pi because the same text is in `AGENTS.md` (the **Svelte MCP** bullet), which all three tools read. That keeps one version of the wording.

## What each person runs once

Committed settings do not install anything on a machine.

- **Claude Code:** open the project, trust the folder, and accept the marketplace and plugin prompts (or run `/plugin marketplace add sveltejs/ai-tools` then `/plugin install svelte`). The plugin brings the local MCP server, skills, a `svelte-file-editor` subagent and the Svelte language server entry.
- **OpenCode:** nothing to run; the plugin in `opencode.json` is installed when OpenCode starts. (`opencode plugin add @sveltejs/opencode` does the same by hand.)
- **Pi:** `pi install -l npm:@sveltejs/pi` (`-l` keeps it to this project). Pi has no subagents; run `/reload` after changing `.pi/svelte.json`, which Pi reads only in trusted projects.

The server runs locally through `npx -y @sveltejs/mcp`, so nothing leaves the machine. To use the hosted one instead (`https://mcp.svelte.dev/mcp`, which the Svelte team says does not log or store code), set `"type": "remote"` under `mcp` in the OpenCode and Pi files.

## The tools

- `list-sections`: lists the documentation sections with their `use_cases`. Call it first when unsure.
- `get-documentation`: fetches the full text of the sections that fit the task.
- `svelte-autofixer`: analyses Svelte code and returns issues and suggestions. Run it on every component written, until it reports nothing. It does not replace `npm run check` and `npm run lint`.
- `playground-link`: a Svelte Playground link for a piece of code. Only on request, and never for code written to files in the repo.

If the client supports it, the `svelte-task` prompt tells the model how best to use the server.

## The Svelte team's own wording

The Svelte docs suggest this text for `AGENTS.md`. The repo's version is shorter, and asks for the documentation only when unsure, so that small tasks do not each start with a lookup.

```
You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available Svelte MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.
```
