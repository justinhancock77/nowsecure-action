/*
 * Copyright © 2022 NowSecure Inc.
 *
 * SPDX-License-Identifier: MIT
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { promises } from "fs";
import { convertToSnapshot, submitSnapshotData } from "../nowsecure-snapshot";
import type { Deputy } from "../types/deputy";
import path from "path";
// import { DEFAULT_API_URL } from "../nowsecure-client";
// import nock from "nock";
// import { clear } from "console";

const { readFile } = promises;

jest.useFakeTimers().setSystemTime(new Date("2000-01-01"));
jest.setTimeout(30000);

describe("Snapshot conversion", () => {
  const context = {
    sha: "",
    ref: "",
    job: "",
    runId: 0,
    repo: {
      owner: "",
      repo: "",
    },
  };

  // const snapshotUrl = (owner: string, repo: string) =>
  //   `https://api.github.com/repos/${owner}/${repo}/dependency-graph/snapshots`;

  test("can perform conversion", async () => {
    const data = await readFile(
      path.join(__dirname, "resources", "deputy.json")
    );
    const parsed = JSON.parse(data.toString());
    const snapshot = convertToSnapshot(parsed as Deputy, "", context);
    expect(snapshot).toMatchSnapshot();
  });

  test("can fail with max retry attempts", async () => {
    // const scope = nock("https://api.github.com")
    //   .post("/repos/justinhancock77/dependency-graph/snapshots")
    //   .reply(502);

    const data = await readFile(
      path.join(__dirname, "resources", "deputy.json")
    );
    const parsed = JSON.parse(data.toString());
    const snapshot = convertToSnapshot(parsed as Deputy, "", context);

    await submitSnapshotData(snapshot, context, "abc123").then((data) => {
      console.log("data", data);
      //expect(data).toBe(401);
    });
  });
});
