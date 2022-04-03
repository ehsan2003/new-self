import { BotError } from "../errors/BotError";
import didYouMean from "didyoumean";

export class CommandNotFoundError extends BotError {
    constructor(private inputName: string, private existingCommands: string[]) {
        didYouMean.returnFirstMatch = true;
        const guess = didYouMean(inputName, existingCommands) as string;

        super(
            `command '${inputName}' not found${
                guess ? `, did you mean '${guess}'?` : ""
            }`
        );
    }
    public getInputName() {
        return this.inputName;
    }
    public getExistingCommandsI() {
        return this.existingCommands;
    }
}
