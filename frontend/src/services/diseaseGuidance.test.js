import assert from "node:assert/strict";
import { test } from "node:test";
import { getDiseaseGuidance } from "./diseaseGuidance.js";

test("guidance follows the top class across normalized model label formats", () => {
  const guidance = getDiseaseGuidance({
    predictions: [
      { label: "Potato___Late_blight", confidence: 0.9 },
      { label: "Cotton Bacterial Blight", confidence: 0.1 },
    ],
  });

  assert.match(guidance, /spread quickly/i);
  assert.match(guidance, /extension service/i);
});

test("all supported model class names receive disease-appropriate guidance", () => {
  const classes = [
    "Pepper__bell___Bacterial_spot",
    "Pepper__bell___healthy",
    "Potato___Early_blight",
    "Potato___Late_blight",
    "Potato___healthy",
    "Tomato_Bacterial_spot",
    "Tomato_Early_blight",
    "Tomato_Late_blight",
    "Tomato_Leaf_Mold",
    "Tomato_Septoria_leaf_spot",
    "Tomato_Spider_mites_Two_spotted_spider_mite",
    "Tomato__Target_Spot",
    "Tomato__Tomato_YellowLeaf__Curl_Virus",
    "Tomato__Tomato_mosaic_virus",
    "Tomato_healthy",
    "bacterial_blight",
    "curl_virus",
    "fussarium_wilt",
    "healthy",
  ];

  for (const label of classes) {
    assert.ok(
      getDiseaseGuidance({ predictedDisease: label }).length > 0,
      label,
    );
  }
});

test("unknown or missing classes get cautious general guidance", () => {
  assert.match(
    getDiseaseGuidance({ predictions: [{ label: "Unrecognized class" }] }),
    /confirm the cause/i,
  );
  assert.match(getDiseaseGuidance({}), /confirm the cause/i);
});
