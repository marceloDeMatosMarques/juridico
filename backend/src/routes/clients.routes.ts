import { Router } from 'express'
import { clientsController } from '../controllers/clients.controller'
import { auth } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'

const router = Router()

router.get('/',    auth, requireRole('advogado', 'assistente'), clientsController.list)
router.post('/',   auth, requireRole('advogado', 'assistente'), clientsController.create)
router.get('/:id', auth, requireRole('advogado', 'assistente'), clientsController.getOne)
router.put('/:id', auth, requireRole('advogado', 'assistente'), clientsController.update)
router.delete('/:id', auth, requireRole('advogado'), clientsController.delete)

router.get('/:id/check-procuracao',   auth, requireRole('advogado', 'assistente'), clientsController.checkProcuracao)
router.post('/:id/generate-procuracao', auth, requireRole('advogado', 'assistente'), clientsController.generateProcuracao)

export default router
