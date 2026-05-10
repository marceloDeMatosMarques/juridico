import { Router } from 'express'
import { videosController } from '../controllers/videos.controller'
import { auth } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'

const router = Router({ mergeParams: true })

router.use(auth, requireRole('advogado', 'assistente'))

router.get( '/',           videosController.list)
router.post('/',           videosController.create)
router.delete('/:videoId', videosController.delete)
router.post('/pdf',        videosController.generatePdf)
router.get( '/pdf',        videosController.listPdfs)

export default router
