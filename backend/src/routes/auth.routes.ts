import { Router } from 'express'
import { authController } from '../controllers/auth.controller'
import { auth } from '../middleware/auth'

const router = Router()

// Auth local
router.post('/register', authController.register)
router.post('/login', authController.login)
router.post('/refresh', authController.refresh)
router.post('/logout', authController.logout)

// Microsoft OAuth
router.get('/microsoft', authController.microsoftRedirect)
router.get('/microsoft/callback', authController.microsoftCallback)
router.post('/microsoft/disconnect', auth, authController.microsoftDisconnect)

// Google OAuth
router.get('/google', authController.googleRedirect)
router.get('/google/callback', authController.googleCallback)
router.post('/google/disconnect', auth, authController.googleDisconnect)

export default router
