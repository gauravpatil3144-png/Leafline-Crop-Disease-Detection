const cropNames = [
  "Apple",
  "Blueberry",
  "Cherry",
  "Corn",
  "Cotton",
  "Grape",
  "Orange",
  "Peach",
  "Pepper",
  "Potato",
  "Raspberry",
  "Soybean",
  "Squash",
  "Strawberry",
  "Tomato",
];

const cottonClassLabels = new Set([
  "bacterial_blight",
  "curl_virus",
  "fussarium_wilt",
  "healthy",
  "cotton bacterial blight",
  "cotton leaf curl virus",
  "cotton fusarium wilt",
  "healthy cotton",
]);

const cottonDisplayLabels = {
  bacterial_blight: "Cotton Bacterial Blight",
  curl_virus: "Cotton Leaf Curl Virus",
  fussarium_wilt: "Cotton Fusarium Wilt",
  healthy: "Healthy Cotton",
  "cotton bacterial blight": "Cotton Bacterial Blight",
  "cotton leaf curl virus": "Cotton Leaf Curl Virus",
  "cotton fusarium wilt": "Cotton Fusarium Wilt",
  "healthy cotton": "Healthy Cotton",
};

const cropByNormalizedName = new Map(
  cropNames.map((crop) => [crop.toLowerCase(), crop]),
);

const asLabel = (value) => (typeof value === "string" ? value.trim() : "");

function cropFromClassLabel(label) {
  const normalized = asLabel(label).toLowerCase();
  if (!normalized) return null;
  if (cottonClassLabels.has(normalized)) return "Cotton";

  return (
    cropNames.find((crop) =>
      new RegExp(`^${crop}(?:$|[_\\s-])`, "i").test(label.trim()),
    ) || null
  );
}

function cropFromMetadata(metadata) {
  return cropByNormalizedName.get(asLabel(metadata).toLowerCase()) || null;
}

export function getPredictionCropLabel(prediction = {}) {
  const candidates = Array.isArray(prediction.predictions)
    ? prediction.predictions
    : [];
  const topClassLabel = [
    candidates[0]?.label,
    prediction.predictedDisease,
    prediction.diseaseLabel,
  ].find((label) => asLabel(label));
  const cropMetadata = [prediction.cropName, prediction.cropLabel].find(
    (label) => cropFromMetadata(label),
  );

  return (
    cropFromClassLabel(topClassLabel) ||
    cropFromMetadata(cropMetadata) ||
    "Crop not identified"
  );
}

export function displayDiseaseLabel(label) {
  const normalized = asLabel(label);
  if (!normalized) return "";
  if (cottonClassLabels.has(normalized.toLowerCase())) {
    return cottonDisplayLabels[normalized.toLowerCase()];
  }
  return normalized;
}

export function normalizePrediction(prediction = {}) {
  const candidates = Array.isArray(prediction.predictions)
    ? prediction.predictions.filter((item) => item && typeof item === "object")
    : [];
  const predictions = candidates.map((item) => ({
    ...item,
    label: displayDiseaseLabel(item.label),
  }));
  const topClassLabel =
    predictions[0]?.label ||
    prediction.predictedDisease ||
    prediction.diseaseLabel;

  return {
    ...prediction,
    cropLabel: getPredictionCropLabel({
      ...prediction,
      predictions,
    }),
    diseaseLabel: displayDiseaseLabel(topClassLabel),
    predictions,
    confidence: predictions[0]?.confidence ?? prediction.confidence ?? 0,
  };
}
