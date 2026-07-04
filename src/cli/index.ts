import { Command } from "commander";
import { registerAdoptCommand } from "./commands/adopt.js";
import { registerInfoCommand } from "./commands/info.js";
import { registerInitCommand } from "./commands/init.js";
import { registerInstallCommand } from "./commands/install.js";
import { registerListCommand } from "./commands/list.js";
import { registerRemoveCommand } from "./commands/remove.js";
import { registerSearchCommand } from "./commands/search.js";
import { registerUpdateCommand } from "./commands/update.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("surplus")
    .description("WoW Addon Manager CLI for Linux")
    .version("0.1.0");

  registerInitCommand(program);
  registerAdoptCommand(program);
  registerListCommand(program);
  registerSearchCommand(program);
  registerInstallCommand(program);
  registerUpdateCommand(program);
  registerRemoveCommand(program);
  registerInfoCommand(program);

  return program;
}
