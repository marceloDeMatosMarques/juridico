import { Router } from 'express'
import { financialController } from '../controllers/financial.controller'
import { auth } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'

const router = Router({ mergeParams: true })
router.use(auth, requireRole('advogado', 'assistente'))

router.get('/',                                            financialController.list)
router.post('/',                                           financialController.create)
router.put('/:recordId',                                   financialController.update)
router.delete('/:recordId',                                financialController.delete)
router.patch('/:recordId/installments/:installmentId/pay', financialController.payInstallment)

export default router
