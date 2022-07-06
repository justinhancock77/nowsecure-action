/*
 * Copyright © 2021-2022 NowSecure Inc.
 *
 * SPDX-License-Identifier: MIT
 */

import * as core from "@actions/core";
import { NowSecure } from "./nowsecure-client";
import { Octokit } from "@octokit/action";
import { promisify } from "util";
import type { PullReportResponse } from "./types/platform";

const sleep = promisify(setTimeout);

// need to take the output and iterate over it and create issues,
// WITHOUT duplicating issues on each run.  Need to use the hash / something
// unique to determine whether the GH issue exists already
export async function run() {
  const octokit = new Octokit({
    auth: core.getInput("GITHUB_TOKEN"),
  });
  console.log("octokit loaded");

  const apiUrl = core.getInput("api_url");
  const labApiUrl = core.getInput("lab_api_url");

  const platformToken = core.getInput("platform-token");
  const reportId = core.getInput("report_id");
  console.log("fetch report with id", reportId);

  const ns = new NowSecure(platformToken, apiUrl, labApiUrl);
  let pollInterval = 60000;

  // Poll Platform to resolve the report ID to a report.
  // GitHub Actions will handle the timeout for us in the event something goes awry.
  let report = null;
  for (;;) {
    console.log("Checking for NowSecure report... ", reportId);
    report = await ns.pullReport(reportId);
    console.log("report?", report);
    // NOTE: No optional chaining on Node.js 12 in GitHub Actions.
    try {
      if (report.data.auto.assessments[0].report) {
        console.log("found the report");
        break;
      } else {
        console.log("sleep");
        await sleep(pollInterval);
      }
    } catch (e) {
      console.error(e);
      // No report data.
    }
  }

  // console.log(
  //   "report!!",
  //   JSON.stringify(report.data.auto.assessments[0].report)
  // );

  for (var resp of report.data.auto.assessments[0].report.findings) {
    console.log("resp", resp);
    // should I break this out into a github-client.ts utility?
    await octokit.request("POST /repos/{owner}/{repo}/issues", {
      owner: "justinhancock77",
      repo: "nowsecure-action",
      title: resp.title,
      body: resp.summary,
      assignees: ["justinhancock77"],
      // milestone: 1,
      labels: ["bug"],
    });
  }
  //console.log("Hello, %s", data);
}

run();
