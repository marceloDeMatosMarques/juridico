import cron from 'node-cron'
import path from 'path'
import fs from 'fs'

const PDF_DIR = path.join(process.env.UPLOAD_TEMP_DIR ?? '/tmp/juriscontrol', 'pdfs')
const ONE_HOUR = 60 * 60 * 1000

export function startCleanupJob() {
  cron.schedule('*/30 * * * *', () => {
    try {
      if (!fs.existsSync(PDF_DIR)) return
      const now = Date.now()
      for (const file of fs.readdirSync(PDF_DIR)) {
        const filePath = path.join(PDF_DIR, file)
        try {
          const stat = fs.statSync(filePath)
          if (now - stat.mtimeMs > ONE_HOUR) {
            fs.unlinkSync(filePath)
          }
        } catch { /* ignore individual file errors */ }
      }
    } catch { /* ignore cleanup errors */ }
  })
}
