import { TelegramClient } from "telegram";
import { NewMessageEvent } from "telegram/events";
import yargs, { Options } from "yargs-parser";
import { ValidationError } from "../errors/ValidationError";
import { CommandArguments, ArgumentDefinition } from "./CommandTypes";

export const REPLY_USER_POINTER: string[] = ["reply-user", "replyed-user"];
export const MESSAGE_CHAT_POINTER: string[] = ["current-chat", "here"];
export const REPLY_MESSAGE_POINTER: string[] = ["reply-message"];

export class CommandArgumentParser {
    constructor(
        private client: TelegramClient,
        private message: NewMessageEvent,
        private args: CommandArguments
    ) {}

    async parse<T>(message: NewMessageEvent): Promise<T> {
        const text = message.message.text.trim().replace(/^![^ ]+ ?/, "");
        const newLocal = this.yargsGenerator(this.args);

        const rawArgs = yargs(text, newLocal);

        const result: any = { _: rawArgs._ };

        for (const [key, argumentDefinition] of Object.entries(this.args)) {
            let rawValue = rawArgs[key] || argumentDefinition.default;

            this.validateArgumentOrFail(rawValue, key);
            const finalValue = await this.sanitizeValue(
                rawValue,
                argumentDefinition
            );

            this.validateArgumentOrFail(finalValue, key);
            result[key] = finalValue;
        }
        return result;
    }
    private yargsGenerator(command: CommandArguments): Options {
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
    private async sanitizeValue(
        value: string | number | (string | number)[],
        argumentDefinition: ArgumentDefinition
    ): Promise<any> {
        if (Array.isArray(value)) {
            return this.sanitizeArray(value, argumentDefinition);
        }
        if (value === undefined || value === null) {
            return value;
        }

        if (argumentDefinition.type === "chat_or_user") {
            return this.sanitizeChatOrUser(value.toString());
        }

        if (argumentDefinition.type === "message") {
            return this.sanitizeMessageArgument(value.toString());
        }
        return value;
    }
    private sanitizeArray(
        initialValue: (string | number)[],
        argumentDefinition: ArgumentDefinition
    ) {
        return Promise.all(
            initialValue.map((v) => this.sanitizeValue(v, argumentDefinition))
        );
    }
    private sanitizeMessageArgument(value: string) {
        if (REPLY_MESSAGE_POINTER.includes(value))
            return this.message.message.replyToMsgId;

        if (Number.isNaN(+value)) {
            throw new ValidationError(
                "message id must be a number but got" + value
            );
        }

        return +value;
    }

    private async sanitizeChatOrUser(value: string) {
        if (MESSAGE_CHAT_POINTER.includes(value))
            return this.message.message.chat?.id;

        if (REPLY_USER_POINTER.includes(value))
            return this.message.message
                .getReplyMessage()
                .then((e) => e && e.senderId)
                .catch(() => undefined);

        return await this.client
            .getEntity(
                typeof value === "string" ? value.replace("@", "") : value
            )
            .then((v) => v?.id);
    }

    private validateArgumentOrFail(value: any, key: string) {
        if (
            (value === undefined || value === null) &&
            this.args[key].required
        ) {
            throw new ValidationError(`missing required field '${key}'`);
        }
    }
}
