import { Router } from 'express'
import { whatsappController } from '../controllers/whatsapp.controller'
import { auth } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'

const router = Router()

// Public — Evolution API webhook
router.post('/webhook', whatsappController.webhook)

// Protected
const guard = [auth, requireRole('advogado', 'assistente')]

router.get( '/config',         ...guard, whatsappController.getConfig)
router.put( '/config',         ...guard, whatsappController.saveConfig)
router.post('/connect',        ...guard, whatsappController.connect)
router.post('/disconnect',     ...guard, whatsappController.disconnect)
router.get( '/qrcode',         ...guard, whatsappController.qrcode)
router.get( '/status',         ...guard, whatsappController.status)
router.post('/send',           ...guard, whatsappController.send)
router.get( '/history/:clientId', ...guard, whatsappController.history)

export default router
