import { BigInteger } from "big-integer";
import { inject, injectable } from "inversify";
import { Api, TelegramClient } from "telegram";
import { NewMessageEvent } from "telegram/events";
import { chunks, getDisplayName } from "telegram/Utils";
import { MESSAGE_CHAT_POINTER, REPLY_MESSAGE_POINTER } from "../command-parser";
import { CommandHandler } from "../command-parser/CommandHandler";
import { CommandDefinition } from "../command-parser/CommandTypes";
import { CLIENT_INJECTOR } from "../injectors/clientInjector";
export type Args = {
    chat: BigInteger;
    interval: number;
    count: number;
    message?: number;
};
@injectable()
export class AdaminCommandHandler implements CommandHandler<Args> {
    constructor(@inject(CLIENT_INJECTOR) private client: TelegramClient) {}
    async handle(args: Args): Promise<void> {
        const users = await this.client.getParticipants(args.chat, {});
        const admins = users.filter(
            (u: any) =>
                u.participant instanceof Api.ChannelParticipantAdmin ||
                u.participant instanceof Api.ChannelParticipantCreator
        );

        const usersChunks = chunks(admins, args.count);

        for (const users of usersChunks) {
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
            description: "mentions admins in a group",
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
