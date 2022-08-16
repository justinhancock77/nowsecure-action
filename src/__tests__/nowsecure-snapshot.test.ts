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

  test("can perform conversion", async () => {
    const data = await readFile(
      path.join(__dirname, "resources", "deputy.json")
    );
    const parsed = JSON.parse(data.toString());
    const snapshot = convertToSnapshot(parsed as Deputy, "", context);
    expect(snapshot).toMatchSnapshot();
  });

  test("can fail with max retry attempts", async () => {
    // const data = await readFile(
    //   path.join(__dirname, "resources", "deputy.json")
    // );
    // const parsed = JSON.parse(data.toString());
    // const snapshot = convertToSnapshot(parsed as Deputy, "", context);

    const scope = nock("https://example.com/").get("/").reply(502);
    const httpClient = new client.HttpClient();
    const r = await httpClient.get("https://example.com/");
    expect(r.message.statusCode).toBe(502);
    // const r = await httpClient.post(
    //   //snapshotUrl(owner, repo),
    //   "https://example.com/repos/justinhancock77/nowsecure-action/dependency-graph/snapshots",
    //   "{}"
    //   // {
    //   //   Authorization: `token aabbccdd`,
    //   // }
    // );

    

    //  in real life, when submitSnapshotData is called, we will reference the GH token
    // await submitSnapshotData(snapshot, context, "abc123").then((data) => {
    //   console.log("data", data);
    // });
  });
});
