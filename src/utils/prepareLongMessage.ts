import { SendMessageParams } from "telegram/client/messages";

export function prepareLongMessage(text: string): SendMessageParams {
    if (text.length > 3900) {
        return {
            file: Buffer.from(text),
        };
    }
    return { message: `<pre>${text}</pre>`, parseMode: "html" };
}
