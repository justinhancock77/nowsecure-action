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

    // pull all the issues to use to determine dupes and to re-open issues
    const existing = await octokit.request("GET /repos/{owner}/{repo}/issues", {
      owner: repo_owner,
      repo: repo,
      state: "all",
    });
    console.log("existing issues?", JSON.stringify(existing));

    // there are zero existing issues
    if (!existing || existing.data.length === 0) {
      console.log("no existing issues, create new ones!");
      for (var finding of report.data.auto.assessments[0].report.findings) {
        console.log("create a new issue!");
        //console.log("finding", JSON.stringify(finding));
        await octokit.request("POST /repos/{owner}/{repo}/issues", {
          owner: repo_owner,
          repo: repo,
          title: finding.title,
          body: buildBody(finding),
          assignees: [assignees],
          labels: [finding.severity],
        });
      }
    } else {
      console.log("existing issue found");
      for (var finding of report.data.auto.assessments[0].report.findings) {
        console.log("finding title", finding.title);
        //console.log("existing.data", existing);
        for (var ex of existing.data) {
          console.log("existing title", JSON.stringify(ex.title));

          if (ex.title === finding.title) {
            // the issue already exists, check status
            console.log("@@@@@@ Titles Match!! /n");
            if (
              ex.state !== finding.check.issue.category &&
              ex.state === "closed"
            ) {
              // re-open the GH Issue (regression)
              console.log("re-open the ticket", ex.id);
              await octokit.request(
                "PATCH /repos/{owner}/{repo}/issues/{issue_number}",
                {
                  owner: "OWNER",
                  repo: "REPO",
                  issue_number: ex.id,
                  state: "open",
                }
              );
              break; // break out of inner since we matched
            }
          } else {
            //   // create a new GH Issue
            //   console.log("create a new issue!");
            //   await octokit.request("POST /repos/{owner}/{repo}/issues", {
            //     owner: repo_owner,
            //     repo: repo,
            //     title: finding.title,
            //     body: finding.summary,
            //     assignees: [assignees],
            //     labels: [finding.severity],
            //   });
          }
        }
      }
    }
  }
}

export function buildBody(finding: Finding) {
  let result;
  let issue = finding.check.issue;
  result = "<h3>Description:</h3>";
  result += issue.description;
  result += "<h3>Impact Summary:</h3>";
  result += issue.impactSummary;
  result += "<h3>Steps to reproduce:</h3>";
  result += issue.stepsToReproduce ? issue.stepsToReproduce : "N/A";
  result += "<h3>Recommendations:</h3></p>";
  result += issue.recommendation;

  return result;
}

run();
