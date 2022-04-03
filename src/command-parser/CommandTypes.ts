export type ArgumentDefinition = {
    alias?: string | string[];
    required?: boolean;
    description?: string;
    isArray?: boolean;
    type: "string" | "number" | "boolean" | "chat_or_user" | "message";
    default?: any;
};
export type CommandDefinition = {
    description?: string;
    args?: CommandArguments;
};
export type CommandArguments = {
    [key: string]: ArgumentDefinition;
};
