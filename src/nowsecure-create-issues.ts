/*
 * Copyright © 2021-2022 NowSecure Inc.
 *
 * SPDX-License-Identifier: MIT
 */

import * as core from "@actions/core";
import { NowSecure } from "./nowsecure-client";
import { Octokit } from "@octokit/action";
import { promisify } from "util";

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

    // check to see if we are a GHAS user
    const ghas = await octokit.request(
      "GET /orgs/{org}/settings/billing/advanced-security",
      {
        org: "justinaxe77",
      }
    );

    console.log(
      "GHAS ?",
      ghas.data.total_advanced_security_committers > 0 ? "YES" : "NO"
    );

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

    for (var resp of report.data.auto.assessments[0].report.findings) {
      console.log("resp", resp);
      await octokit.request("POST /repos/{owner}/{repo}/issues", {
        owner: repo_owner,
        repo: repo,
        title: resp.title,
        body: resp.summary,
        assignees: [assignees],
        labels: ["bug"],
      });
    }
  }
}

run();
