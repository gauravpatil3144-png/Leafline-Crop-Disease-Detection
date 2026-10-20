import assert from "node:assert/strict";
import { test } from "node:test";
import { getPredictionCropLabel, normalizePrediction } from "./cropLabels.js";

test("the top Tomato class wins over Cotton candidates and stale metadata", () => {
  const prediction = {
    cropName: "Cotton",
    predictions: [
      { label: "Tomato Late blight", confidence: 0.95 },
      { label: "Cotton Leaf Curl Virus", confidence: 0.04 },
      { label: "Healthy Cotton", confidence: 0.01 },
    ],
  };

  assert.equal(getPredictionCropLabel(prediction), "Tomato");
});

test("normalization keeps each candidate score with its class", () => {
  const normalized = normalizePrediction({
    cropName: "Cotton",
    predictedDisease: "Tomato___Late_blight",
    predictions: [
      { label: "Tomato___Late_blight", confidence: 0.95 },
      { label: "curl_virus", confidence: 0.04 },
      { label: "healthy", confidence: 0.01 },
    ],
  });

  assert.equal(normalized.cropLabel, "Tomato");
  assert.equal(normalized.confidence, 0.95);
  assert.deepEqual(
    normalized.predictions.map(({ label, confidence }) => [label, confidence]),
    [
      ["Tomato___Late_blight", 0.95],
      ["Cotton Leaf Curl Virus", 0.04],
      ["Healthy Cotton", 0.01],
    ],
  );
});

test("all Cotton model labels identify Cotton", () => {
  for (const label of [
    "bacterial_blight",
    "curl_virus",
    "fussarium_wilt",
    "healthy",
    "Cotton Bacterial Blight",
    "Cotton Leaf Curl Virus",
    "Cotton Fusarium Wilt",
    "Healthy Cotton",
  ]) {
    assert.equal(
      getPredictionCropLabel({ predictions: [{ label }] }),
      "Cotton",
      label,
    );
  }
});

test("Tomato, Potato, and Pepper class-name variants identify their crops", () => {
  const classLabels = [
    ["Tomato_Bacterial_spot", "Tomato"],
    ["Tomato__Tomato_mosaic_virus", "Tomato"],
    ["Tomato - Late blight", "Tomato"],
    ["Potato___Late_blight", "Potato"],
    ["Potato Early blight", "Potato"],
    ["Pepper__bell___Bacterial_spot", "Pepper"],
    ["Pepper bell healthy", "Pepper"],
  ];

  for (const [label, crop] of classLabels) {
    assert.equal(getPredictionCropLabel({ predictions: [{ label }] }), crop);
  }
});

test("known crop metadata is a fallback when the class is unavailable", () => {
  assert.equal(
    getPredictionCropLabel({ predictions: [], cropName: "Potato" }),
    "Potato",
  );
  assert.equal(
    getPredictionCropLabel({
      predictions: [{ confidence: 0.8 }],
      cropLabel: "Tomato",
    }),
    "Tomato",
  );
});

test("unknown or missing classes do not infer a crop from arbitrary text", () => {
  assert.equal(
    getPredictionCropLabel({
      predictions: [{ label: "Hybrid Tomatoe strain" }],
    }),
    "Crop not identified",
  );
  assert.equal(
    getPredictionCropLabel({ predictions: [] }),
    "Crop not identified",
  );
});
