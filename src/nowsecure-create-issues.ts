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

  // Create a personal access token at https://github.com/settings/tokens/new?scopes=repo
  const octokit = new Octokit({
    auth: core.getInput("token"),
  });
  console.log("octokit", octokit);

  // Compare: https://docs.github.com/en/rest/reference/users#get-the-authenticated-user
  const {
    data: { login },
  } = await octokit.rest.users.getAuthenticated();
  console.log("Hello, %s", login);
}

run();
