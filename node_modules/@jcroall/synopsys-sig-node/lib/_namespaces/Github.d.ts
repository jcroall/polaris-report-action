import { RestEndpointMethodTypes } from '@octokit/rest';
export declare type PullRequest = RestEndpointMethodTypes['pulls']['get']['response']['data'];
export declare type ReviewCommentsParameter = RestEndpointMethodTypes['pulls']['createReview']['parameters']['comments'];
export declare type NewReviewComment = (ReviewCommentsParameter & Exclude<ReviewCommentsParameter, undefined>)[number];
export declare type ExistingReviewComment = RestEndpointMethodTypes['pulls']['listReviewComments']['response']['data'][number];
export declare type ExistingIssueComment = RestEndpointMethodTypes['issues']['listComments']['response']['data'][number];
