import { CommandDefinition } from "./CommandTypes";

export interface CommandHandler<T = any> {
    handle(args: T): Promise<void>;
    getDefinition(): CommandDefinition;
}
