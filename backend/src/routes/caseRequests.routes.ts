import { Router } from 'express'
import { caseRequestsController } from '../controllers/caseRequests.controller'
import { auth } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'

const router = Router()
const guard = [auth, requireRole('advogado', 'assistente')]

router.get('/',              ...guard, caseRequestsController.list)
router.post('/:id/convert',  ...guard, caseRequestsController.convert)
router.post('/:id/reject',   ...guard, caseRequestsController.reject)

export default router
