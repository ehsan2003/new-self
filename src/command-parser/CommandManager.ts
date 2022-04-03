import { inject, injectable } from "inversify";
import { TelegramClient } from "telegram";
import { NewMessageEvent } from "telegram/events";
import { CLIENT_INJECTOR } from "../injectors/clientInjector";
import { CommandArgumentParser } from "./index";
import { CommandHandler } from "./CommandHandler";
import { CommandNotFoundError } from "../errors/CommandNotFoundError";
import { CONFIG_STORE_INJECTOR } from "../injectors/configurationStoreInjector";
import { Store } from "../BaseStore";
import { HelpCommandHandler } from "../command-handlers/help";
@injectable()
export class CommandManager {
    private map = new Map<string, CommandHandler>();
    constructor(
        @inject(CLIENT_INJECTOR) private client: TelegramClient,
        @inject(CONFIG_STORE_INJECTOR) private config: Store<any>
    ) {
        this.map.set("help", new HelpCommandHandler(client, config, this.map));
    }
    public async handleMessage(event: NewMessageEvent) {
        const commandName = this.extractCommandName(event);

        if (!commandName) {
            return;
        }
        const handler = this.map.get(commandName);

        if (!handler) {
            throw new CommandNotFoundError(commandName, this.getCommandNames());
        }

        await this.executeHandler({ handler, event, commandName });
    }
    private async executeHandler({
        handler,
        event,
        commandName,
    }: {
        handler: CommandHandler<any>;
        event: NewMessageEvent;
        commandName: string;
    }) {
        const argsDef = handler.getDefinition().args;
        const parser = new CommandArgumentParser(
            this.client,
            event,
            argsDef || {}
        );
        const args = await parser.parse(event);
        console.log(`running command ${commandName} with args ${args}`);
        await handler.handle(args);
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
