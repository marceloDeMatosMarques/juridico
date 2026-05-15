import { Router } from 'express'
import authRouter from './auth.routes'
import clientsRouter from './clients.routes'
import intakeRouter from './intake.routes'
import processesRouter from './processes.routes'
import whatsappRouter from './whatsapp.routes'
import courtNotificationsRouter from './courtNotifications.routes'
import monitoredDomainsRouter from './monitoredDomains.routes'
import dashboardRouter from './dashboard.routes'
import portalRouter from './portal.routes'
import caseRequestsRouter from './caseRequests.routes'
import { auth } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'
import { authController } from '../controllers/auth.controller'
import { financialController } from '../controllers/financial.controller'
import { portalAuthController } from '../controllers/portalAuth.controller'

const router = Router()

router.get('/settings/providers', auth, authController.providersStatus)
router.put('/settings/providers', auth, authController.updateProviderPreferences)

router.use('/clients',               clientsRouter)
router.use('/intake',                intakeRouter)
router.use('/processes',             processesRouter)
router.use('/whatsapp',              whatsappRouter)
router.use('/court-notifications',   courtNotificationsRouter)
router.use('/court-monitoring',      monitoredDomainsRouter)
router.get('/financial/dashboard',   auth, requireRole('advogado', 'assistente'), financialController.dashboard)
router.use('/dashboard',             dashboardRouter)
router.use('/portal',                portalRouter)
router.use('/case-requests',         caseRequestsRouter)
router.post('/clients/:clientId/activate-portal', auth, requireRole('advogado'), portalAuthController.activatePortal)
router.post('/clients/:clientId/resend-portal',   auth, requireRole('advogado'), portalAuthController.resendPortal)

export { authRouter }
export default router
