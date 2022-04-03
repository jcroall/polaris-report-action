"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.githubGetChangesForMR = void 0;
const fs_1 = __importDefault(require("fs"));
const core_1 = require("@actions/core");
const lib_1 = require("@jcroall/synopsys-sig-node/lib");
const inputs_1 = require("./inputs");
const os_1 = __importDefault(require("os"));
const PolarisInputReader_1 = __importDefault(require("@jcroall/synopsys-sig-node/lib/polaris/input/PolarisInputReader"));
const PolarisService_1 = __importDefault(require("@jcroall/synopsys-sig-node/lib/polaris/service/PolarisService"));
const ChangeSetEnvironment_1 = __importDefault(require("@jcroall/synopsys-sig-node/lib/polaris/changeset/ChangeSetEnvironment"));
const ChangeSetFileWriter_1 = __importDefault(require("@jcroall/synopsys-sig-node/lib/polaris/changeset/ChangeSetFileWriter"));
const ChangeSetReplacement_1 = __importDefault(require("@jcroall/synopsys-sig-node/lib/polaris/changeset/ChangeSetReplacement"));
const PolarisInstaller_1 = __importDefault(require("@jcroall/synopsys-sig-node/lib/polaris/cli/PolarisInstaller"));
const PolarisRunner_1 = __importDefault(require("@jcroall/synopsys-sig-node/lib/polaris/cli/PolarisRunner"));
const PolarisIssueWaiter_1 = __importDefault(require("@jcroall/synopsys-sig-node/lib/polaris/util/PolarisIssueWaiter"));
const PolarisAPI_1 = require("@jcroall/synopsys-sig-node/lib/polaris/service/PolarisAPI");
const github = require('@actions/github');
const core = require('@actions/core');
const context = github.context;
const repo = context.payload.repository;
const owner = repo.owner;
const gh = github.getOctokit(inputs_1.GITHUB_TOKEN);
const args = { owner: owner.name || owner.login, repo: repo.name, ref: undefined };
function githubGetChangesForMR(github_token) {
    return __awaiter(this, void 0, void 0, function* () {
        let changed_files = [];
        if ((0, lib_1.githubIsPullRequest)()) {
            lib_1.logger.debug(`GitHub Get Changed Files - operating on a pull request`);
            const pull = context.payload.pull_request;
            if (pull === null || pull === void 0 ? void 0 : pull.number) {
                const url = context.payload.pull_request.commits_url;
                let commits = yield gh.paginate(`GET ${url}`, args);
                for (const commit of commits) {
                    args.ref = commit.id || commit.sha;
                    let commit_data = gh.repos.getCommit(args);
                    lib_1.logger.debug(`Found file in PR: ${commit_data.file.filename}`);
                    changed_files.push(commit_data.file.filename);
                }
            }
        }
        else {
            lib_1.logger.debug(`GitHub Get Changed Files - operating on a push`);
            let commits = context.payload.commits;
            for (const commit of commits) {
                args.ref = commit.id || commit.sha;
                let commit_data = gh.repos.getCommit(args);
                lib_1.logger.debug(`Found file in push: ${commit_data.file.filename}`);
                changed_files.push(commit_data.file.filename);
            }
        }
        return (changed_files);
    });
}
exports.githubGetChangesForMR = githubGetChangesForMR;
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        lib_1.logger.info('Starting Coverity GitHub Action');
        if (inputs_1.DEBUG) {
            lib_1.logger.level = 'debug';
            lib_1.logger.debug(`Enabled debug mode`);
        }
        lib_1.logger.info(`Connecting to Polaris service at: ${inputs_1.POLARIS_URL}`);
        const task_input = new PolarisInputReader_1.default().getPolarisInputs(inputs_1.POLARIS_URL, inputs_1.POLARIS_ACCESS_TOKEN, inputs_1.POLARIS_PROXY_URL ? inputs_1.POLARIS_PROXY_URL : "", inputs_1.POLARIS_PROXY_USERNAME ? inputs_1.POLARIS_PROXY_USERNAME : "", inputs_1.POLARIS_PROXY_PASSWORD ? inputs_1.POLARIS_PROXY_PASSWORD : "", inputs_1.POLARIS_COMMAND, true, true, false);
        const connection = task_input.polaris_connection;
        var polaris_install_path;
        polaris_install_path = os_1.default.tmpdir();
        if (!polaris_install_path) {
            lib_1.logger.warn("Agent did not have a tool directory, polaris will be installed to the current working directory.");
            polaris_install_path = process.cwd();
        }
        lib_1.logger.info(`Polaris Software Integrity Platform will be installed to the following path: ` + polaris_install_path);
        lib_1.logger.info("Connecting to Polaris Software Integrity Platform server.");
        const polaris_service = new PolarisService_1.default(lib_1.logger, connection);
        yield polaris_service.authenticate();
        lib_1.logger.debug("Authenticated with polaris.");
        try {
            lib_1.logger.debug("Fetching organization name and task version.");
            const org_name = yield polaris_service.fetch_organization_name();
            lib_1.logger.debug(`Organization name: ${org_name}`);
            /*
            const task_version = PhoneHomeService.FindTaskVersion();
        
            logger.debug("Starting phone home.");
            const phone_home_service = PhoneHomeService.CreateClient(log);
            await phone_home_service.phone_home(connection.url, task_version, org_name);
            logger.debug("Phoned home.");
             */
        }
        catch (e) {
            /*
            logger.debug("Unable to phone home.");
             */
        }
        let polaris_run_result = undefined;
        if (inputs_1.SKIP_RUN) {
            polaris_run_result = {
                scan_cli_json_path: ".synopsys/polaris/cli-scan.json",
                return_code: 0
            };
        }
        else {
            //If there are no changes, we can potentially bail early, so we do that first.
            var actual_build_command = inputs_1.POLARIS_COMMAND;
            if ((0, lib_1.githubIsPullRequest)() && task_input.should_populate_changeset) {
                lib_1.logger.debug("Populating change set for Polaris Software Integrity Platform.");
                const changed_files = yield githubGetChangesForMR(inputs_1.GITHUB_TOKEN);
                for (const file in changed_files) {
                    lib_1.logger.debug(`Found changed file: ${file}`);
                }
                if (changed_files.length == 0 && task_input.should_empty_changeset_fail) {
                    lib_1.logger.error(` Task failed: No changed files were found.`);
                    return;
                }
                else if (changed_files.length == 0) {
                    lib_1.logger.info("Task finished: No changed files were found.");
                    return;
                }
                const change_set_environment = new ChangeSetEnvironment_1.default(lib_1.logger, process.env);
                const change_file = change_set_environment.get_or_create_file_path(process.cwd());
                change_set_environment.set_enable_incremental();
                yield new ChangeSetFileWriter_1.default(lib_1.logger).write_change_set_file(change_file, changed_files);
                actual_build_command = new ChangeSetReplacement_1.default().replace_build_command(actual_build_command, change_file);
            }
            lib_1.logger.info("Installing Polaris Software Integrity Platform.");
            var polaris_installer = PolarisInstaller_1.default.default_installer(lib_1.logger, polaris_service);
            var polaris_install = yield polaris_installer.install_or_locate_polaris(connection.url, polaris_install_path);
            lib_1.logger.info("Found Polaris Software Integrity Platform: " + polaris_install.polaris_executable);
            lib_1.logger.info("Running Polaris Software Integrity Platform.");
            var polaris_runner = new PolarisRunner_1.default(lib_1.logger);
            polaris_run_result = yield polaris_runner.execute_cli(connection, polaris_install, process.cwd(), actual_build_command);
            if (task_input.should_wait_for_issues) {
                lib_1.logger.info("Checking for issues.");
                var polaris_waiter = new PolarisIssueWaiter_1.default(lib_1.logger);
                var issue_count = yield polaris_waiter.wait_for_issues(polaris_run_result.scan_cli_json_path, polaris_service);
                // Ignore, we will calculate issues separately
                // logger.error(`Polaris Software Integrity Platform found ${issue_count} total issues.`)
            }
            else {
                lib_1.logger.info("Will not check for issues.");
            }
        }
        if (!polaris_run_result) {
            lib_1.logger.error(`Unable to find Polaris run results.`);
            process.exit(2);
        }
        var scan_json_text = fs_1.default.readFileSync(polaris_run_result.scan_cli_json_path);
        var scan_json = JSON.parse(scan_json_text.toString());
        const json_path = require('jsonpath');
        var project_id = json_path.query(scan_json, "$.projectInfo.projectId");
        var branch_id = json_path.query(scan_json, "$.projectInfo.branchId");
        var revision_id = json_path.query(scan_json, "$.projectInfo.revisionId");
        lib_1.logger.debug(`Connect to Polaris: ${polaris_service.polaris_url} and fetch issues for project: ${project_id} and branch: ${branch_id}`);
        let runs = yield (0, PolarisAPI_1.polarisGetRuns)(polaris_service, project_id, branch_id);
        if (runs.length > 1) {
            lib_1.logger.debug(`Most recent run is: ${runs[0].id} was created on ${runs[0].attributes["creation-date"]}`);
            lib_1.logger.debug(`Last run is: ${runs[1].id} was created on ${runs[1].attributes["creation-date"]}`);
            lib_1.logger.debug(`...`);
        }
        let branches = yield (0, PolarisAPI_1.polarisGetBranches)(polaris_service, project_id);
        let merge_target_branch = process.env["CI_MERGE_REQUEST_TARGET_BRANCH_NAME"];
        let issuesUnified = undefined;
        if ((0, lib_1.githubIsPullRequest)()) {
            let branches = yield (0, PolarisAPI_1.polarisGetBranches)(polaris_service, project_id);
            let branch_id_compare = undefined;
            for (const branch of branches) {
                if (branch.attributes.name == merge_target_branch) {
                    lib_1.logger.debug(`Running on merge request, and target branch is '${merge_target_branch}' which has Polaris ID ${branch.id}`);
                    branch_id_compare = branch.id;
                }
            }
            if (!branch_id_compare) {
                lib_1.logger.error(`Running on merge request and unable to find previous Polaris analysis for merge target: ${merge_target_branch}, will fall back to full results`);
            }
            else {
                issuesUnified = yield (0, PolarisAPI_1.polarisGetIssuesUnified)(polaris_service, project_id, branch_id, true, runs[0].id, false, branch_id_compare, "", "opened");
            }
        }
        if (!issuesUnified) {
            lib_1.logger.debug(`No merge request or merge comparison available, fetching full results`);
            issuesUnified = yield (0, PolarisAPI_1.polarisGetIssuesUnified)(polaris_service, project_id, branch_id, true, "", false, "", "", "");
        }
        lib_1.logger.info("Executed Polaris Software Integrity Platform: " + polaris_run_result.return_code);
        // TODO If SARIF
        if (!(0, lib_1.githubIsPullRequest)()) {
            lib_1.logger.info('Not a Pull Request. Nothing to do...');
            return Promise.resolve();
        }
        const newReviewComments = [];
        const actionReviewComments = yield (0, lib_1.githubGetExistingReviewComments)(inputs_1.GITHUB_TOKEN).then(comments => comments.filter(comment => comment.body.includes(PolarisAPI_1.POLARIS_COMMENT_PREFACE)));
        const actionIssueComments = yield (0, lib_1.githubGetExistingIssueComments)(inputs_1.GITHUB_TOKEN).then(comments => comments.filter(comment => { var _a; return (_a = comment.body) === null || _a === void 0 ? void 0 : _a.includes(PolarisAPI_1.POLARIS_COMMENT_PREFACE); }));
        const diffMap = yield (0, lib_1.githubGetPullRequestDiff)(inputs_1.GITHUB_TOKEN).then(lib_1.githubGetDiffMap);
        for (const issue of issuesUnified) {
            lib_1.logger.info(`Found Polaris Issue ${issue.key} at ${issue.path}:${issue.line}`);
            let ignoredOnServer = issue.dismissed;
            const reviewCommentBody = (0, PolarisAPI_1.polarisCreateReviewCommentMessage)(issue);
            const issueCommentBody = (0, PolarisAPI_1.polarisCreateReviewCommentMessage)(issue);
            const reviewCommentIndex = actionReviewComments.findIndex(comment => comment.line === issue.line &&
                comment.body.includes(issue.key));
            let existingMatchingReviewComment = undefined;
            if (reviewCommentIndex !== -1) {
                existingMatchingReviewComment = actionReviewComments.splice(reviewCommentIndex, 1)[0];
            }
            const issueCommentIndex = actionIssueComments.findIndex(comment => { var _a; return (_a = comment.body) === null || _a === void 0 ? void 0 : _a.includes(issue.key); });
            let existingMatchingIssueComment = undefined;
            if (issueCommentIndex !== -1) {
                existingMatchingIssueComment = actionIssueComments.splice(issueCommentIndex, 1)[0];
            }
            if (existingMatchingReviewComment !== undefined) {
                lib_1.logger.info(`Issue already reported in comment ${existingMatchingReviewComment.id}, updating if necessary...`);
                if (existingMatchingReviewComment.body !== reviewCommentBody) {
                    (0, lib_1.githubUpdateExistingReviewComment)(inputs_1.GITHUB_TOKEN, existingMatchingReviewComment.id, reviewCommentBody);
                }
            }
            else if (existingMatchingIssueComment !== undefined) {
                lib_1.logger.info(`Issue already reported in comment ${existingMatchingIssueComment.id}, updating if necessary...`);
                if (existingMatchingIssueComment.body !== issueCommentBody) {
                    (0, lib_1.githubUpdateExistingIssueComment)(inputs_1.GITHUB_TOKEN, existingMatchingIssueComment.id, issueCommentBody);
                }
            }
            else if (ignoredOnServer) {
                lib_1.logger.info('Issue ignored on server, no comment needed.');
            }
            else if ((0, PolarisAPI_1.polarisIsInDiff)(issue, diffMap)) {
                lib_1.logger.info('Issue not reported, adding a comment to the review.');
                newReviewComments.push(createReviewComment(issue, reviewCommentBody));
            }
            else {
                lib_1.logger.info('Issue not reported, adding an issue comment.');
                (0, lib_1.githubCreateIssueComment)(inputs_1.GITHUB_TOKEN, issueCommentBody);
            }
        }
        for (const comment of actionReviewComments) {
            if ((0, lib_1.coverityIsPresent)(comment.body)) {
                (0, core_1.info)(`Comment ${comment.id} represents a Coverity issue which is no longer present, updating comment to reflect resolution.`);
                (0, lib_1.githubUpdateExistingReviewComment)(inputs_1.GITHUB_TOKEN, comment.id, (0, lib_1.coverityCreateNoLongerPresentMessage)(comment.body));
            }
        }
        for (const comment of actionIssueComments) {
            if (comment.body !== undefined && (0, lib_1.coverityIsPresent)(comment.body)) {
                (0, core_1.info)(`Comment ${comment.id} represents a Coverity issue which is no longer present, updating comment to reflect resolution.`);
                (0, lib_1.githubUpdateExistingReviewComment)(inputs_1.GITHUB_TOKEN, comment.id, (0, lib_1.coverityCreateNoLongerPresentMessage)(comment.body));
            }
        }
        if (newReviewComments.length > 0) {
            (0, core_1.info)('Publishing review...');
            (0, lib_1.githubCreateReview)(inputs_1.GITHUB_TOKEN, newReviewComments);
        }
        (0, core_1.info)(`Found ${issuesUnified.length} Reported Polaris issues.`);
    });
}
function isInDiff(issue, diffMap) {
    const diffHunks = diffMap.get(issue.mainEventFilePathname);
    if (!diffHunks) {
        return false;
    }
    return diffHunks.filter(hunk => hunk.firstLine <= issue.mainEventLineNumber).some(hunk => issue.mainEventLineNumber <= hunk.lastLine);
}
function createReviewComment(issue, commentBody) {
    return {
        path: (0, lib_1.githubRelativizePath)(issue.path),
        body: commentBody,
        line: issue.line,
        side: 'RIGHT'
    };
}
run();
