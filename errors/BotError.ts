import { NewMessageEvent } from "telegram/events";

export class BotError extends Error {
    constructor(private initiatorMessage: NewMessageEvent, msg: string) {
        super(msg);
    }
    public getInitiator() {
        return this.initiatorMessage;
    }
}
