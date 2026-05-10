import { Router } from 'express'
import { dashboardController } from '../controllers/dashboard.controller'
import { auth } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'

const router = Router()
router.get('/', auth, requireRole('advogado', 'assistente'), dashboardController.getSummary)
export default router
