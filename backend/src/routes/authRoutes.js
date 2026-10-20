import { Router } from 'express'
import { currentUser, login, register, updateCurrentUser } from '../controllers/authController.js'
import requireAuth from '../middleware/auth.js'

const router = Router()
router.post('/register', register)
router.post('/login', login)
router.get('/me', requireAuth, currentUser)
router.patch('/me', requireAuth, updateCurrentUser)
export default router