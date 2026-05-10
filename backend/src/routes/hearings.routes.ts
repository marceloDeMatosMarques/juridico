import { Router } from 'express'
import { hearingsController } from '../controllers/hearings.controller'
import { auth } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'

const router = Router({ mergeParams: true })

router.use(auth, requireRole('advogado', 'assistente'))

router.get( '/',             hearingsController.list)
router.post('/',             hearingsController.create)
router.put( '/:hearingId',   hearingsController.update)
router.delete('/:hearingId', hearingsController.delete)

export default router
