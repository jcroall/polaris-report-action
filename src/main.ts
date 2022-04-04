import fs from 'fs'
import {info, setFailed, warning} from '@actions/core'
import {
  COVERITY_COMMENT_PREFACE,
  coverityCreateIssueCommentMessage,
  coverityCreateNoLongerPresentMessage,
  coverityCreateReviewCommentMessage,
  coverityIsPresent,
  CoverityIssueOccurrence,
  CoverityProjectIssue,
  DiffMap,
  githubCreateIssueComment,
  githubCreateReview,
  githubGetDiffMap,
  githubGetExistingIssueComments,
  githubGetExistingReviewComments,
  githubGetPullRequestDiff,
  githubIsPullRequest,
  githubRelativizePath,
  githubUpdateExistingIssueComment,
  githubUpdateExistingReviewComment,
  coverityMapMatchingMergeKeys,
  relatavize_path,
  logger
} from '@jcroall/synopsys-sig-node/lib'
import {CoverityIssuesView} from '@jcroall/synopsys-sig-node/lib/models/coverity-json-v7-schema'
import {NewReviewComment, PullRequest} from '@jcroall/synopsys-sig-node/lib/_namespaces/github'
import {
  DEBUG, GITHUB_TOKEN,
  POLARIS_ACCESS_TOKEN, POLARIS_COMMAND,
  POLARIS_PROXY_PASSWORD,
  POLARIS_PROXY_URL,
  POLARIS_PROXY_USERNAME,
  POLARIS_URL, SKIP_RUN
} from "./inputs";
import os from "os";
import {PolarisTaskInputs} from "@jcroall/synopsys-sig-node/lib/polaris/model/PolarisTaskInput";
import PolarisInputReader from "@jcroall/synopsys-sig-node/lib/polaris/input/PolarisInputReader";
import PolarisConnection from "@jcroall/synopsys-sig-node/lib/polaris/model/PolarisConnection";
import PolarisService from "@jcroall/synopsys-sig-node/lib/polaris/service/PolarisService";
import ChangeSetEnvironment from "@jcroall/synopsys-sig-node/lib/polaris/changeset/ChangeSetEnvironment";
import ChangeSetFileWriter from "@jcroall/synopsys-sig-node/lib/polaris/changeset/ChangeSetFileWriter";
import ChangeSetReplacement from "@jcroall/synopsys-sig-node/lib/polaris/changeset/ChangeSetReplacement";
import PolarisInstaller from "@jcroall/synopsys-sig-node/lib/polaris/cli/PolarisInstaller";
import PolarisInstall from "@jcroall/synopsys-sig-node/lib/polaris/model/PolarisInstall";
import PolarisRunner from "@jcroall/synopsys-sig-node/lib/polaris/cli/PolarisRunner";
import PolarisIssueWaiter from "@jcroall/synopsys-sig-node/lib/polaris/util/PolarisIssueWaiter";
import {
  POLARIS_COMMENT_PREFACE,
  polarisCreateReviewCommentMessage,
  polarisGetBranches,
  polarisGetIssuesUnified,
  polarisGetRuns, polarisIsInDiff
} from "@jcroall/synopsys-sig-node/lib/polaris/service/PolarisAPI";
import {IPolarisIssueUnified} from "@jcroall/synopsys-sig-node/lib/polaris/model/PolarisAPI";
import {context} from "@actions/github";
import * as core from '@actions/core'
import {Octokit} from "@octokit/rest";

export async function githubGetChangesForPR(github_token: string): Promise<Array<string>> {
  let changed_files: string[] = []

  const octokit = new Octokit({ auth: github_token })

  let base = context.payload.pull_request?.base?.sha
  let head = context.payload.pull_request?.head?.sha

  logger.debug(`Get changes for Pull Request based on base commit: ${base} and head commit: ${head}`)

  const response = await octokit.repos.compareCommits({
    base,
    head,
    owner: context.repo.owner,
    repo: context.repo.repo
  })

  if (response.status !== 200) {
    logger.error(`The GitHub API for comparing the base and head commits for this ${context.eventName} event returned ${response.status}, expected 200.`)
    return(changed_files)
  }

  const files = response.data.files
  if (files) {
    for (const file of files) {
      switch (file.status) {
        case 'added':
          logger.debug(`Change set added file: ${file.filename}`)
          changed_files.push(file.filename)
          break
        case 'modified':
          logger.debug(`Change set modified file: ${file.filename}`)
          changed_files.push(file.filename)
          break
        case 'renamed':
          logger.debug(`Change set renamed file: ${file.filename}`)
          changed_files.push(file.filename)
          break
      }
    }
  }

  return (changed_files)
}
/*
const github = require('@actions/github');
const core   = require('@actions/core');

const context = github.context;
const repo    = context.payload.repository;
const owner   = repo.owner;

const gh   = github.getOctokit(GITHUB_TOKEN);
const args = { owner: owner.name || owner.login, repo: repo.name, ref: undefined };

export async function githubGetChangesForMR(github_token: string): Promise<Array<string>> {
  let changed_files: string[] = []

  if (githubIsPullRequest()) {
    logger.debug(`GitHub Get Changed Files - operating on a pull request`)

    const pull = context.payload.pull_request as PullRequest
    if (pull?.number) {
      const url = context.payload.pull_request.commits_url;
      let commits = await gh.paginate(`GET ${url}`, args);
      logger.debug(`Get commits from ${url}: ${commits}`)
      for (const commit of commits) {
        logger.debug(`  commit=${commit.id} or ${commit.sha}`)
        args.ref = commit.id || commit.sha
        let commit_data = gh.repos.getCommit(args)
        logger.debug(`Found file in PR: ${commit_data.file.filename}`)
        changed_files.push(commit_data.file.filename)
      }
    }
  } else {
    logger.debug(`GitHub Get Changed Files - operating on a push`)
    let commits = context.payload.commits
    for (const commit of commits) {
      args.ref = commit.id || commit.sha
      let commit_data = gh.repos.getCommit(args)
      logger.debug(`Found file in push: ${commit_data.file.filename}`)
      changed_files.push(commit_data.file.filename)
    }
  }

  return(changed_files)
}

 */
async function run(): Promise<void> {
  logger.info('Starting Coverity GitHub Action')

  if (DEBUG) {
    logger.level = 'debug'
    logger.debug(`Enabled debug mode`)
  }

  logger.info(`Connecting to Polaris service at: ${POLARIS_URL}`)

  const task_input: PolarisTaskInputs = new PolarisInputReader().getPolarisInputs(POLARIS_URL, POLARIS_ACCESS_TOKEN,
      POLARIS_PROXY_URL ? POLARIS_PROXY_URL : "",
      POLARIS_PROXY_USERNAME ? POLARIS_PROXY_USERNAME : "",
      POLARIS_PROXY_PASSWORD ? POLARIS_PROXY_PASSWORD : "",
      POLARIS_COMMAND, true, true, false)
  const connection: PolarisConnection = task_input.polaris_connection;

  var polaris_install_path: string | undefined;
  polaris_install_path = os.tmpdir()
  if (!polaris_install_path) {
    logger.warn("Agent did not have a tool directory, polaris will be installed to the current working directory.");
    polaris_install_path = process.cwd();
  }
  logger.info(`Polaris Software Integrity Platform will be installed to the following path: ` + polaris_install_path);

  logger.info("Connecting to Polaris Software Integrity Platform server.")
  const polaris_service = new PolarisService(logger, connection);
  await polaris_service.authenticate();
  logger.debug("Authenticated with polaris.");

  try {
    logger.debug("Fetching organization name and task version.");
    const org_name = await polaris_service.fetch_organization_name();
    logger.debug(`Organization name: ${org_name}`)
    /*
    const task_version = PhoneHomeService.FindTaskVersion();

    logger.debug("Starting phone home.");
    const phone_home_service = PhoneHomeService.CreateClient(log);
    await phone_home_service.phone_home(connection.url, task_version, org_name);
    logger.debug("Phoned home.");
     */
  } catch (e){
    /*
    logger.debug("Unable to phone home.");
     */
  }

  let polaris_run_result = undefined

  if (SKIP_RUN) {
    polaris_run_result = {
      scan_cli_json_path: ".synopsys/polaris/cli-scan.json",
      return_code: 0
    }
  } else {
    //If there are no changes, we can potentially bail early, so we do that first.
    // TODO: This may need some tweaks
    process.env.GIT_BRANCH = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME
    var actual_build_command = `${POLARIS_COMMAND}`
    if (githubIsPullRequest() && task_input.should_populate_changeset) {
      logger.debug("Populating change set for Polaris Software Integrity Platform.");
      const changed_files = await githubGetChangesForPR(GITHUB_TOKEN)
      for (const file in changed_files) {
        logger.debug(`Found changed file: ${file}`)
      }
      if (changed_files.length == 0 && task_input.should_empty_changeset_fail) {
        logger.error(` Task failed: No changed files were found.`)
        return;
      } else if (changed_files.length == 0) {
        logger.info("Task finished: No changed files were found.")
        return;
      }
      const change_set_environment = new ChangeSetEnvironment(logger, process.env);
      const change_file = change_set_environment.get_or_create_file_path(process.cwd());
      change_set_environment.set_enable_incremental();

      await new ChangeSetFileWriter(logger).write_change_set_file(change_file, changed_files);
      actual_build_command = new ChangeSetReplacement().replace_build_command(actual_build_command, change_file);
    }

    logger.info("Installing Polaris Software Integrity Platform.");
    var polaris_installer = PolarisInstaller.default_installer(logger, polaris_service);
    var polaris_install: PolarisInstall = await polaris_installer.install_or_locate_polaris(connection.url, polaris_install_path);
    logger.info("Found Polaris Software Integrity Platform: " + polaris_install.polaris_executable);

    logger.info("Running Polaris Software Integrity Platform.");
    var polaris_runner = new PolarisRunner(logger);
    polaris_run_result = await polaris_runner.execute_cli(connection, polaris_install, process.cwd(), actual_build_command);

    if (task_input.should_wait_for_issues) {
      logger.info("Checking for issues.")
      var polaris_waiter = new PolarisIssueWaiter(logger);
      var issue_count = await polaris_waiter.wait_for_issues(polaris_run_result.scan_cli_json_path, polaris_service);
      // Ignore, we will calculate issues separately
      // logger.error(`Polaris Software Integrity Platform found ${issue_count} total issues.`)
    } else {
      logger.info("Will not check for issues.")
    }
  }

  if (!polaris_run_result) {
    logger.error(`Unable to find Polaris run results.`)
    process.exit(2)
  }

  var scan_json_text = fs.readFileSync(polaris_run_result.scan_cli_json_path);
  var scan_json = JSON.parse(scan_json_text.toString());

  const json_path = require('jsonpath');
  var project_id = json_path.query(scan_json, "$.projectInfo.projectId")
  var branch_id = json_path.query(scan_json, "$.projectInfo.branchId")
  var revision_id = json_path.query(scan_json, "$.projectInfo.revisionId")

  logger.debug(`Connect to Polaris: ${polaris_service.polaris_url} and fetch issues for project: ${project_id} and branch: ${branch_id}`)

  let runs = await polarisGetRuns(polaris_service, project_id, branch_id)

  if (runs.length > 1) {
    logger.debug(`Most recent run is: ${runs[0].id} was created on ${runs[0].attributes["creation-date"]}`)
    logger.debug(`Last run is: ${runs[1].id} was created on ${runs[1].attributes["creation-date"]}`)
    logger.debug(`...`)
  }

  let branches = await polarisGetBranches(polaris_service, project_id)

  let issuesUnified = undefined

  if (githubIsPullRequest()) {
    let merge_target_branch = process.env["GITHUB_BASE_REF"]
    if (!merge_target_branch) {
      logger.error(`Running on a pull request and cannot find GitHub environment variable GITHUB_BASE_REF`)
      process.exit(2)
    }
    let branches = await polarisGetBranches(polaris_service, project_id)
    let branch_id_compare = undefined
    for (const branch of branches) {
      if (branch.attributes.name == merge_target_branch) {
        logger.debug(`Running on pull request, and target branch is '${merge_target_branch}' which has Polaris ID ${branch.id}`)
        branch_id_compare = branch.id
      }
    }

    if (!branch_id_compare) {
      logger.error(`Running on pull request and unable to find previous Polaris analysis for merge target: ${merge_target_branch}, will fall back to full results`)
    } else {
      issuesUnified = await polarisGetIssuesUnified(polaris_service, project_id, branch_id,
          true, runs[0].id, false, branch_id_compare, "", "opened")
    }
  }

  if (!issuesUnified) {
    logger.debug(`No pull request or merge comparison available, fetching full results`)
    issuesUnified = await polarisGetIssuesUnified(polaris_service, project_id, branch_id,
        true, runs[0].id, false, "", "", "")
  }

  logger.info("Executed Polaris Software Integrity Platform: " + polaris_run_result.return_code);

  // TODO If SARIF

  if (!githubIsPullRequest()) {
    logger.info('Not a Pull Request. Nothing to do...')
    return Promise.resolve()
  }



  const newReviewComments = []
  const actionReviewComments = await githubGetExistingReviewComments(GITHUB_TOKEN).then(comments => comments.filter(comment => comment.body.includes(POLARIS_COMMENT_PREFACE)))
  const actionIssueComments = await githubGetExistingIssueComments(GITHUB_TOKEN).then(comments => comments.filter(comment => comment.body?.includes(POLARIS_COMMENT_PREFACE)))
  const diffMap = await githubGetPullRequestDiff(GITHUB_TOKEN).then(githubGetDiffMap)

  for (const issue of issuesUnified) {
    logger.info(`Found Polaris Issue ${issue.key} at ${issue.path}:${issue.line}`)

    let ignoredOnServer = issue.dismissed

    const reviewCommentBody = polarisCreateReviewCommentMessage(issue)
    const issueCommentBody = polarisCreateReviewCommentMessage(issue)

    const reviewCommentIndex = actionReviewComments.findIndex(comment => comment.line === issue.line &&
        comment.body.includes(issue.key))
    let existingMatchingReviewComment = undefined
    if (reviewCommentIndex !== -1) {
      existingMatchingReviewComment = actionReviewComments.splice(reviewCommentIndex, 1)[0]
    }

    const issueCommentIndex = actionIssueComments.findIndex(comment => comment.body?.includes(issue.key))
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
    } else if (polarisIsInDiff(issue, diffMap)) {
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

  info(`Found ${issuesUnified.length} Reported Polaris issues.`)

}

function isInDiff(issue: CoverityIssueOccurrence, diffMap: DiffMap): boolean {
  const diffHunks = diffMap.get(issue.mainEventFilePathname)

  if (!diffHunks) {
    return false
  }

  return diffHunks.filter(hunk => hunk.firstLine <= issue.mainEventLineNumber).some(hunk => issue.mainEventLineNumber <= hunk.lastLine)
}

function createReviewComment(issue: IPolarisIssueUnified, commentBody: string): NewReviewComment {
  return {
    path: issue.path,
    body: commentBody,
    line: issue.line,
    side: 'RIGHT'
  }
}

run()
