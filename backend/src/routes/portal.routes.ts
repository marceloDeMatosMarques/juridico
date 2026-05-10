import { Router } from 'express'
import multer from 'multer'
import { portalAuthController } from '../controllers/portalAuth.controller'
import { portalController } from '../controllers/portal.controller'
import { auth } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })

const clientAuth = [auth, requireRole('cliente')]

// Public auth endpoints
router.post('/login', portalAuthController.login)

// Portal client endpoints
router.get('/me',                             ...clientAuth, portalController.me)
router.put('/me',                             ...clientAuth, portalController.updateMe)
router.put('/me/password',                    ...clientAuth, portalController.changePassword)
router.get('/processes',                      ...clientAuth, portalController.listProcesses)
router.get('/processes/:id',                  ...clientAuth, portalController.getProcess)
router.get('/processes/:id/documents',        ...clientAuth, portalController.listDocuments)
router.post('/processes/:id/upload',          ...clientAuth, upload.single('file'), portalController.uploadDocument)
router.post('/new-case-request',              ...clientAuth, portalController.newCaseRequest)

export default router
