const guidanceByClass = new Map(
  [
    [
      ["cotton bacterial blight", "bacterial blight"],
      "Avoid moving suspect plant debris between rows, clean tools after handling affected plants, and ask a local extension service about clean seed and resistant varieties for future planting.",
    ],
    [
      ["cotton leaf curl virus", "curl virus"],
      "Check nearby plants for similar symptoms and ask an extension specialist to verify the virus and possible whitefly involvement before deciding how to manage affected plants.",
    ],
    [
      ["cotton fusarium wilt", "fussarium wilt"],
      "Have wilt symptoms checked against other causes, avoid moving soil on tools or footwear, and ask an extension specialist about rotation and resistant varieties for future planting.",
    ],
    [
      [
        "healthy cotton",
        "healthy",
        "pepper bell healthy",
        "potato healthy",
        "tomato healthy",
      ],
      "No disease-specific action is suggested by this match. Continue monitoring the plant and compare any new symptoms with nearby plants.",
    ],
    [
      ["pepper bell bacterial spot", "tomato bacterial spot"],
      "Avoid overhead watering, do not handle plants while foliage is wet, and remove crop debris after harvest. Ask a local extension service about suitable rotation for your area.",
    ],
    [
      [
        "potato early blight",
        "tomato early blight",
        "tomato septoria leaf spot",
        "tomato target spot",
      ],
      "Keep foliage as dry as practical, improve spacing and airflow, and remove fallen affected leaves. Confirm the cause locally before removing healthy foliage or taking other action.",
    ],
    [
      ["potato late blight", "tomato late blight"],
      "Because late blight can spread quickly, avoid handling suspect plants when wet and contact a local extension service promptly to verify the diagnosis and next steps.",
    ],
    [
      ["tomato leaf mold"],
      "Improve airflow around plants, avoid wetting leaves during irrigation, and remove fallen affected leaves. Seek local confirmation before taking further action.",
    ],
    [
      ["tomato spider mites two spotted spider mite"],
      "Inspect leaf undersides and nearby plants for mites or webbing, keep monitoring for spread, and ask an extension service about locally appropriate integrated pest management.",
    ],
    [
      ["tomato tomato yellowleaf curl virus", "tomato tomato mosaic virus"],
      "Check nearby plants for similar symptoms and ask an extension specialist to verify the virus and likely spread route before deciding how to manage affected plants.",
    ],
  ].flatMap(([labels, guidance]) => labels.map((label) => [label, guidance])),
);

function normalizeLabel(label) {
  return typeof label === "string"
    ? label.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim()
    : "";
}

export function getDiseaseGuidance(prediction = {}) {
  const topLabel =
    prediction.predictions?.[0]?.label ||
    prediction.predictedDisease ||
    prediction.diseaseLabel;
  return (
    guidanceByClass.get(normalizeLabel(topLabel)) ||
    "Photograph the symptoms and compare several plants. Ask a local agronomist or extension service to confirm the cause before choosing crop-specific actions."
  );
}
