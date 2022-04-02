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
import { CommandManager } from "./command-parser";

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
    manager.setHandler("log", {
        getDefinition: () => ({
            args: {
                h: {
                    type: "string",
                    isArray: true,
                    required: true,
                },
                b: {
                    type: "message",
                    isArray: true,
                },
                message: {
                    type: "chat_or_user",
                    alias: "m",
                    isArray: true,
                },
            },
        }),
        handle: async (e, args) => {
            console.log(args);
        },
    });
    client.addEventHandler((m) => {
        console.log("event wow");

        manager.handleMessage(m);
    }, new NewMessage({ outgoing: true }));
}
main();
