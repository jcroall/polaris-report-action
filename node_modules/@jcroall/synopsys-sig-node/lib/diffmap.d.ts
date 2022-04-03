export declare type DiffMap = Map<string, Hunk[]>;
export interface Hunk {
    firstLine: number;
    lastLine: number;
}
