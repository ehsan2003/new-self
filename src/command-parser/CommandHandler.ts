import { NewMessageEvent } from "telegram/events";
import { CommandDefinition } from "./CommandTypes";

export interface CommandHandler<T = any> {
    handle(event: NewMessageEvent, args: T): Promise<void>;
    getDefinition(): CommandDefinition;
}
