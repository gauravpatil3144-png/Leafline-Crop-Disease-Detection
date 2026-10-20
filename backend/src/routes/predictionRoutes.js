import { Router } from 'express'
import { aiStatus, createPrediction, deletePrediction, getPrediction, listPredictions, summary } from '../controllers/predictionController.js'
import requireAuth from '../middleware/auth.js'
import upload from '../middleware/upload.js'

const router = Router()
router.use(requireAuth)
router.get('/status', aiStatus)
router.get('/summary', summary)
router.post('/', upload.single('image'), createPrediction)
router.get('/', listPredictions)
router.get('/:id', getPrediction)
router.delete('/:id', deletePrediction)
export default router