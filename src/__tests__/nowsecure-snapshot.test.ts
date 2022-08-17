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
import { USER_AGENT } from "../nowsecure-client";
import * as client from "@actions/http-client";

const { readFile } = promises;

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

  test("can perform conversion", async () => {
    const data = await readFile(
      path.join(__dirname, "resources", "deputy.json")
    );
    const parsed = JSON.parse(data.toString());
    jest.useFakeTimers().setSystemTime(new Date("2000-01-01"));
    const snapshot = convertToSnapshot(parsed as Deputy, "", context);
    jest.useRealTimers();
    expect(snapshot).toMatchSnapshot();
  });

  test("can fail with max retry attempts", async () => {
    const data = await readFile(
      path.join(__dirname, "resources", "deputy.json")
    );
    const parsed = JSON.parse(data.toString());
    const snapshot = convertToSnapshot(parsed as Deputy, "", context);
    
    const scope = nock("https://api.github.com", {
      reqheaders: {
        Authorization: "token abc123",
        "content-length": "822",
        "user-agent": USER_AGENT,
      },
    })
      .post(
        "/repos/test/test-action/dependency-graph/snapshots",
        JSON.stringify(snapshot)
      )
      .reply(502);

    // build the context to match the nock scope
    context.repo.owner = "test";
    context.repo.repo = "test-action";

    //  in real life, when submitSnapshotData is called, we will reference the GH token
    await submitSnapshotData(snapshot, context, "abc123").then((data) => {
      console.log("data", data);
      expect(data).toEqual(502);
    });
  });
});
