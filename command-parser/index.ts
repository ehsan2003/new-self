import { inject, injectable } from "inversify";
import { client, TelegramClient } from "telegram";
import { NewMessageEvent } from "telegram/events";
import yargs, { Options } from "yargs-parser";
import { BotError } from "../errors/BotError";
import { ValidationError } from "../errors/ValidationError";
import { CLIENT_INJECTOR } from "../injectors/clientInjector";
type ArgumentDefinition = {
    alias?: string | string[];
    required?: boolean;
    description?: string;
    isArray?: boolean;
    type: "string" | "number" | "boolean" | "chat_or_user" | "message";
    default?: any;
};
type CommandDefinition = {
    description?: string;
    args?: CommandArguments;
};
export type CommandArguments = {
    [key: string]: ArgumentDefinition;
};

export function yargsGenerator(command: CommandArguments): Options {
    const keys = Object.keys(command);
    return {
        alias: keys.reduce((acc: any, key) => {
            acc[key] = command[key].alias;
            if (!acc[key]) delete acc[key];
            return acc;
        }, {}),
        boolean: keys.filter((k) => {
            const c = command[k];
            return c.type === "boolean";
        }),
        array: keys.filter((k) => command[k].isArray),
        string: keys.filter((k) => command[k].type === "string"),
        number: keys.filter((k) => command[k].type === "number"),
    };
}
class CommandArgumentParser {
    constructor(
        private client: TelegramClient,
        private message: NewMessageEvent,
        private args: CommandArguments
    ) {}

    async parse<T>(
        message: NewMessageEvent,
        command: CommandArguments
    ): Promise<T> {
        const text = message.message.text.trim().replace(/^![^ ]+ /, "");
        const newLocal = yargsGenerator(command);
        console.log("newLocal", newLocal);
        console.log("text", text);

        const rawArgs = yargs(text, newLocal);
        console.log("rawArgs", rawArgs);

        const result: any = {};

        for (const [key, commandDefinition] of Object.entries(command)) {
            console.log("going for key", key, commandDefinition);

            let initialValue = rawArgs[key] || commandDefinition.default;
            this.validateOrFail(commandDefinition, initialValue, key);

            const finalValue = commandDefinition.isArray
                ? await Promise.all(
                      initialValue.map((v: string) =>
                          this.sanitizeValue(v, commandDefinition)
                      )
                  )
                : await this.sanitizeValue(initialValue, commandDefinition);

            this.validateOrFail(commandDefinition, finalValue, key);
            console.log("result of that key", finalValue);
            result[key] = finalValue;
        }
        return result;
    }
    private async sanitizeValue(
        value: string | number,
        commandDefinition: ArgumentDefinition
    ) {
        if (commandDefinition.type === "chat_or_user") {
            if (value === "!_") {
                return this.message.message.chat?.id;
            } else if (value === "@_") {
                return this.message.message
                    .getReplyMessage()
                    .then((e) => e && e.senderId)
                    .catch(() => undefined);
            } else {
                return await this.client
                    .getEntity(
                        typeof value === "string"
                            ? value.replace("@", "")
                            : value
                    )
                    .then((v) => v?.id);
            }
        }

        if (commandDefinition.type === "message") {
            if (value === "$_") {
                return this.message.message.replyToMsgId;
            } else {
                2;
                if (Number.isNaN(+value)) {
                    throw new ValidationError(
                        this.message,
                        "message id must be a number"
                    );
                }
                return +value;
            }
        }
        return value;
    }
    private validateOrFail(
        commandDefinition: ArgumentDefinition,
        argumentValue: any,
        key: string
    ) {
        if (
            (argumentValue === undefined || argumentValue === null) &&
            commandDefinition.required
        ) {
            throw new ValidationError(
                this.message,
                `missing required field '${key}'`
            );
        }
    }
}
interface CommandHandler {
    handle: (event: NewMessageEvent, args: any) => Promise<void>;
    getDefinition: () => CommandDefinition;
}
export class CommandNotFoundError extends BotError {
    constructor(
        event: NewMessageEvent,
        private inputName: string,
        private existingCommands: string[]
    ) {
        super(event, `command '${inputName}' not found`);
    }
    public getInputName() {
        return this.inputName;
    }
    public getExistingCommandsI() {
        return this.existingCommands;
    }
}
@injectable()
export class CommandManager {
    private map = new Map<string, CommandHandler>();
    constructor(@inject(CLIENT_INJECTOR) private client: TelegramClient) {}
    public async handleMessage(event: NewMessageEvent) {
        console.log("handling message in manager first");

        const commandName = this.getName(event);
        console.log(commandName);

        if (!commandName) {
            return;
        }
        const handler = this.map.get(commandName);

        if (!handler) {
            throw new CommandNotFoundError(event, commandName, [
                ...this.map.keys(),
            ]);
        }
        console.log("handler found!");
        const argsDef = handler.getDefinition().args;
        if (argsDef) {
            const parser = new CommandArgumentParser(
                this.client,
                event,
                argsDef
            );
            const args = await parser.parse(event, argsDef);
            return await handler.handle(event, args);
        }
        console.log("handling message in manager second");
        await handler.handle(event, {});
    }
    public setHandler(name: string, handler: CommandHandler) {
        this.map.set(name, handler);
    }
    public removeHandler(name: string) {
        this.map.delete(name);
    }
    private getName(event: NewMessageEvent) {
        return (
            event.message.text.trim().startsWith("!") &&
            event.message.text.match(/^!([A-Za-z_0-9-]+)/)?.[1]
        );
    }
}
