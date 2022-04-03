export interface Store<D> {
    get<T extends D>(key: string): Promise<T | undefined>;
    set<T extends D>(key: string, value: T): Promise<void>;
}
