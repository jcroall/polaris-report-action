export interface SigmaIssuesView {
    revision: string;
    issues: SigmaIssueWrapper;
}
export interface SigmaIssueWrapper {
    created: string;
    issues: SigmaIssueOccurrence[];
}
export interface SigmaIssueOccurrence {
    checker_id: string;
    uuid: string;
    summary: string;
    desc: string;
    remediation: string;
    severity: SigmaIssueSeverity;
    taxonomies: SigmaIssueTaxonomy;
    filepath: string;
    function: string;
    language: string;
    location: SigmaIssueLocations;
    issue_type: string;
    tags: Array<string>;
    fixes?: SigmaIssueFix[];
    stateOnServer?: StateOnServer;
}
export interface SigmaIssueSeverity {
    level: string;
    impact: string;
    likelihood: string;
}
export interface SigmaIssueTaxonomy {
    cwe: Array<number>;
}
export interface SigmaIssueLocations {
    start: SigmaIssueLocation;
    end: SigmaIssueLocation;
}
export interface SigmaIssueLocation {
    line: number;
    column: number;
    byte: number;
}
export interface SigmaIssueFix {
    desc: string;
    actions: SigmaIssueFixAction[];
}
export interface SigmaIssueFixAction {
    location: SigmaIssueLocations;
    kind: string;
    contents: string;
}
export interface StateOnServer {
    cid: number;
    presentInReferenceSnapshot: boolean;
    firstDetectedDateTime: string;
    stream: string;
    components: string[];
    componentOwners?: any;
    cached: boolean;
    retrievalDateTime: string;
    ownerLdapServerName: string;
    triage: Triage;
    customTriage: CustomTriage;
}
export interface Triage {
    classification: string;
    action: string;
    fixTarget: string;
    severity: string;
    legacy: string;
    owner: string;
    externalReference: string;
}
export interface CustomTriage {
}
