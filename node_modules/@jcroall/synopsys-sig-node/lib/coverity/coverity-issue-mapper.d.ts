export declare class CoverityProjectIssue {
    cid: string;
    mergeKey: string | null;
    action: string;
    classification: string;
    firstSnapshotId: string;
    lastSnapshotId: string;
    constructor(cid: string, mergeKey: string | null, action: string, classification: string, firstSnapshotId: string, lastSnapshotId: string);
}
export declare function coverityMapMatchingMergeKeys(coverity_url: string, coverity_username: string, coverity_passphrase: string, coverity_project_name: string, relevantMergeKeys: Set<string>): Promise<Map<string, CoverityProjectIssue>>;
