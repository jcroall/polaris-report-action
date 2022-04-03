import { RestClient } from 'typed-rest-client/RestClient';
export declare const KEY_CID = "cid";
export declare const KEY_MERGE_KEY = "mergeKey";
export declare const KEY_ACTION = "action";
export declare const KEY_CLASSIFICATION = "classification";
export declare const KEY_FIRST_SNAPSHOT_ID = "firstSnapshotId";
export declare const KEY_LAST_SNAPSHOT_ID = "lastDetectedId";
export interface ICoverityIssuesSearchResponse {
    offset: number;
    totalRows: number;
    columns: string[];
    rows: ICoverityResponseCell[][];
}
export interface ICoverityResponseCell {
    key: string;
    value: string;
}
export declare class CoverityApiService {
    coverityUrl: string;
    restClient: RestClient;
    constructor(coverityUrl: string, coverityUsername: string, coverityPassword: string, client_name?: string);
    findIssues(projectName: string, offset: number, limit: number): Promise<ICoverityIssuesSearchResponse>;
}
export declare function cleanUrl(url: string): string;
