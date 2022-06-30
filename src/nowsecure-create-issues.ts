/*
 * Copyright © 2021-2022 NowSecure Inc.
 *
 * SPDX-License-Identifier: MIT
 */

import * as core from "@actions/core";
import fs from "fs";
import { NowSecure } from "./nowsecure-client";

async function run() {
  // need to take the output and iterate over it and create issues,
  // WITHOUT duplicating issues on each run.  Need to use the hash / something
  // unique to determine whether the GH issue exists already
  
  try {
    const apiUrl = core.getInput("api_url");
    const labApiUrl = core.getInput("lab_api_url");
    const platformToken = core.getInput("token");
    const ns = new NowSecure(platformToken, apiUrl, labApiUrl);
    const groupId = core.getInput("group_id");
    const appFile = core.getInput("app_file");

    const details = await ns.submitBin(fs.createReadStream(appFile), groupId);
    const reportId = details.ref;
    console.log(`NowSecure assessment started. Report ID: ${reportId}`);
    core.setOutput("report_id", reportId);
  } catch (e) {
    console.error(e);
    core.setFailed((e as Error).message);
  }
}

run();
