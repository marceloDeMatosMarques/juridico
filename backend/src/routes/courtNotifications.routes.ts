import { Router } from 'express'
import { courtNotificationsController } from '../controllers/courtNotifications.controller'
import { auth } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'

const router = Router()
router.use(auth, requireRole('advogado', 'assistente'))

router.get('/',                        courtNotificationsController.list)
router.get('/unread-count',            courtNotificationsController.unreadCount)
router.get('/process/:processId',      courtNotificationsController.byProcess)
router.patch('/:id/read',              courtNotificationsController.markRead)
router.delete('/:id',                  courtNotificationsController.delete)

export default router
