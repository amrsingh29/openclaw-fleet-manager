# AI-assisted setup

The install is four commands if everything works. When something does not work, the failure is usually in one of four places, and the message rarely says which. This page exists so a coding agent can do the install and diagnose those four without guessing.

Two ways to use it. Read the manual path below and run it yourself, or paste the block at the end into Claude Code, Codex, OpenCode, Cursor or any agent with terminal access and let it work through the checklist.

---

## Before you start

You need:

- **Node 18 or newer.** `node --version`
- **One model API key**, or a local model server. Any tool-calling model will do.
- **A terminal.** macOS or Linux. Windows works through WSL.

No Convex account, no database, no cloud anything. `npm run setup` provisions an anonymous local Convex deployment and its data stays on your machine.

Roughly ten minutes, most of it waiting for `npm install`.

---

## The manual path

### 1. Clone and install

```bash
git clone https://github.com/amrsingh29/openclaw-fleet-manager.git
cd openclaw-fleet-manager
npm install
npm --prefix mission-control-dashboard install
```

There are two installs because the dashboard is its own package. Skipping the second one is the most common reason the UI never appears: `npm run dev` prints `ui skipped: run npm --prefix mission-control-dashboard install to enable` and carries on without it.

### 2. Set a model

```bash
cp .env.example .env
```

Then edit `.env` and uncomment one block. OpenAI is the shortest:

```bash
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o
OPENAI_API_KEY=sk-...
```

For a local model with no key:

```bash
LLM_PROVIDER=ollama
LLM_MODEL=llama3.1:8b
```

For a gateway or any OpenAI-compatible host:

```bash
LLM_PROVIDER=openai-compatible
LLM_BASE_URL=https://your-gateway.example.com/v1
LLM_API_KEY=...
LLM_MODEL=your-model-name
```

`LLM_BASE_URL` matters more than it looks. A key that works against a gateway usually does **not** work against `api.openai.com`. The failure is a 401 that reads like a bad key when the real problem is a wrong host.

### 3. Configure the stack

```bash
npm run setup
```

This does five things:

1. Checks Node is 18 or newer.
2. Creates `.env` from `.env.example` if it is missing.
3. Provisions an anonymous local Convex deployment and writes `CONVEX_URL` into `.env`, `mission-control-dashboard/.env.local` and `mission-control-v2/.env.local`.
4. Starts the backend, seeds teams, agents and policies, then repairs the `orgId` stamp on anything that was inserted without it.
5. Prints the next two commands.

It stops with instructions instead of leaving a half-configured tree. If provisioning fails, it tells you to run `CONVEX_AGENT_MODE=anonymous npx convex dev` yourself and re-run setup.

### 4. Prove the model can call tools

```bash
npm run doctor
```

This is the step that saves an evening. It runs seven checks in the order things break:

| Check | Fails when |
|---|---|
| Node version | Older than 18 |
| `fleet.yml` | Missing, or does not parse |
| Model provider | No model configured, or an unknown provider with no base URL |
| Model replies | Bad key, wrong base URL, rate limit, model does not exist |
| **Tool calling** | The model answers without calling the tool |
| Convex | `CONVEX_URL` unset or unreachable |
| Log paths | A declared log file does not exist (warning only) |

The tool-calling check makes a real call to `check_server_health` and reports what came back. A model that cannot emit tool calls passes chat fine and does nothing on a mission, which is the worst failure to debug blind. Doctor catches it here.

It exits non-zero on a blocking problem, so it works in CI and in an agent's loop.

### 5. Start it

```bash
npm run dev
```

One terminal, four things: Convex, the dashboard, and one runner per soul file in `agents/configs/`. Output is prefixed and colour-coded per process. Ctrl-C stops all of it.

Dashboard at http://localhost:5173.

### 6. Verify with a real question

Open the War Room and send:

```
@Jarvis check the health of this-host and tell me what you see
```

You should see the runner log a `check_server_health` call, then Jarvis reply with real numbers from your machine. If Jarvis answers without calling a tool, the model passed chat but not tool calling. Go back to step 4.

Then create a mission from the CLI and watch the board:

```bash
npm run task -- "Report disk usage on this-host" "Use check_server_health and report the disk figure with the evidence." --priority=medium
```

Within about five seconds an idle agent claims it, works it, and leaves a report on the Done card.

---

## Diagnosing the four usual failures

### The dashboard never appears

`npm run dev` prints `ui skipped`. You skipped the second install:

```bash
npm --prefix mission-control-dashboard install
```

If the UI loads but shows an empty fleet, the backend is up and the dashboard is pointing elsewhere. Check `VITE_CONVEX_URL` in `mission-control-dashboard/.env.local` matches `CONVEX_URL` in `.env`. `npm run setup` writes both; a hand-edited `.env` can drift from them.

### Doctor fails at "Model replies"

The message distinguishes the cases, so read it instead of the status code:

- *Authentication failed*: wrong key, or a gateway key pointed at `api.openai.com`. Check `LLM_BASE_URL`.
- *Model not found*: the name in `LLM_MODEL` is not what the provider serves. A gateway's model list is rarely the same as OpenAI's.
- *Cannot reach the provider*: DNS, VPN or a typo in the host.
- *Rate limited*: wait, or use a smaller model.

### Doctor fails at "Tool calling"

The model answered in prose instead of calling the tool. Almost always the model, not the config.

Use a model that supports tool calling: GPT-4o, Claude Sonnet, Llama 3.1 8B or larger, Qwen 2.5 7B or larger. Models under roughly 7B tend to drop the tool schema on multi-turn conversations and produce behaviour that looks like a bug in this repo.

If you are certain the model supports tools, check that no gateway is stripping the `tools` field from the request. Some proxies do, silently.

### Agents run but refuse to act on a service

That is the allowlist working. An agent can only name services declared in `fleet.yml`, and the refusal lists what is actually declared. Add your service:

```yaml
services:
  - name: nginx
    target: local
    logPaths: [/var/log/nginx/error.log]
    restart:
      manager: systemd
      unit: nginx
```

Then ask again. The config cache is five seconds, so no restart is needed.

Machine-specific hostnames belong in `fleet.local.yml`, which is gitignored and takes precedence over `fleet.yml`.

---

## Handing it to a coding agent

Paste this into Claude Code, Codex, OpenCode or Cursor opened at the repo root. It works in a fresh clone or an existing checkout.

````text
Set up and verify this repo end to end. Work through the steps in order and
stop at the first failure and report it instead of working around it.

1. Confirm Node is 18 or newer. If not, stop and tell me which version I have.

2. Run both installs:
     npm install
     npm --prefix mission-control-dashboard install

3. Check whether .env exists. If it does not, copy .env.example to .env and
   then STOP and ask me which model provider to configure — do not invent an
   API key or guess a base URL. If .env exists, read only the key names
   (never print values) and tell me which provider it is set to.

4. Run `npm run setup`. This provisions an anonymous local Convex deployment,
   seeds teams and agents, and writes CONVEX_URL into .env and the two UI env
   files. If it fails, run
     CONVEX_AGENT_MODE=anonymous npx convex dev
   in a background process, wait for the line "Convex functions ready", then
   re-run `npm run setup`.

5. Run `npm run doctor` and show me the full output. It makes a real tool call
   to verify the model supports tool calling. If the Tool calling check fails,
   report the exact message and stop — do not try alternative models without
   asking me.

6. Start the stack with `npm run dev` in the background, wait for the dashboard
   on http://localhost:5173 to return HTTP 200, and confirm the runner logs
   show each agent registering.

7. Create one test mission and confirm it completes:
     npm run task -- "Report disk usage on this-host" "Use check_server_health and report the disk figure with the evidence." --priority=medium
   Poll the Convex tasks table for up to 90 seconds and report the task's
   status and the first two lines of its output.

8. Report back: Node version, model provider and model name (not the key), the
   doctor result for each check, the dashboard URL, and whether the test
   mission reached `done`. If anything failed, quote the actual error.

Do not commit anything. Do not edit fleet.yml unless a tool call failed because
a service was missing, and tell me if you do.
````

Two things about that prompt. It refuses to invent credentials, because a coding agent asked to "set up the project" will otherwise fill in a placeholder key and report success as though it worked. And it verifies against real state (an HTTP 200 and a completed task) instead of trusting that a command exited zero.

### What to expect back

A good run reports something like: Node 20 or 22, provider `openai-compatible` with a named model, seven doctor checks passing, the dashboard reachable, and one mission in `done` with a real disk figure quoted.

A bad run looks like an agent saying "setup complete" with no doctor output. That means it skipped step 5, and the install is unverified.

---

## Optional: a restartable sandbox

The shipped example, `this-host`, has no restartable service: it points at a sample log and launchd reports it not loaded. That is deliberate: a fresh clone can read metrics and logs, but it cannot restart something that does not exist.

To exercise the approval loop for real, give the agents something disposable to restart. With Docker running:

```bash
docker run -d --name fleet-sandbox --label fleet.managed=true nginx:alpine
```

Add the target and a service to `fleet.local.yml`:

```yaml
default: local

targets:
  local:   { kind: local }
  sandbox: { kind: docker, container: fleet-sandbox }

services:
  - name: this-host
    target: local
    logPaths:
      - sandbox/logs/this-host.log

  - name: sandbox-web
    target: sandbox
    restart:
      manager: docker
      unit: fleet-sandbox

policies:
  read: auto
  write: propose_only
  delegate: auto

scanAllowlist:
  - localhost
  - 127.0.0.1
```

Now ask for a restart:

```bash
npm run task -- "Restart the sandbox-web container" "Call restart_service for service 'sandbox-web' with a reason. Do not investigate first." --priority=high
```

Under the default `propose_only` policy the restart does not run. It raises a card in the Approvals panel carrying the exact arguments. Approve it and the runner executes `docker restart fleet-sandbox` and records the real post-restart state.

Clean up when you are finished:

```bash
docker rm -f fleet-sandbox
rm fleet.local.yml    # or keep it; it is gitignored
```
