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

// need to take the output and iterate over it and create issues,
// WITHOUT duplicating issues on each run.  Need to use the hash / something
// unique to determine whether the GH issue exists already
export async function run() {
  // check to see if enable_issues is true
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

    const ns = new NowSecure(platformToken, apiUrl, labApiUrl);
    let pollInterval = 60000;

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

    // pull all the issues we have to determine dupes and to re-open issues
    const existing = await octokit.request("GET /repos/{owner}/{repo}/issues", {
      owner: repo_owner,
      repo: repo,
      state: "all",
    });

    // there are zero existing issues, so create new from findings.
    if (!existing || existing.data.length === 0) {
      console.log("no existing issues, create new ones!");
      for (var finding of report.data.auto.assessments[0].report.findings) {
        console.log("create a new issue!");
        await octokit.request("POST /repos/{owner}/{repo}/issues", {
          owner: repo_owner,
          repo: repo,
          title: finding.title,
          body: buildBody(finding),
          assignees: [assignees],
          labels: [finding.severity],
        });
      }
    }

    if (existing && existing.data) {
      console.log("existing issue found");
      for (var finding of report.data.auto.assessments[0].report.findings) {
        let issueToUpdate = issueExists(finding, existing.data);
        if (issueToUpdate) {
          // re-open thee issue
          await octokit.request(
            "PATCH /repos/{owner}/{repo}/issues/{issue_number}",
            {
              owner: repo_owner,
              repo: repo,
              issue_number: parseInt(await issueToUpdate),
              state: "open",
            }
          );
        } else {
          // create a new GH Issue
          console.log("create a new issue!");
          await octokit.request("POST /repos/{owner}/{repo}/issues", {
            owner: repo_owner,
            repo: repo,
            title: finding.title,
            body: buildBody(finding),
            assignees: [assignees],
            labels: [finding.severity],
          });
        }
      }
    }
  }
}

export async function issueExists(finding: Finding, existing: any) {
  let result;
  for (var ex of existing) {
    if (ex.title === finding.title) {
      // the issue already exists, check status
      console.log("@@@@@@ Titles Match!! /n");
      if (
        ex.state &&
        finding.check.issue &&
        ex.state !== finding.check.issue.category &&
        ex.state === "closed"
      ) {
        // pass back the id of the issue to be re-opened
        return ex.id;
        console.log("re-open the ticket", ex.number);
      }
    }
  }
  return null;
}

export function buildBody(finding: Finding) {
  let result;
  let issue = finding.check.issue;
  //console.log("issue", JSON.stringify(issue));
  result = "<h3>Description:</h3>";
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
