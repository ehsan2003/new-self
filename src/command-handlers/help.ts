import { TelegramClient } from "telegram";
import { MESSAGE_CHAT_POINTER } from "../command-parser/index";
import { CommandHandler } from "../command-parser/CommandHandler";
import { CommandNotFoundError } from "../errors/CommandNotFoundError";
import { Store } from "../BaseStore";
import { prepareLongMessage } from "../utils/prepareLongMessage";
import {
    ArgumentDefinition,
    CommandDefinition,
} from "../command-parser/CommandTypes";
import { BigInteger } from "big-integer";
type HelpArgs = {
    here: boolean;
    chat: BigInteger;
    _: string[];
};
// this class is not being injected using inversify because it should registered within the CommandManager itself
export class HelpCommandHandler implements CommandHandler<HelpArgs> {
    constructor(
        private readonly client: TelegramClient,
        private readonly config: Store<any>,
        private readonly map: Map<string, CommandHandler>
    ) {}
    getDefinition(): CommandDefinition {
        return {
            description: "displays help for specific message",
            args: {
                here: {
                    alias: "h",
                    type: "boolean",
                    default: true,
                },
                chat: {
                    alias: "c",
                    type: "chat_or_user",
                    default: MESSAGE_CHAT_POINTER[0],
                },
            },
        };
    }
    async handle(args: HelpArgs) {
        const chatId = args.here
            ? args.chat
            : await this.config.get("debugChatId");

        const commandName = args._[0];
        const helpResult = commandName
            ? this.getCommandHelp(commandName)
            : this.getGeneralHelp();

        await this.client.sendMessage(
            chatId,
            prepareLongMessage(
                helpResult.trim() === "" ? "Nothing to show" : helpResult
            )
        );
    }
    private getGeneralHelp() {
        return [...this.map.entries()]
            .map(
                ([name, handler]) =>
                    `<b>${name}</b> \n  -     ${
                        handler.getDefinition().description?.trim() ||
                        "<no definition provided>"
                    }`
            )
            .join("\n\n");
    }

    private getCommandHelp(commandName: any) {
        const command = this.map.get(commandName);
        if (!command) {
            throw new CommandNotFoundError(commandName, [...this.map.keys()]);
        }
        const commandDef = command.getDefinition();
        const argsHelp = Object.entries(commandDef.args || {})
            .map(this.argumentGenerator)
            .join("\n");

        const result = `<b>${commandName}</b>\n -  ${
            commandDef.description || "<No description>"
        }\n\n${argsHelp}`;
        return result;
    }

    private argumentGenerator([key, def]: [string, ArgumentDefinition]) {
        const { type, default: d, description, alias, isArray, required } = def;
        const aliasArray = Array.isArray(alias) ? alias : [alias];
        const commaSeparatedNames = [key, ...aliasArray]
            .map((e) => (e?.length === 1 ? "-" + e : "--" + e))
            .join(",");
        const argType = `${isArray ? "[..." : ""}${type}${isArray ? "]" : ""}`;
        const defaultHelp = d ? `(default: <i>${d})</i>` : "";
        const requiredIndicator = required ? "required" : "[optional]";
        const visibleDescription = description || "<No description>";
        return `<b>${commaSeparatedNames}</b> - ${argType} ${defaultHelp} ${requiredIndicator}\n${visibleDescription}`;
    }
}
