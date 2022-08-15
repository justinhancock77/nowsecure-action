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

import nock from "nock";
import { DependencySnapshot } from "../types/dependency-snapshot";
// import { DEFAULT_API_URL } from "../nowsecure-client";
// import nock from "nock";
// import { clear } from "console";

const { readFile } = promises;

jest.useFakeTimers().setSystemTime(new Date("2000-01-01"));
jest.setTimeout(60000);

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

  test("can perform conversion", async () => {
    const data = await readFile(
      path.join(__dirname, "resources", "deputy.json")
    );
    const parsed = JSON.parse(data.toString());
    const snapshot = convertToSnapshot(parsed as Deputy, "", context);
    expect(snapshot).toMatchSnapshot();
  });

  test("can fail with max retry attempts", async () => {
    const data = await readFile(
      path.join(__dirname, "resources", "deputy.json")
    );
    const parsed = JSON.parse(data.toString());
    const snapshot = convertToSnapshot(parsed as Deputy, "", context);
    // how do I mock this to then run expect / assertions on the number
    // of times it ran the retry?
    //const spy = jest.spyOn(nowsecure-snapshot, 'submitSnapshotData');

    //  in real life, when submitSnapshotData is called, we will reference the GH token
    await submitSnapshotData(snapshot, context, "abc123").then((data) => {
      console.log("data", data);
    });
  });
});
