import mongoose from 'mongoose'

const predictionItemSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  confidence: { type: Number, required: true, min: 0, max: 1 },
}, { _id: false })

const predictionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  cropName: { type: String, required: true, trim: true, maxlength: 120 },
  predictedDisease: { type: String, required: true, trim: true, maxlength: 200 },
  predictions: { type: [predictionItemSchema], required: true, validate: (items) => items.length > 0 },
  lowConfidence: { type: Boolean, required: true },
  modelVersion: { type: String, required: true, trim: true, maxlength: 120 },
  imageUrl: { type: String, trim: true, maxlength: 2048 },
}, { timestamps: true })

predictionSchema.index({ user: 1, createdAt: -1 })
export default mongoose.model('Prediction', predictionSchema)