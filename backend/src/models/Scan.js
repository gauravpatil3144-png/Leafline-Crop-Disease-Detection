import mongoose from 'mongoose'

const predictionSchema = new mongoose.Schema({
  label: { type: String, required: true },
  confidence: { type: Number, required: true, min: 0, max: 1 },
}, { _id: false })

const scanSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  cropLabel: { type: String, required: true },
  diseaseLabel: { type: String, required: true },
  confidence: { type: Number, required: true, min: 0, max: 1 },
  lowConfidence: { type: Boolean, required: true },
  predictions: { type: [predictionSchema], default: [] },
  imageName: { type: String, required: true },
  modelVersion: { type: String, default: 'unknown' },
}, { timestamps: true })

scanSchema.index({ user: 1, createdAt: -1 })
export default mongoose.model('Scan', scanSchema)