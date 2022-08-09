/*
 * Copyright © 2021-2022 NowSecure Inc.
 *
 * SPDX-License-Identifier: MIT
 */

import * as core from "@actions/core";
import { NowSecure } from "./nowsecure-client";
import { Octokit } from "@octokit/action";
import { promisify } from "util";
import { Finding } from "./types/platform";

const sleep = promisify(setTimeout);

export async function run() {
  if (core.getInput("create_issues")) {
    const octokit = new Octokit({
      auth: core.getInput("GITHUB_TOKEN"),
    });
    console.log("octokit loaded");

    const apiUrl = core.getInput("api_url");
    const labApiUrl = core.getInput("lab_api_url");

    const platformToken = core.getInput("platform-token");
    const reportId = core.getInput("report_id");
    console.log("fetch report with id", reportId);

    const assignees = core.getInput("assignees");
    const repo = core.getInput("repo");
    const repo_owner = core.getInput("repo_owner");
    const minimum_severity = core.getInput("minimum_severity");
    console.log("minimum_severity:", minimum_severity);

    const ns = new NowSecure(platformToken, apiUrl, labApiUrl);
    let pollInterval = 60000;
    let issueInterval = 1000;

    // Poll Platform to resolve the report ID to a report.
    // GitHub Actions will handle the timeout for us in the event something goes awry.
    let report = null;

    for (;;) {
      console.log("Fetch report:", reportId);
      report = await ns.pullReport(reportId);

      // NOTE: No optional chaining on Node.js 12 in GitHub Actions.
      try {
        if (report.data.auto.assessments[0].report) {
          console.log("report found");
          break;
        } else {
          await sleep(pollInterval);
        }
      } catch (e) {
        console.error(e);
        // No report data.
      }
    }

    console.log(
      "total number of findings: ",
      report.data.auto.assessments[0].report.findings.length
    );
    //console.log("findings:", report.data.auto.assessments[0].report);

    // pull all the issues we have to determine dupes and to re-open issues.
    // note, per_page is hardcoded to 3000 here.  Ask Keegan.
    const existing = await octokit.request(
      "GET /repos/{owner}/{repo}/issues?state=all&per_page=3000&state=all&sort=created",
      {
        owner: repo_owner,
        repo: repo,
      }
    );
    console.log("existing issues collection size: ", existing.data.length);
    // there are zero existing issues, so create new from findings.
    // Note:  if there are pull requests open OR closed, they will be returned
    // in the result set of the /issues API call.
    if (!existing || existing.data.length < 0) {
      //console.log("no existing issues, create new ones!");
      for (var finding of report.data.auto.assessments[0].report.findings) {
        console.log("finding title:", finding.title);
        console.log("finding severity:", finding.severity);
        console.log(
          "WARN:",
          JSON.stringify(finding.check.issue ? finding.check.issue.warn : "")
        );

        console.log(
          "CVSS:",
          JSON.stringify(finding.check.issue ? finding.check.issue.cvss : "")
        );

        if (isSeverityThresholdMet(finding, minimum_severity)) {
          console.log("create new issue");
          console.log(
            "finding title / severity / cvss ",
            finding.title + " " + finding.severity
          );
          await octokit.request("POST /repos/{owner}/{repo}/issues", {
            owner: repo_owner,
            repo: repo,
            title: finding.title,
            body: buildBody(finding),
            assignees: [assignees],
            //labels: [finding.severity], never use labels for now
          });
          sleep(issueInterval); // avoid secondary rate limit
        }
      }
    } else if (existing && existing.data) {
      console.log("existing issues found");
      for (var finding of report.data.auto.assessments[0].report.findings) {
        console.log("finding title:", finding.title);
        console.log("finding severity:", finding.severity);
        console.log(
          "WARN:",
          JSON.stringify(finding.check.issue ? finding.check.issue.warn : "")
        );

        console.log(
          "CVSS:",
          JSON.stringify(finding.check.issue ? finding.check.issue.cvss : "")
        );
        console.log("/n");
        console.log("/n");
        if (isSeverityThresholdMet(finding, minimum_severity)) {
          let issueToUpdate = await issueExists(finding, existing.data);
          console.log("issueToUpdate", issueToUpdate);
          if (issueToUpdate > 0) {
            // re-open the issue
            console.log("re-open issue:", issueToUpdate);
            await octokit.request(
              "PATCH /repos/{owner}/{repo}/issues/{issue_number}",
              {
                owner: repo_owner,
                repo: repo,
                issue_number: issueToUpdate,
                state: "open",
              }
            );
            sleep(issueInterval); // avoid secondary rate limit
          } else if (issueToUpdate === 0) {
            // create a new GH Issue
            console.log("create new issue");
            console.log(
              "finding title / severity",
              finding.title + " " + finding.severity
            );
            await octokit.request("POST /repos/{owner}/{repo}/issues", {
              owner: repo_owner,
              repo: repo,
              title: finding.title,
              body: buildBody(finding),
              assignees: [assignees],
              // labels: [finding.severity],
            });
            sleep(issueInterval); // avoid secondary rate limit
          }
        }
      }
    }
  }
}

export async function issueExists(finding: Finding, existing: any) {
  // pass back the id if we need to update.  will always be greater than zero
  // pass back 0 to create a new issue
  // pass back -1 to do nothing (we already have this issue, and it's not closed)
  let result = 0; // default to we didn't find THIS issue in the existing collection
  for (var ex of existing) {
    if (
      ex.title === finding.title &&
      ex.body &&
      ex.body.indexOf(finding.key) >= 0
    ) {
      // unique key matches
      // the issue already exists, check status
      console.log(
        "Issue title and unique_id match",
        ex.title + " " + finding.title
      );

      if (ex.state && ex.state === "closed") {
        // pass back the id of the issue to be re-opened
        console.log("re-open issue #: ", ex.number);
        result = ex.number;
        break;
      } else if (ex.state === "open") {
        // do NOT create a dupe ticket
        console.log("ticket already exists, skip");
        result = -1;
        break;
      }
    }
  }
  return result;
}

export function isSeverityThresholdMet(
  finding: Finding,
  minimum_severity: String
) {
  let result = false;
  if (finding.check.issue && finding.check.issue.warn) {
    result = true;
  }
  return result;
}

export function buildBody(finding: Finding) {
  let result;
  let severity = finding.severity;
  let issue = finding.check.issue;
  result = "unique_id: " + finding.key;
  result += "<h4>Severity</h3>";
  result += severity ? severity : "N/A";
  result += "<h3>Description:</h3>";
  result += issue && issue.description ? issue.description : "N/A";
  result += "<h3>Impact Summary:</h3>";
  result += issue && issue.impactSummary ? issue.impactSummary : "N/A";
  result += "<h3>Steps to reproduce:</h3>";
  result += issue && issue.stepsToReproduce ? issue.stepsToReproduce : "N/A";
  result += "<h3>Recommendations:</h3></p>";
  result += issue && issue.recommendation ? issue.recommendation : "N/A";

  return result;
}

run();
