import { Router } from 'express'
import { auth } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'
import { petitionController } from '../controllers/petition.controller'
import { processesController } from '../controllers/processes.controller'
import documentsRouter from './documents.routes'
import videosRouter from './videos.routes'
import hearingsRouter from './hearings.routes'
import financialRouter from './financial.routes'

const router = Router()
const guard = [auth, requireRole('advogado', 'assistente')]

// CRUD
router.get( '/',    ...guard, processesController.list)
router.post('/',    ...guard, processesController.create)
router.get( '/:id', ...guard, processesController.getOne)
router.put( '/:id', ...guard, processesController.update)
router.delete('/:id', ...guard, processesController.delete)

// Sub-resources
router.use('/:id/documents', documentsRouter)
router.use('/:id/videos',    videosRouter)
router.use('/:id/hearings',  hearingsRouter)
router.use('/:id/financial', financialRouter)
router.post('/:id/ai-summary',       ...guard, processesController.generateAiSummary)
router.post('/:id/summary',          ...guard, petitionController.saveSummary)
router.get( '/:id/petition/preview', ...guard, petitionController.preview)
router.post('/:id/petition',         ...guard, petitionController.generate)

export default router
