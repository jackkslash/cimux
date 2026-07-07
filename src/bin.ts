#!/usr/bin/env node
import { runCimuxCli } from "./cli/cimux-cli.js";

process.exitCode = await runCimuxCli(process.argv.slice(2));
