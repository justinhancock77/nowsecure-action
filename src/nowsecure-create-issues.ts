/*
 * Copyright © 2021-2022 NowSecure Inc.
 *
 * SPDX-License-Identifier: MIT
 */

import * as core from "@actions/core";
import { NowSecure } from "./nowsecure-client";
import { Octokit } from "@octokit/action";

// need to take the output and iterate over it and create issues,
// WITHOUT duplicating issues on each run.  Need to use the hash / something
// unique to determine whether the GH issue exists already
export async function run() {
  const apiUrl = core.getInput("api_url");
  const labApiUrl = core.getInput("lab_api_url");

  const platformToken = core.getInput("token");
  const reportId = core.getInput("report_id");
  console.log("fetch report with id", reportId);

  const ns = new NowSecure(platformToken, apiUrl, labApiUrl);
  let report = await ns.pullReport(reportId);

  console.log("report data:", report.data);

  if (report.data.auto.assessments[0].report) {
    console.log("we have a report", report.data.auto.assessments[0].report);
  }

  const octokit = new Octokit({
    auth: core.getInput("GITHUB_TOKEN"),
  });
  console.log("octokit loaded");

  // should I break this out into a github-client.ts utility?
  await octokit.request("POST /repos/{owner}/{repo}/issues", {
    owner: "justinhancock77",
    repo: "nowsecure-action",
    title: "Found a bug",
    body: "I'm having a problem with this.",
    assignees: ["justinhancock77"],
    // milestone: 1,
    labels: ["bug"],
  });

  //console.log("Hello, %s", data);
}

run();
