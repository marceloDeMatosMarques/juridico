import 'dotenv/config'
import path from 'path'
import fs from 'fs'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import apiRouter, { authRouter } from './routes/index'
import { errorHandler } from './middleware/errorHandler'
import { startCleanupJob } from './jobs/cleanupJob'
import { startRemindersJob } from './jobs/remindersJob'
import { startCourtMonitoringJob } from './jobs/courtMonitoringJob'

const app = express()
const PORT = process.env.PORT ?? 3001

app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Serve arquivos gerados localmente (PDFs, uploads)
const DOWNLOADS_DIR = path.join(process.env.UPLOAD_TEMP_DIR ?? '/tmp/juriscontrol')
fs.mkdirSync(DOWNLOADS_DIR, { recursive: true })
app.use('/api/downloads', express.static(DOWNLOADS_DIR, { dotfiles: 'deny' }))

app.use('/auth', authRouter)
app.use('/api', apiRouter)

app.use(errorHandler)

startCleanupJob()
startRemindersJob()
startCourtMonitoringJob()

app.listen(PORT, () => {
  console.log(JSON.stringify({
    level: 'info',
    action: 'server_start',
    data: { port: PORT, env: process.env.NODE_ENV ?? 'development' },
  }))
})

export default app
