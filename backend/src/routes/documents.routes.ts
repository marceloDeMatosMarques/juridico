import { Router } from 'express'
import { documentsController } from '../controllers/documents.controller'
import { auth } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'
import { upload } from '../middleware/upload'

const router = Router({ mergeParams: true })

router.use(auth, requireRole('advogado', 'assistente'))

router.get(   '/',               documentsController.list)
router.post(  '/upload',         upload.single('file'), documentsController.upload)
router.put(   '/reorder',        documentsController.reorder)
router.put(   '/:docId/rotate',  documentsController.rotate)
router.delete('/:docId',         documentsController.delete)
router.post(  '/:docId/unlock',  documentsController.unlock)
router.post(  '/:docId/sync',    documentsController.sync)

export default router
