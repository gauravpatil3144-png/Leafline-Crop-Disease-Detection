import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import Prediction from "../models/Prediction.js";

const aiUrl = () =>
  (process.env.AI_SERVICE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const maxHistoryLimit = 100;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function getCropName(label, fallback) {
  return (
    cropNames.find((crop) =>
      new RegExp(`^${escapeRegex(crop)}(?:\\b|\\s|[-_])`, "i").test(label),
    ) || fallback.trim()
  );
}

function getImageType(bytes) {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  return null;
}

function normalizePredictions(result) {
  if (
    !result ||
    typeof result.crop_label !== "string" ||
    !result.crop_label.trim()
  )
    return null;
  if (!Array.isArray(result.predictions) || result.predictions.length === 0)
    return null;
  if (typeof result.low_confidence !== "boolean") return null;
  const predictions = result.predictions.slice(0, 3);
  if (
    predictions.some(
      (item) =>
        !item ||
        typeof item.label !== "string" ||
        !item.label.trim() ||
        typeof item.confidence !== "number" ||
        !Number.isFinite(item.confidence) ||
        item.confidence < 0 ||
        item.confidence > 1,
    )
  )
    return null;
  return {
    cropName: getCropName(
      predictions[0].label.trim(),
      result.crop_label.trim(),
    ),
    predictedDisease: predictions[0].label.trim(),
    predictions: predictions.map(({ label, confidence }) => ({
      label: label.trim(),
      confidence,
    })),
    lowConfidence: result.low_confidence,
    modelVersion:
      typeof result.model_version === "string" && result.model_version.trim()
        ? result.model_version.trim()
        : "unknown",
  };
}

export async function aiStatus(_req, res) {
  try {
    const response = await fetch(`${aiUrl()}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    const health = await response.json().catch(() => null);
    if (
      !response.ok ||
      health?.status !== "ok" ||
      typeof health.model_ready !== "boolean"
    ) {
      return res.json({
        success: true,
        data: {
          status: "unavailable",
          serviceAvailable: false,
          service_available: false,
          model_ready: false,
          message: "AI service health could not be verified.",
        },
      });
    }
    const modelReady = health.model_ready;
    return res.json({
      success: true,
      data: {
        status: modelReady ? "ready" : "not_configured",
        serviceAvailable: true,
        service_available: true,
        model_ready: modelReady,
        message: modelReady
          ? ""
          : "AI service is reachable, but no trained model is configured.",
      },
    });
  } catch {
    return res.json({
      success: true,
      data: {
        status: "unavailable",
        serviceAvailable: false,
        service_available: false,
        model_ready: false,
        message: "AI service is unavailable.",
      },
    });
  }
}

export async function createPrediction(req, res, next) {
  if (!req.file)
    return res
      .status(400)
      .json({ success: false, message: "Choose an image to scan." });
  try {
    const bytes = await fs.readFile(req.file.path);
    const actualType = getImageType(bytes);
    if (!actualType || actualType !== req.file.mimetype) {
      return res.status(400).json({
        success: false,
        message: "The uploaded file is not a valid JPEG, PNG, or WebP image.",
      });
    }

    const form = new FormData();
    const requestId = randomUUID();
    form.append(
      "image",
      new Blob([bytes], { type: actualType }),
      path.basename(req.file.originalname),
    );
    let response;
    try {
      response = await fetch(`${aiUrl()}/predict`, {
        method: "POST",
        body: form,
        headers: { "X-Request-ID": requestId },
        signal: AbortSignal.timeout(60000),
      });
    } catch (error) {
      const timedOut =
        error.name === "TimeoutError" || error.name === "AbortError";
      return res.status(timedOut ? 504 : 503).json({
        success: false,
        code: timedOut ? "AI_SERVICE_TIMEOUT" : "AI_SERVICE_UNAVAILABLE",
        message: timedOut
          ? "The AI service took too long to respond. Please retry."
          : "The AI service is unavailable. Please retry shortly.",
      });
    }

    const aiResult = await response.json().catch(() => null);
    if (!response.ok) {
      const status = [400, 413, 503].includes(response.status)
        ? response.status
        : 502;
      return res.status(status).json({
        success: false,
        code: aiResult?.code || "INFERENCE_FAILED",
        message:
          aiResult?.message || "The AI service could not analyze this image.",
      });
    }

    const values = normalizePredictions(aiResult);
    if (!values)
      return res.status(502).json({
        success: false,
        code: "INVALID_AI_RESPONSE",
        message: "The AI service returned an invalid prediction response.",
      });

    const prediction = await Prediction.create({ ...values, user: req.userId });
    return res.status(201).json({ success: true, data: prediction });
  } catch (error) {
    return next(error);
  } finally {
    await fs.unlink(req.file.path).catch(() => {});
  }
}

function parsePositiveInteger(
  value,
  fallback,
  name,
  maximum = Number.MAX_SAFE_INTEGER,
) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    const error = new Error(
      `${name} must be an integer between 1 and ${maximum}.`,
    );
    error.status = 400;
    throw error;
  }
  return parsed;
}

export async function listPredictions(req, res, next) {
  try {
    const page = parsePositiveInteger(req.query.page, 1, "page");
    const limit = parsePositiveInteger(
      req.query.limit,
      10,
      "limit",
      maxHistoryLimit,
    );
    const filter = { user: req.userId };
    if (req.query.crop) {
      const crop = escapeRegex(String(req.query.crop).slice(0, 80));
      filter.cropName = new RegExp(`^${crop}$`, "i");
    }
    if (req.query.search) {
      const search = new RegExp(
        escapeRegex(String(req.query.search).slice(0, 80)),
        "i",
      );
      filter.$or = [{ cropName: search }, { predictedDisease: search }];
    }
    const [data, total] = await Promise.all([
      Prediction.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Prediction.countDocuments(filter),
    ]);
    return res.json({
      success: true,
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getPrediction(req, res) {
  if (!mongoose.isValidObjectId(req.params.id))
    return res
      .status(400)
      .json({ success: false, message: "Invalid prediction ID." });
  const prediction = await Prediction.findOne({
    _id: req.params.id,
    user: req.userId,
  }).lean();
  if (!prediction)
    return res
      .status(404)
      .json({ success: false, message: "Prediction not found." });
  return res.json({ success: true, data: prediction });
}

export async function deletePrediction(req, res) {
  if (!mongoose.isValidObjectId(req.params.id))
    return res
      .status(400)
      .json({ success: false, message: "Invalid prediction ID." });
  const prediction = await Prediction.findOneAndDelete({
    _id: req.params.id,
    user: req.userId,
  }).lean();
  if (!prediction)
    return res
      .status(404)
      .json({ success: false, message: "Prediction not found." });
  return res.json({ success: true, data: { _id: prediction._id } });
}

export async function summary(req, res) {
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const nextMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  const userObjectId = new mongoose.Types.ObjectId(req.userId);
  const [total, thisMonth, aggregate, recent] = await Promise.all([
    Prediction.countDocuments({ user: req.userId }),
    Prediction.countDocuments({
      user: req.userId,
      createdAt: { $gte: monthStart, $lt: nextMonthStart },
    }),
    Prediction.aggregate([
      { $match: { user: userObjectId } },
      { $project: { topScore: { $max: "$predictions.confidence" } } },
      { $group: { _id: null, averageConfidence: { $avg: "$topScore" } } },
    ]),
    Prediction.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
  ]);
  const recentScans = recent.map((prediction) => ({
    ...prediction,
    cropLabel: prediction.cropName,
    diseaseLabel: prediction.predictedDisease,
    confidence: prediction.predictions[0]?.confidence || 0,
  }));
  return res.json({
    success: true,
    data: {
      stats: {
        total,
        thisMonth,
        averageConfidence: aggregate[0]?.averageConfidence ?? null,
      },
      recent: recentScans,
    },
  });
}
