import fs from 'node:fs/promises'
import path from 'node:path'
import mongoose from 'mongoose'
import Scan from '../models/Scan.js'

const aiUrl = () => (process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export async function aiStatus(_req, res) {
  try {
    const response = await fetch(`${aiUrl()}/health`, { signal: AbortSignal.timeout(5000) })
    const status = await response.json()
    if (!response.ok) return res.status(503).json({ service_available: false, model_ready: false, message: status.message || 'AI service is unavailable.' })
    return res.json({ service_available: true, ...status })
  } catch {
    return res.status(503).json({ service_available: false, model_ready: false, message: 'AI service is unavailable.' })
  }
}

export async function createScan(req, res, next) {
  if (!req.file) return res.status(400).json({ message: 'Choose an image to scan.' })
  try {
    const bytes = await fs.readFile(req.file.path)
    const form = new FormData()
    form.append('image', new Blob([bytes], { type: req.file.mimetype }), req.file.originalname)
    let response
    try {
      response = await fetch(`${aiUrl()}/predict`, { method: 'POST', body: form, signal: AbortSignal.timeout(60000) })
    } catch {
      return res.status(503).json({ code: 'AI_SERVICE_UNAVAILABLE', message: 'The AI service is unavailable. Start it and try again.' })
    }
    const prediction = await response.json().catch(() => ({}))
    if (!response.ok) return res.status(response.status).json({ code: prediction.code || 'INFERENCE_FAILED', message: prediction.message || 'The AI service could not analyze this image.' })
    if (!Array.isArray(prediction.predictions) || prediction.predictions.length === 0) return res.status(502).json({ message: 'The AI service returned no predictions.' })
    const top = prediction.predictions[0]
    const scan = await Scan.create({
      user: req.userId,
      cropLabel: prediction.crop_label || 'Unknown crop',
      diseaseLabel: top.label,
      confidence: top.confidence,
      lowConfidence: top.confidence < Number(process.env.LOW_CONFIDENCE_THRESHOLD || 0.65),
      predictions: prediction.predictions.slice(0, 3),
      imageName: path.basename(req.file.originalname).slice(0, 180),
      modelVersion: prediction.model_version || 'unknown',
    })
    return res.status(201).json({ scan })
  } catch (error) {
    return next(error)
  } finally {
    await fs.unlink(req.file.path).catch(() => {})
  }
}

export async function listScans(req, res) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10))
  const filter = { user: req.userId }
  if (req.query.crop) filter.cropLabel = new RegExp(`^${escapeRegex(String(req.query.crop).slice(0, 80))}$`, 'i')
  if (req.query.search) {
    const term = new RegExp(escapeRegex(String(req.query.search).slice(0, 80)), 'i')
    filter.$or = [{ cropLabel: term }, { diseaseLabel: term }]
  }
  const [scans, total] = await Promise.all([
    Scan.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Scan.countDocuments(filter),
  ])
  return res.json({ scans, pagination: { page, pages: Math.ceil(total / limit), total } })
}

export async function getScan(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Scan not found.' })
  const scan = await Scan.findOne({ _id: req.params.id, user: req.userId }).lean()
  if (!scan) return res.status(404).json({ message: 'Scan not found.' })
  return res.json({ scan })
}

export async function summary(req, res) {
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const userObjectId = new mongoose.Types.ObjectId(req.userId)
  const [total, thisMonth, aggregate, recent] = await Promise.all([
    Scan.countDocuments({ user: req.userId }),
    Scan.countDocuments({ user: req.userId, createdAt: { $gte: monthStart } }),
    Scan.aggregate([{ $match: { user: userObjectId } }, { $group: { _id: null, averageConfidence: { $avg: '$confidence' } } }]),
    Scan.find({ user: req.userId }).sort({ createdAt: -1 }).limit(5).lean(),
  ])
  return res.json({ stats: { total, thisMonth, averageConfidence: aggregate[0]?.averageConfidence ?? null }, recent })
}