import { google } from 'googleapis'
import { GoogleAPIService } from '../GoogleAPIService'
import type { IStorageProvider, StorageFolder, FolderStructure, StoredFile, UploadSessionResult } from './IStorageProvider'
import { prisma } from '../../config/database'
import type { OAuth2Client } from 'google-auth-library'

function sanitize(name: string): string {
  return name.replace(/[/\\]/g, '_').trim().slice(0, 60) || 'sem-nome'
}

export class GoogleDriveProvider implements IStorageProvider {
  readonly providerName = 'googledrive' as const
  private googleService: GoogleAPIService

  constructor(private userId: string) {
    this.googleService = new GoogleAPIService(userId)
  }

  private driveClient(auth: OAuth2Client) {
    return google.drive({ version: 'v3', auth })
  }

  private async getRootFolderId(auth: OAuth2Client): Promise<string> {
    const settings = await prisma.settings.findUnique({ where: { user_id: this.userId } })
    if (settings?.google_drive_root_folder_id) return settings.google_drive_root_folder_id

    const folder = await this.createOrGetFolder(auth, 'root', 'JurisControl')
    // Save root folder ID for future use
    await prisma.settings.update({
      where: { user_id: this.userId },
      data: { google_drive_root_folder_id: folder.folderId },
    })
    return folder.folderId
  }

  private async createOrGetFolder(auth: OAuth2Client, parentId: string, name: string): Promise<StorageFolder> {
    const sanitized = sanitize(name)
    const drive = this.driveClient(auth)

    // Check if exists
    const q = `name='${sanitized.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    const { data: list } = await drive.files.list({ q, fields: 'files(id, webViewLink)', pageSize: 1 })

    if (list.files && list.files.length > 0) {
      return {
        folderId: list.files[0].id!,
        folderUrl: list.files[0].webViewLink ?? '',
        provider: 'googledrive',
      }
    }

    // Create
    const { data } = await drive.files.create({
      requestBody: {
        name: sanitized,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id, webViewLink',
    })
    return { folderId: data.id!, folderUrl: data.webViewLink ?? '', provider: 'googledrive' }
  }

  async createFolder(name: string, parentId?: string): Promise<StorageFolder> {
    const auth = await this.googleService.getClient()
    const parent = parentId ?? await this.getRootFolderId(auth)
    return this.createOrGetFolder(auth, parent, name)
  }

  async createFolderStructure(clientName: string, processRef: string): Promise<FolderStructure> {
    const auth = await this.googleService.getClient()
    const rootId = await this.getRootFolderId(auth)
    const clientFolder = await this.createOrGetFolder(auth, rootId, clientName)
    const processFolder = await this.createOrGetFolder(auth, clientFolder.folderId, processRef)
    const [docsFolder, videosFolder, pdfsFolder] = await Promise.all([
      this.createOrGetFolder(auth, processFolder.folderId, 'Documentos'),
      this.createOrGetFolder(auth, processFolder.folderId, 'Videos'),
      this.createOrGetFolder(auth, processFolder.folderId, 'PDFs'),
    ])
    return {
      root: processFolder,
      documentos: docsFolder,
      videos: videosFolder,
      pdfs: pdfsFolder,
    }
  }

  async uploadFile(buffer: Buffer, fileName: string, folderId: string, mimeType: string): Promise<StoredFile> {
    const auth = await this.googleService.getClient()
    const drive = this.driveClient(auth)
    const { data } = await drive.files.create({
      requestBody: { name: fileName, parents: [folderId] },
      media: { mimeType, body: bufferToStream(buffer) },
      fields: 'id, webViewLink, size',
    })
    const publicLink = await this.createPublicLink(data.id!)
    return { itemId: data.id!, publicLink, provider: 'googledrive', fileName, fileSize: buffer.length }
  }

  async createUploadSession(fileName: string, folderId: string, _fileSize: number): Promise<UploadSessionResult> {
    const auth = await this.googleService.getClient()
    const drive = this.driveClient(auth)
    // Initiate resumable upload
    const res = await drive.files.create(
      {
        requestBody: { name: fileName, parents: [folderId] },
        media: { mimeType: 'application/octet-stream' },
        fields: 'id',
      },
      { responseType: 'json' }
    )
    const uploadId = res.data.id ?? ''
    return { uploadUrl: '', uploadId, provider: 'googledrive' }
  }

  async finalizeUpload(_uploadId: string, itemId: string): Promise<StoredFile> {
    const auth = await this.googleService.getClient()
    const drive = this.driveClient(auth)
    const { data } = await drive.files.get({ fileId: itemId, fields: 'id, name, size' })
    const publicLink = await this.createPublicLink(itemId)
    return {
      itemId,
      publicLink,
      provider: 'googledrive',
      fileName: data.name ?? '',
      fileSize: Number(data.size ?? 0),
    }
  }

  async createPublicLink(itemId: string): Promise<string> {
    const auth = await this.googleService.getClient()
    const drive = this.driveClient(auth)
    await drive.permissions.create({
      fileId: itemId,
      requestBody: { role: 'reader', type: 'anyone' },
    })
    const { data } = await drive.files.get({ fileId: itemId, fields: 'webViewLink' })
    return data.webViewLink ?? ''
  }

  async downloadFile(itemId: string): Promise<Buffer> {
    const auth = await this.googleService.getClient()
    const drive = this.driveClient(auth)
    const response = await drive.files.get(
      { fileId: itemId, alt: 'media' },
      { responseType: 'arraybuffer' }
    )
    return Buffer.from(response.data as ArrayBuffer)
  }

  async checkConnection(_userId: string): Promise<boolean> {
    try {
      await this.googleService.getClient()
      return true
    } catch { return false }
  }
}

import { Readable } from 'stream'
function bufferToStream(buffer: Buffer): Readable {
  const stream = new Readable()
  stream.push(buffer)
  stream.push(null)
  return stream
}
