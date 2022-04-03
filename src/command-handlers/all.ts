import { BigInteger } from "big-integer";
import { inject, injectable } from "inversify";
import { TelegramClient } from "telegram";
import { NewMessageEvent } from "telegram/events";
import { chunks as getChunks, getDisplayName } from "telegram/Utils";
import { MESSAGE_CHAT_POINTER, REPLY_MESSAGE_POINTER } from "../command-parser";
import { CommandDefinition } from "../command-parser/CommandTypes";
import { CommandHandler } from "../command-parser/CommandHandler";
import { CLIENT_INJECTOR } from "../injectors/clientInjector";

export type AllArguments = {
    chat: BigInteger;
    interval: number;
    count: number;
    message?: number;
};

@injectable()
export class AllCommandHandler implements CommandHandler {
    constructor(@inject(CLIENT_INJECTOR) private client: TelegramClient) {}
    async handle( args: AllArguments): Promise<void> {
        const users = await this.client.getParticipants(args.chat, {});
        const chunks = getChunks(users, args.count);

        for (const users of chunks) {
            await this.client.sendMessage(args.chat, {
                message: users
                    .map(
                        (u) =>
                            `<a href="tg://user?id=${u.id}">${getDisplayName(
                                u
                            )}</a>`
                    )
                    .join(", "),
                parseMode: "html",
                replyTo: args.message,
            });
            await new Promise((r) => setTimeout(r, args.interval));
        }
    }
    getDefinition(): CommandDefinition {
        return {
            description: "mentions all users in the group",
            args: {
                message: {
                    type: "message",
                    default: REPLY_MESSAGE_POINTER[0],
                    alias: "m",
                    required: false,
                },
                count: {
                    type: "number",
                    required: false,
                    default: 5,
                    alias: "n",
                },
                interval: {
                    type: "number",
                    required: false,
                    default: 1000,
                    alias: "i",
                },
                chat: {
                    type: "chat_or_user",
                    required: false,
                    default: MESSAGE_CHAT_POINTER[0],
                },
            },
        };
    }
}
