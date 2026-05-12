import { Router } from 'express'
import multer from 'multer'
import os from 'os'
import { videosController } from '../controllers/videos.controller'
import { auth } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'

const router = Router({ mergeParams: true })
const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 500 * 1024 * 1024 } }) // 500 MB

router.use(auth, requireRole('advogado', 'assistente'))

router.get( '/',                           videosController.list)
router.post('/',                           videosController.create)
router.delete('/:videoId',                 videosController.delete)
router.post('/pdf',                        videosController.generatePdf)
router.get( '/pdf',                        videosController.listPdfs)
router.post('/upload-session',             videosController.initUpload)
router.post('/upload-complete',            videosController.completeUpload)
router.post('/upload-googledrive',         upload.single('file'), videosController.uploadGoogleDrive)

export default router
