import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import mongoose from "mongoose";
import Prediction from "../models/Prediction.js";
import { aiStatus, createPrediction, summary } from "./predictionController.js";

const userId = new mongoose.Types.ObjectId().toString();

function responseRecorder() {
  return {
    payload: null,
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

afterEach(() => {
  delete process.env.AI_SERVICE_URL;
});

test("AI status distinguishes a ready model from a missing model", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(JSON.stringify({ status: "ok", model_ready: true }), {
        status: 200,
      }),
  );
  const readyResponse = responseRecorder();
  await aiStatus({}, readyResponse);
  assert.equal(readyResponse.payload.data.status, "ready");
  assert.equal(readyResponse.payload.data.serviceAvailable, true);

  t.mock.restoreAll();
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        JSON.stringify({
          status: "ok",
          model_ready: false,
          missing_artifacts: ["private/path"],
        }),
        { status: 200 },
      ),
  );
  const missingResponse = responseRecorder();
  await aiStatus({}, missingResponse);
  assert.equal(missingResponse.payload.data.status, "not_configured");
  assert.equal(
    missingResponse.payload.data.message.includes("private/path"),
    false,
  );
});

test("AI status reports a failed health check as unavailable", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("private connection details");
  });
  const response = responseRecorder();
  await aiStatus({}, response);
  assert.equal(response.payload.data.status, "unavailable");
  assert.equal(response.payload.data.serviceAvailable, false);
  assert.equal(
    JSON.stringify(response.payload).includes("private connection details"),
    false,
  );
});

test("prediction forwards uploaded bytes with a request ID and saves the top class", async (t) => {
  process.env.AI_SERVICE_URL = "http://ai.test";
  const uploadDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "leafline-upload-"),
  );
  t.after(() => fs.rm(uploadDirectory, { recursive: true, force: true }));
  const uploadPath = path.join(uploadDirectory, "upload.jpg");
  const uploadedBytes = Buffer.from([0xff, 0xd8, 0xff, 0x01, 0x02]);
  await fs.writeFile(uploadPath, uploadedBytes);

  let fetchUrl;
  let fetchOptions;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    fetchUrl = url;
    fetchOptions = options;
    return new Response(
      JSON.stringify({
        crop_label: "Potato",
        predictions: [
          { label: "Potato___Late_blight", confidence: 0.98 },
          { label: "Tomato_Late_blight", confidence: 0.02 },
        ],
        low_confidence: false,
        model_version: "test-model",
      }),
      { status: 200 },
    );
  });
  t.mock.method(Prediction, "create", async (values) => values);

  const response = responseRecorder();
  response.statusCode = 200;
  response.status = function (statusCode) {
    this.statusCode = statusCode;
    return this;
  };
  await createPrediction(
    {
      userId,
      file: {
        path: uploadPath,
        originalname: "potato-leaf.jpg",
        mimetype: "image/jpeg",
      },
    },
    response,
    (error) => {
      throw error;
    },
  );

  assert.equal(response.statusCode, 201);
  assert.equal(fetchUrl, "http://ai.test/predict");
  assert.match(fetchOptions.headers["X-Request-ID"], /^[\da-f-]{36}$/i);
  const forwardedImage = fetchOptions.body.get("image");
  assert.equal(forwardedImage.name, "potato-leaf.jpg");
  assert.deepEqual(
    Buffer.from(await forwardedImage.arrayBuffer()),
    uploadedBytes,
  );
  assert.equal(response.payload.data.cropName, "Potato");
  assert.equal(response.payload.data.predictedDisease, "Potato___Late_blight");
  assert.equal(response.payload.data.predictions[0].confidence, 0.98);
  await assert.rejects(fs.access(uploadPath));
});

test("summary returns empty-database stats and UTC month bounds", async (t) => {
  const countFilters = [];
  t.mock.method(Prediction, "countDocuments", async (filter) => {
    countFilters.push(filter);
    return 0;
  });
  t.mock.method(Prediction, "aggregate", async () => []);
  t.mock.method(Prediction, "find", () => ({
    sort: () => ({ limit: () => ({ lean: async () => [] }) }),
  }));

  const response = responseRecorder();
  await summary({ userId }, response);

  assert.deepEqual(response.payload.data.stats, {
    total: 0,
    thisMonth: 0,
    averageConfidence: null,
  });
  assert.deepEqual(response.payload.data.recent, []);
  const range = countFilters[1].createdAt;
  assert.equal(range.$gte.getUTCDate(), 1);
  assert.equal(range.$gte.getUTCHours(), 0);
  assert.equal(range.$lt.getUTCDate(), 1);
  assert.equal(range.$lt.getUTCMonth(), (range.$gte.getUTCMonth() + 1) % 12);
});

test("summary averages each saved scan top score and returns recent records", async (t) => {
  const scans = [
    {
      _id: "first",
      cropName: "Tomato",
      predictedDisease: "Early blight",
      predictions: [{ confidence: 0.9 }, { confidence: 0.7 }],
      createdAt: new Date("2026-10-01T00:00:00.000Z"),
    },
    {
      _id: "second",
      cropName: "Potato",
      predictedDisease: "Healthy",
      predictions: [{ confidence: 0.6 }, { confidence: 0.4 }],
      createdAt: new Date("2026-10-02T00:00:00.000Z"),
    },
  ];
  const countFilters = [];
  t.mock.method(Prediction, "countDocuments", async (filter) => {
    countFilters.push(filter);
    return 2;
  });
  t.mock.method(Prediction, "aggregate", async (pipeline) => {
    assert.deepEqual(pipeline[1].$project.topScore, {
      $max: "$predictions.confidence",
    });
    assert.deepEqual(pipeline[2].$group.averageConfidence, {
      $avg: "$topScore",
    });
    return [{ averageConfidence: (0.9 + 0.6) / 2 }];
  });
  t.mock.method(Prediction, "find", () => ({
    sort: () => ({ limit: () => ({ lean: async () => scans }) }),
  }));

  const response = responseRecorder();
  await summary({ userId }, response);

  assert.equal(response.payload.data.stats.total, 2);
  assert.equal(response.payload.data.stats.thisMonth, 2);
  assert.equal(response.payload.data.stats.averageConfidence, 0.75);
  assert.deepEqual(
    response.payload.data.recent.map((scan) => scan.confidence),
    [0.9, 0.6],
  );
  assert.equal(countFilters[0].user, userId);
});
