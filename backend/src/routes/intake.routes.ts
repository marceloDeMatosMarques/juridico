import { Router } from 'express'
import { intakeController } from '../controllers/intake.controller'
import { auth } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'
import { upload } from '../middleware/upload'

const router = Router()

// Rotas protegidas (advogado/assistente geram o token)
router.post('/generate',     auth, requireRole('advogado', 'assistente'), intakeController.generateToken)
router.post('/generate-new', auth, requireRole('advogado', 'assistente'), intakeController.generateTokenNew)

// Rotas públicas — autenticação por token de intake
router.get( '/:token/status',    intakeController.getStatus)
router.get( '/:token/documents', intakeController.getDocuments)
router.post('/:token/generate-temp-procuracao', intakeController.generateTempProcuracao)
router.post('/:token/submit',    intakeController.submit)
router.post('/:token/upload',    upload.single('file'), intakeController.upload)

export default router
