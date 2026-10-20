import { Router } from 'express'
import { aiStatus, createScan, getScan, listScans, summary } from '../controllers/scanController.js'
import requireAuth from '../middleware/auth.js'
import upload from '../middleware/upload.js'

const router = Router()
router.use(requireAuth)
router.get('/status', aiStatus)
router.post('/', upload.single('image'), createScan)
router.get('/summary', summary)
router.get('/', listScans)
router.get('/:id', getScan)
export default router