import "reflect-metadata";
import { Container, inject, injectable } from "inversify";
import { Subject } from "rxjs";
import { Api, TelegramClient } from "telegram";
import { ProxyInterface } from "telegram/network/connection/TCPMTProxy";
import { Store } from "./BaseStore";
import { CLIENT_INJECTOR } from "./injectors/clientInjector";
import { CONFIG_STORE_INJECTOR } from "./injectors/configurationStoreInjector";
import { JsonDb } from "./JsonDb";
import { EVENTS_SUBJECT_INJECTOR } from "./injectors/eventsSubjectInjector";
import { StringSession } from "telegram/sessions";
import { NewMessage, NewMessageEvent } from "telegram/events";
import { CommandManager } from "./command-parser/CommandManager";
import { MESSAGE_CHAT_POINTER, REPLY_MESSAGE_POINTER } from "./command-parser";
import { getDisplayName } from "telegram/Utils";
import { AllCommandHandler } from "./command-handlers/all";
import { BotError } from "./errors/BotError";
import { LogCommandHandler } from "./command-handlers/log";
import { AdaminCommandHandler } from "./command-handlers/adamin";

async function main() {
    const container = new Container();
    const configStore = new JsonDb("./db-files/config.json");
    container
        .bind<Store<any>>(CONFIG_STORE_INJECTOR)
        .toConstantValue(configStore);

    const sessionString = await configStore.get<string>("session");
    const apiId = await configStore.get<number>("apiId");
    const apiHash = await configStore.get<string>("apiHash");
    const proxy = await configStore.get<ProxyInterface>("proxy");

    if (!sessionString || !apiId || !apiHash) {
        console.error(
            "Please set the session, apiId and apiHash in the config.json file."
        );
        process.exit(1);
    }

    const client = new TelegramClient(
        new StringSession(sessionString),
        apiId,
        apiHash,
        {
            proxy,
        }
    );
    await client.connect();

    const eventsSubject = new Subject<Api.TypeUpdate>();
    client.addEventHandler((e) => {
        eventsSubject.next(e);
    });

    container
        .bind<Subject<Api.TypeUpdate>>(EVENTS_SUBJECT_INJECTOR)
        .toConstantValue(eventsSubject);

    container.bind<CommandManager>(CommandManager).toSelf();
    container.bind<TelegramClient>(CLIENT_INJECTOR).toConstantValue(client);

    const manager = container.get(CommandManager);

    container.bind(AllCommandHandler).toSelf();
    container.bind(LogCommandHandler).toSelf();
    container.bind(AdaminCommandHandler).toSelf();

    manager.setHandler("adamin", container.get(AdaminCommandHandler));
    manager.setHandler("all", container.get(AllCommandHandler));
    manager.setHandler("log", container.get(LogCommandHandler));

    client.addEventHandler((m) => {
        manager.handleMessage(m).catch(async (e) => {
            if (e instanceof BotError) {
                console.error(e.message);
                const debugChatId =
                    (await configStore.get<string>("debugChatId")) || "me";

                const forwarded = (await m.message.forwardTo(debugChatId))![0]!;
                await client.sendMessage(debugChatId, {
                    replyTo: forwarded.id,
                    message: e.message,
                });

                if (
                    (await configStore.get<boolean>("removeCommandOnError")) ??
                    true
                ) {
                    await m.message.delete({ revoke: true });
                }
            }
        });
    }, new NewMessage({ outgoing: true }));
}
main();
