// Shell execution helpers. Two rules here, both load-bearing:
//
// 1. argv arrays, never interpolated strings. The model's output reaches these
//    functions, and a log line containing a quote or semicolon must not become
//    a second command. There is no string-concatenation path to the shell.
// 2. No sudo. A tool that silently escalates is worse than one that fails,
//    because the failure is visible. Elevation is the operator's decision.

import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execFileAsync = promisify(execFile);

export type ExecResult = {
    ok: boolean;
    stdout: string;
    stderr: string;
    code: number | null;
    /** True when the binary itself was absent, which is common and expected. */
    missing: boolean;
};

export type ExecOpts = {
    timeoutMs?: number;
};

const DEFAULT_TIMEOUT = 10_000;

/**
 * Runs a command with an argument vector. Never joins arguments into a string.
 * A non-zero exit is returned, not thrown: a failing `launchctl list` is data.
 */
export async function run(bin: string, args: string[], opts: ExecOpts = {}): Promise<ExecResult> {
    try {
        const { stdout, stderr } = await execFileAsync(bin, args, {
            timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT,
            maxBuffer: 8 * 1024 * 1024,
            // Keep the child environment minimal: no inherited secrets beyond PATH.
            env: { PATH: process.env.PATH ?? "/usr/bin:/bin", LANG: "C" },
        });
        return { ok: true, stdout, stderr, code: 0, missing: false };
    } catch (err: any) {
        const code = typeof err?.code === "number" ? err.code : null;
        const missing = err?.code === "ENOENT" || /not found|No such file/i.test(err?.message ?? "");
        return {
            ok: false,
            stdout: err?.stdout ?? "",
            stderr: err?.stderr ?? err?.message ?? String(err),
            code,
            missing,
        };
    }
}

/** Runs a command and returns stdout, or the error text. For read-only probes. */
export async function runText(bin: string, args: string[], opts: ExecOpts = {}): Promise<string> {
    const r = await run(bin, args, opts);
    if (r.missing) return `(${bin} not available)`;
    return (r.ok ? r.stdout : r.stderr).trim();
}

/**
 * Resolves a binary against PATH without a shell. Using `sh -c "command -v ..."`
 * here would reintroduce exactly the string interpolation this file exists to
 * avoid, so walk PATH directly instead.
 */
export function whichSync(bin: string): string | null {
    if (bin.includes("/")) {
        return fs.existsSync(bin) && fs.statSync(bin).isFile() ? bin : null;
    }
    const dirs = (process.env.PATH ?? "/usr/bin:/bin").split(path.delimiter);
    for (const dir of dirs) {
        if (!dir) continue;
        const candidate = path.join(dir, bin);
        try {
            if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
        } catch {
            /* unreadable dir, keep looking */
        }
    }
    return null;
}
