import { Router } from 'express'
import { monitoredDomainsController } from '../controllers/monitoredDomains.controller'
import { auth } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'

const router = Router()
router.use(auth, requireRole('advogado', 'assistente'))

// Settings endpoint must come before /:id to avoid param collision
router.put('/settings',  monitoredDomainsController.saveSettings)

router.get('/',          monitoredDomainsController.list)
router.post('/',         monitoredDomainsController.create)
router.patch('/:id',     monitoredDomainsController.toggle)
router.delete('/:id',    monitoredDomainsController.delete)

export default router
