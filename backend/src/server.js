import 'dotenv/config'
import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import authRoutes from './routes/authRoutes.js'
import scanRoutes from './routes/scanRoutes.js'
import predictionRoutes from './routes/predictionRoutes.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith('replace-with-')) throw new Error('JWT_SECRET must be set to a random value of at least 32 characters.')
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI
if (!mongoUri) throw new Error('MONGODB_URI must be configured.')
const frontendOrigin = process.env.FRONTEND_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5173'

const app = express()
app.disable('x-powered-by')
app.use(helmet())
app.use(cors({ origin: frontendOrigin }))
app.use(express.json({ limit: '32kb' }))
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }))
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }))
app.get('/api/health', (_req, res) => {
	const connected = mongoose.connection.readyState === 1
	return res.status(connected ? 200 : 503).json({ status: connected ? 'ok' : 'degraded', database: connected ? 'connected' : 'disconnected' })
})
app.use('/api/auth', authRoutes)
app.use('/api/predictions', predictionRoutes)
app.use('/api/scans', scanRoutes)
app.use(notFound)
app.use(errorHandler)

const port = Number(process.env.PORT || 5000)
try {
	await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 })
	console.log(`MongoDB connected to database: ${mongoose.connection.name}`)
} catch (error) {
	console.error(`MongoDB connection failed: ${error.message}`)
	process.exit(1)
}
app.listen(port, () => console.log(`Leafline API listening on http://localhost:${port}`))