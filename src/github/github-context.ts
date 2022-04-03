import {PullRequest} from '../_namespaces/github'
import {context} from '@actions/github'

const prEvents = ['pull_request', 'pull_request_review', 'pull_request_review_comment']

export function isPullRequest(): boolean {
  return prEvents.includes(context.eventName)
}

export function getSha(): string {
  let sha = context.sha
  if (isPullRequest()) {
    const pull = context.payload.pull_request as PullRequest
    if (pull?.head.sha) {
      sha = pull?.head.sha
    }
  }

  return sha
}

export function getPullRequestNumber(): number | undefined {
  let pr_number = undefined
  if (isPullRequest()) {
    const pull = context.payload.pull_request as PullRequest
    if (pull?.number) {
      pr_number = pull.number
    }
  }

  return pr_number
}

export function relativizePath(path: string): string {
  let length = process.env.GITHUB_WORKSPACE?.length
  if (!length) {
    length = 'undefined'.length
  }

  return path.substring(length + 1)
}
