import { readFile, writeFile } from "fs/promises";
import { injectable } from "inversify";
import { Store } from "./BaseStore";

@injectable()
export class JsonDb implements Store<any> {
    constructor(private filePath: string) {}
    state: { [key: string]: any } = {};
    async get<T extends any>(key: string): Promise<T | undefined> {
        const file = await readFile(this.filePath, { encoding: "utf8" });
        const json = JSON.parse(file);
        return json[key];
    }
    async set<T extends any>(key: string, value: T): Promise<void> {
        const file = await readFile(this.filePath, "utf8");
        const json = JSON.parse(file);
        json[key] = value;
        await writeFile(this.filePath, JSON.stringify(json));
    }
}
