import { inject, injectable } from "inversify";
import { TelegramClient } from "telegram";
import { NewMessageEvent } from "telegram/events";
import { CLIENT_INJECTOR } from "../injectors/clientInjector";
import { CommandArgumentParser } from "./index";
import { CommandHandler } from "./CommandHandler";
import { CommandNotFoundError } from "./CommandNotFoundError";

@injectable()
export class CommandManager {
    private map = new Map<string, CommandHandler>();
    constructor(@inject(CLIENT_INJECTOR) private client: TelegramClient) {}
    public async handleMessage(event: NewMessageEvent) {
        const commandName = this.extractCommandName(event);

        if (!commandName) {
            return;
        }
        const handler = this.map.get(commandName);

        if (!handler) {
            throw new CommandNotFoundError(commandName, this.getCommandNames());
        }
        const argsDef = handler.getDefinition().args;
        if (argsDef) {
            const parser = new CommandArgumentParser(
                this.client,
                event,
                argsDef
            );
            const args = await parser.parse(event);
            console.log(
                `running command ${commandName} with args ${JSON.stringify(
                    args
                )}`
            );
            return await handler.handle(event, args);
        }
        console.log(`running command ${commandName} without args`);
        await handler.handle(event, {});
    }
    private getCommandNames(): string[] {
        return [...this.map.keys()];
    }

    public setHandler(name: string, handler: CommandHandler) {
        this.map.set(name, handler);
    }
    public removeHandler(name: string) {
        this.map.delete(name);
    }
    private extractCommandName(event: NewMessageEvent) {
        return (
            event.message.text.trim().startsWith("!") &&
            event.message.text.match(/^!([A-Za-z_0-9-]+)/)?.[1]
        );
    }
}
