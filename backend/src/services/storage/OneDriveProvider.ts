import axios from 'axios'
import { MicrosoftGraphService } from '../MicrosoftGraphService'
import type { IStorageProvider, StorageFolder, FolderStructure, StoredFile, UploadSessionResult } from './IStorageProvider'
import { prisma } from '../../config/database'

const GRAPH = 'https://graph.microsoft.com/v1.0'

function sanitize(name: string): string {
  return name.replace(/[\\/:*?"<>|#%]/g, '_').trim().slice(0, 60) || 'sem-nome'
}

export class OneDriveProvider implements IStorageProvider {
  readonly providerName = 'onedrive' as const
  private graphService: MicrosoftGraphService

  constructor(private userId: string) {
    this.graphService = new MicrosoftGraphService(userId)
  }

  private async getRootFolderId(token: string): Promise<string> {
    const settings = await prisma.settings.findUnique({ where: { user_id: this.userId } })
    const rootName = settings?.onedrive_root_folder ?? 'JurisControl'
    const folder = await this.createOrGetFolderByPath(token, 'root', rootName)
    return folder.folderId
  }

  private async createOrGetFolderByPath(token: string, parentId: string, name: string): Promise<StorageFolder> {
    const sanitized = sanitize(name)
    const parentSeg = parentId === 'root' ? 'root' : `items/${parentId}`
    try {
      const { data } = await axios.post(
        `${GRAPH}/me/drive/${parentSeg}/children`,
        { name: sanitized, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      )
      return { folderId: data.id, folderUrl: data.webUrl ?? '', provider: 'onedrive' }
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        // Already exists — fetch it
        const { data } = await axios.get(
          parentId === 'root'
            ? `${GRAPH}/me/drive/root:/${encodeURIComponent(sanitized)}`
            : `${GRAPH}/me/drive/items/${parentId}:/${encodeURIComponent(sanitized)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        return { folderId: data.id, folderUrl: data.webUrl ?? '', provider: 'onedrive' }
      }
      throw err
    }
  }

  async createFolder(name: string, parentId?: string): Promise<StorageFolder> {
    const token = await this.graphService.getValidToken()
    return this.createOrGetFolderByPath(token, parentId ?? 'root', name)
  }

  async createFolderStructure(clientName: string, processRef: string): Promise<FolderStructure> {
    const token = await this.graphService.getValidToken()
    const rootId = await this.getRootFolderId(token)
    const clientFolder = await this.createOrGetFolderByPath(token, rootId, clientName)
    const processFolder = await this.createOrGetFolderByPath(token, clientFolder.folderId, processRef)
    const [docsFolder, videosFolder, pdfsFolder] = await Promise.all([
      this.createOrGetFolderByPath(token, processFolder.folderId, 'Documentos'),
      this.createOrGetFolderByPath(token, processFolder.folderId, 'Videos'),
      this.createOrGetFolderByPath(token, processFolder.folderId, 'PDFs'),
    ])
    return {
      root: processFolder,
      documentos: docsFolder,
      videos: videosFolder,
      pdfs: pdfsFolder,
    }
  }

  async uploadFile(buffer: Buffer, fileName: string, folderId: string, mimeType: string): Promise<StoredFile> {
    const token = await this.graphService.getValidToken()
    const { data } = await axios.put(
      `${GRAPH}/me/drive/items/${folderId}:/${encodeURIComponent(fileName)}:/content`,
      buffer,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': mimeType } }
    )
    const publicLink = await this.createPublicLink(data.id)
    return { itemId: data.id, publicLink, provider: 'onedrive', fileName, fileSize: buffer.length }
  }

  async createUploadSession(fileName: string, folderId: string, _fileSize: number): Promise<UploadSessionResult> {
    const token = await this.graphService.getValidToken()
    const { data } = await axios.post(
      `${GRAPH}/me/drive/items/${folderId}:/${encodeURIComponent(fileName)}:/createUploadSession`,
      { item: { '@microsoft.graph.conflictBehavior': 'rename', name: fileName } },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    )
    return { uploadUrl: data.uploadUrl, uploadId: data.uploadUrl, provider: 'onedrive' }
  }

  async finalizeUpload(_uploadId: string, itemId: string): Promise<StoredFile> {
    const token = await this.graphService.getValidToken()
    const { data } = await axios.get(`${GRAPH}/me/drive/items/${itemId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const publicLink = await this.createPublicLink(itemId)
    return { itemId, publicLink, provider: 'onedrive', fileName: data.name, fileSize: data.size }
  }

  async createPublicLink(itemId: string): Promise<string> {
    const token = await this.graphService.getValidToken()
    const { data } = await axios.post(
      `${GRAPH}/me/drive/items/${itemId}/createLink`,
      { type: 'view', scope: 'anonymous' },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    )
    return data.link?.webUrl ?? ''
  }

  async downloadFile(itemId: string): Promise<Buffer> {
    const token = await this.graphService.getValidToken()
    const { data } = await axios.get(`${GRAPH}/me/drive/items/${itemId}/content`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'arraybuffer',
    })
    return Buffer.from(data)
  }

  async checkConnection(_userId: string): Promise<boolean> {
    try {
      await this.graphService.getValidToken()
      return true
    } catch { return false }
  }
}
