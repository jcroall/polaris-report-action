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
                let pr_number = pull.number;
                process.exit(1);
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
        if (!(0, lib_1.githubIsPullRequest)()) {
            lib_1.logger.info('Not a Pull Request. Nothing to do...');
            return Promise.resolve();
        }
        /*
        logger.info(`Using JSON file path: ${JSON_FILE_PATH}`)
      
        // TODO validate file exists and is .json?
        const jsonV7Content = fs.readFileSync(JSON_FILE_PATH)
        const coverityIssues = JSON.parse(jsonV7Content.toString()) as CoverityIssuesView
      
        let mergeKeyToIssue = new Map<string, CoverityProjectIssue>()
      
        const canCheckCoverity = COVERITY_URL && COVERITY_USERNAME && COVERITY_PASSWORD && COVERITY_PROJECT_NAME
        if (!canCheckCoverity) {
          logger.warning('Missing Coverity Connect info. Issues will not be checked against the server.')
        } else {
          const allMergeKeys = coverityIssues.issues.map(issue => issue.mergeKey)
          const allUniqueMergeKeys = new Set<string>(allMergeKeys)
      
          if (canCheckCoverity && coverityIssues && coverityIssues.issues.length > 0) {
            try {
              mergeKeyToIssue = await coverityMapMatchingMergeKeys(COVERITY_URL, COVERITY_USERNAME, COVERITY_PASSWORD, COVERITY_PROJECT_NAME, allUniqueMergeKeys)
            } catch (error: any) {
              setFailed(error as string | Error)
              return Promise.reject()
            }
          }
        }
      
        const newReviewComments = []
        const actionReviewComments = await githubGetExistingReviewComments(GITHUB_TOKEN).then(comments => comments.filter(comment => comment.body.includes(COVERITY_COMMENT_PREFACE)))
        const actionIssueComments = await githubGetExistingIssueComments(GITHUB_TOKEN).then(comments => comments.filter(comment => comment.body?.includes(COVERITY_COMMENT_PREFACE)))
        const diffMap = await githubGetPullRequestDiff(GITHUB_TOKEN).then(githubGetDiffMap)
      
        for (const issue of coverityIssues.issues) {
          logger.info(`Found Coverity Issue ${issue.mergeKey} at ${issue.mainEventFilePathname}:${issue.mainEventLineNumber}`)
      
          const projectIssue = mergeKeyToIssue.get(issue.mergeKey)
          let ignoredOnServer = false
          let newOnServer = true
          if (projectIssue) {
            ignoredOnServer = projectIssue.action == 'Ignore' || projectIssue.classification in ['False Positive', 'Intentional']
            newOnServer = projectIssue.firstSnapshotId == projectIssue.lastSnapshotId
            logger.info(`Issue state on server: ignored=${ignoredOnServer}, new=${newOnServer}`)
          }
      
          const reviewCommentBody = coverityCreateReviewCommentMessage(issue)
      
          let relativePath = issue.strippedMainEventFilePathname.startsWith('/') ?
              relatavize_path(process.cwd(), issue.strippedMainEventFilePathname) :
              issue.strippedMainEventFilePathname
      
          let file_link = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/blob/${process.env.GITHUB_SHA}/${relativePath}#L${issue.mainEventLineNumber}`
          const issueCommentBody = coverityCreateIssueCommentMessage(issue, file_link)
      
          const reviewCommentIndex = actionReviewComments.findIndex(comment => comment.line === issue.mainEventLineNumber && comment.body.includes(issue.mergeKey))
          let existingMatchingReviewComment = undefined
          if (reviewCommentIndex !== -1) {
            existingMatchingReviewComment = actionReviewComments.splice(reviewCommentIndex, 1)[0]
          }
      
          const issueCommentIndex = actionIssueComments.findIndex(comment => comment.body?.includes(issue.mergeKey))
          let existingMatchingIssueComment = undefined
          if (issueCommentIndex !== -1) {
            existingMatchingIssueComment = actionIssueComments.splice(issueCommentIndex, 1)[0]
          }
      
          if (existingMatchingReviewComment !== undefined) {
            logger.info(`Issue already reported in comment ${existingMatchingReviewComment.id}, updating if necessary...`)
            if (existingMatchingReviewComment.body !== reviewCommentBody) {
              githubUpdateExistingReviewComment(GITHUB_TOKEN, existingMatchingReviewComment.id, reviewCommentBody)
            }
          } else if (existingMatchingIssueComment !== undefined) {
            logger.info(`Issue already reported in comment ${existingMatchingIssueComment.id}, updating if necessary...`)
            if (existingMatchingIssueComment.body !== issueCommentBody) {
              githubUpdateExistingIssueComment(GITHUB_TOKEN, existingMatchingIssueComment.id, issueCommentBody)
            }
          } else if (ignoredOnServer) {
            logger.info('Issue ignored on server, no comment needed.')
          } else if (!newOnServer) {
            logger.info('Issue already existed on server, no comment needed.')
          } else if (isInDiff(issue, diffMap)) {
            logger.info('Issue not reported, adding a comment to the review.')
            newReviewComments.push(createReviewComment(issue, reviewCommentBody))
          } else {
            logger.info('Issue not reported, adding an issue comment.')
            githubCreateIssueComment(GITHUB_TOKEN, issueCommentBody)
          }
        }
      
        for (const comment of actionReviewComments) {
          if (coverityIsPresent(comment.body)) {
            info(`Comment ${comment.id} represents a Coverity issue which is no longer present, updating comment to reflect resolution.`)
            githubUpdateExistingReviewComment(GITHUB_TOKEN, comment.id, coverityCreateNoLongerPresentMessage(comment.body))
          }
        }
      
        for (const comment of actionIssueComments) {
          if (comment.body !== undefined && coverityIsPresent(comment.body)) {
            info(`Comment ${comment.id} represents a Coverity issue which is no longer present, updating comment to reflect resolution.`)
            githubUpdateExistingReviewComment(GITHUB_TOKEN, comment.id, coverityCreateNoLongerPresentMessage(comment.body))
          }
        }
      
        if (newReviewComments.length > 0) {
          info('Publishing review...')
          githubCreateReview(GITHUB_TOKEN, newReviewComments)
        }
      
        info(`Found ${coverityIssues.issues.length} Coverity issues.`)
      
         */
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
        path: (0, lib_1.githubRelativizePath)(issue.mainEventFilePathname),
        body: commentBody,
        line: issue.mainEventLineNumber,
        side: 'RIGHT'
    };
}
run();
