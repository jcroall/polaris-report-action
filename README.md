# Coverity Report For v7 JSON Output

![GitHub tag (latest SemVer)](https://img.shields.io/github/v/tag/synopsys-sig/coverity-report-output-v7-json?color=blue&label=Latest%20Version&sort=semver)

Uses Coverity's v7 JSON output to provide comments on Pull Requests about code quality issues. 

**Note**: This action does not run Coverity command line tools. It is purely a way to expose Coverity output within GitHub.

# Quick Start Guide
To start using this action, add the following step to your existing GitHub workflow. 

```yaml
  - name: Parse Coverity JSON
    uses: synopsys-sig/coverity-report-output-v7-json@<version>
    with:
        json-file-path: $COVERITY_OUTPUT_PATH
```

Replace `<version>` with the version of the action you would like to use. 
Set the parameter `json-file-path` to the path where the Coverity v7 JSON output can be found. This is the file generated using the following command: 
```bash
cov-format-errors --dir /path/to/coverity/capture/results --security-file path/to/license/coverity-license.dat --json-output-v7 coverity-full-results.json
```

# Using The Action With Coverity
The way Coverity should be used is unique to your software. The following is an example of how Coverity could be used within a GitHub workflow in conjunction with this action. This workflow uses a self-hosted runner with Coverity tools pre-installed.

This workflow does the following:
1. Creates a new Coverity license file from content stored in a GitHub secret.
2. Runs `cov-manage-im` to ensure the project and stream are configured on the Coverity server.
3. Runs `cov-capture`, `cov-analyze` to create Coverity results. With those results, it runs `cov-format-errors` to generate the JSON file for this action to consume.
4. Runs this action to consume the JSON file produced in the previous step.

```yaml
name: Coverity with Self-Hosted Runner
on:
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: [self-hosted]

    env:
      COVERITY_URL: ${{ secrets.COVERITY_URL }}
      COV_USER: ${{ secrets.COVERITY_USER }}
      COVERITY_PASSPHRASE: ${{ secrets.COVERITY_PASSPHRASE }}
      COVERITY_LICENSE: ${{ secrets.COVERITY_LICENSE }}
      SECURITY_GATE_VIEW: OWASP Web Top 10
      COVERITY_CHECKERS: --webapp-security

    steps:
      - uses: actions/checkout@v2

      - name: Create Coverity License File
        run: |
          echo $COVERITY_LICENSE > coverity-license.dat
          
      - name: Create Coverity Stream
        # Only create a new stream for 'push' events
        if: ${{github.event_name == 'push'}}
        run: |
          env
          export COVERITY_STREAM_NAME=${GITHUB_REPOSITORY##*/}-${GITHUB_REF##*/}
          echo Ensure that stream "$COVERITY_STREAM_NAME" exists
          cov-manage-im --url $COVERITY_URL --on-new-cert trust --mode projects --add --set name:"$COVERITY_STREAM_NAME" || true
          cov-manage-im --url $COVERITY_URL --on-new-cert trust --mode streams --add -set name:"$COVERITY_STREAM_NAME" || true
          cov-manage-im --url $COVERITY_URL --on-new-cert trust --mode projects --update --name "$COVERITY_STREAM_NAME" --insert stream:"$COVERITY_STREAM_NAME"

      - name: Coverity Scan (Full Analysis)
        # Only run analysis for 'push' events
        if: ${{github.event_name == 'push'}}
        run: |
          export COVERITY_STREAM_NAME=${GITHUB_REPOSITORY##*/}-${GITHUB_REF##*/}
          cov-capture --dir idir --project-dir .
          cov-analyze --dir idir --strip-path `pwd` --security-file coverity-license.dat $COVERITY_CHECKERS
          cov-commit-defects --dir idir --security-file coverity-license.dat --ticker-mode none --url $COVERITY_URL --on-new-cert trust --stream $COVERITY_STREAM_NAME --scm git --description "GitHub Workflow $GITHUB_WORKFLOW for $GITHUB_REPO" --version $GITHUB_SHA
          cov-format-errors --dir idir --security-file coverity-license.dat --json-output-v7 coverity-full-results.json
      
        # Here is where this action is called
        - name: Coverity Report
          uses: synopsys-sig/coverity-report-output-v7-json@v0.0.0
          with:
              json-file-path: ./coverity-full-results.json
```

## Include Custom Certificates (Optional)

To include one or more root CA certificates, set `NODE_EXTRA_CA_CERTS` to the certificate file-path(s) in the environment. 
Notes: 

- The certificate(s) must be in _pem_ format. 
- This environment variable can also be used with the _Create Policy Action_.  

**Example**:   
```yaml
- name: Coverity Report
        uses: synopsys-sig/coverity-report-output-v7-json@v0.0.0
        env:
            NODE_EXTRA_CA_CERTS: ${{ secrets.LOCAL_CA_CERT_PATH }}
        with:
            . . .
```
### Troubleshooting Certificates
- Problem: An error saying the file-path to the certificate cannot be read.
  - Solution: Ensure whitespace and other special characers are properly escaped based on your runner's OS.
- Problem: An error about missing certificates in the certificate-chain or missing root certificates.
  - Solution: You may only be including the server's certificate and not the _root CA certificate_. Ensure you are using the _root CA certificate_.
