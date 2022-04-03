import { AbstractLevel } from "abstract-level";
import { Store } from "./BaseStore";

export class LevelStore<T> implements Store<T> {
    constructor(
        private level: AbstractLevel<string | Buffer | Uint8Array, string, T>
    ) {}
    get<D extends T>(key: string): Promise<D | undefined> {
        return this.level
            .get(key)
            .catch((e) => (e.notFound ? undefined : Promise.reject(e))) as any;
    }
    set<D extends T>(key: string, value: D): Promise<void> {
        return this.level.put(key, value);
    }
}
