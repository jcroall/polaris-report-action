import {getInput} from '@actions/core'

export const GITHUB_TOKEN = getInput('github-token')
export const POLARIS_URL = getInput('polaris-url')
export const POLARIS_ACCESS_TOKEN = getInput('polaris-access-token')
export const POLARIS_COMMAND = getInput('polaris-command')
export const DEBUG = getInput('debug')
export const DIAGNOSTIC = getInput('diagnostic')
export const POLARIS_PROXY_URL = getInput('polaris-proxy-url')
export const POLARIS_PROXY_USERNAME = getInput('polaris-proxy-username')
export const POLARIS_PROXY_PASSWORD = getInput('polaris-proxy-password')
export const GENERATE_SARIF = getInput('generate-sarif')
export const SECURITY_GATE_FILTERS = getInput('security-gate-filters')
export const SKIP_RUN = getInput('skip-run')

