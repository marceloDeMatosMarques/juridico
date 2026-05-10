import multer from 'multer'

const MAX_FILE_SIZE = parseInt(
  (process.env.MAX_FILE_SIZE ?? '50mb').replace(/[^0-9]/gi, '')
) * 1024 * 1024

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
})
