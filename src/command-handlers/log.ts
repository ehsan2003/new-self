import { BigInteger } from "big-integer";
import { inject, injectable } from "inversify";
import { TelegramClient } from "telegram";
import { NewMessageEvent } from "telegram/events";
import { Store } from "../BaseStore";
import { MESSAGE_CHAT_POINTER, REPLY_MESSAGE_POINTER } from "../command-parser";
import { CommandHandler } from "../command-parser/CommandHandler";
import { CommandDefinition } from "../command-parser/CommandTypes";
import { CLIENT_INJECTOR } from "../injectors/clientInjector";
import { CONFIG_STORE_INJECTOR } from "../injectors/configurationStoreInjector";
type LogArgs = {
    here: boolean;
    chat: BigInteger;
    message: number;
};
@injectable()
export class LogCommandHandler implements CommandHandler<LogArgs> {
    constructor(
        @inject(CLIENT_INJECTOR) private client: TelegramClient,
        @inject(CONFIG_STORE_INJECTOR) private config: Store<any>
    ) {}
    async handle(_: NewMessageEvent, args: LogArgs): Promise<void> {
        const destChat = args.here
            ? args.chat
            : await this.config.get("debugChatId");

        const message = (
            await this.client.getMessages(args.chat, {
                ids: args.message,
            })
        )[0];

        await this.client.sendMessage(destChat, {
            message: `<pre>${JSON.stringify(message, null, 2)}</pre>`,
            parseMode: "html",
        });
    }
    getDefinition(): CommandDefinition {
        return {
            args: {
                here: {
                    type: "boolean",
                    default: false,
                    alias: "h",
                },
                chat: {
                    type: "chat_or_user",
                    default: MESSAGE_CHAT_POINTER[0],
                    alias: "c",
                },
                message: {
                    type: "message",
                    default: REPLY_MESSAGE_POINTER[0],
                    alias: "m",
                    required: true,
                },
            },
        };
    }
}
