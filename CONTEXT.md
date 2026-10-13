# Flaky Test Tracker

Collects test results from CI across many runs and identifies tests that pass and fail on the same code, so a team can tell flakiness apart from real breakage.

## Language

### Actors

**Engineer**:
A developer whose CI build went red and who needs to know whether the failure is theirs or a known Flaky Test. The primary user.
_Avoid_: Developer, user, dev

**Tech Lead**:
A person who decides which Flaky Tests the team fixes first. Same view and permissions as an Engineer; a persona, not a role.
_Avoid_: Manager, lead, owner

**CI Pipeline**:
The automated build that submits Reports using an Upload Token. The only actor that writes test data.
_Avoid_: Bot, runner, agent

### Ingestion

**Project**:
One source repository whose test results are tracked. All other data belongs to exactly one Project.
_Avoid_: Repo, workspace, app

**Operator**:
The person who runs the deployment and performs privileged actions such as creating a Project and issuing its Upload Token.
_Avoid_: Admin, owner, superuser

**Upload Token**:
A secret issued per Project that lets CI submit Reports for that Project and nothing else.
_Avoid_: API key, CI key, access token

**Report**:
One JUnit XML document submitted by CI for a single Commit, kept unchanged as received. A Report with the same content as one already received for the Project is a duplicate and is ignored.
_Avoid_: Upload, artifact, JUnit file, test run

**Commit**:
The exact source revision (full SHA) a Report was produced from.
_Avoid_: Revision, version, build

### Analysis

**Test**:
A single test case within a Project, identified by its JUnit `classname` and `name` exactly as reported. A renamed test is a new Test.
_Avoid_: Test case, spec, check

**Outcome**:
The result a Test had in one Report: passed, failed or skipped. A JUnit `failure` and a JUnit `error` are both failed.
_Avoid_: Status, result, verdict

**Flaky Test**:
A Test that has both a passed and a failed Outcome on the same Commit.
_Avoid_: Unstable test, intermittent test, broken test

**Flake**:
One Commit on which a Test showed both passed and failed Outcomes; the evidence that makes a Test a Flaky Test.
_Avoid_: Flaky run, flaky failure

### Not in the language (iteration 1)

**Run** (a group of Reports from one CI run) is deliberately not a concept. The CI run ID is only an attribute of a Report.
