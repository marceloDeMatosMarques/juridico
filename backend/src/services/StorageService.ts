import { prisma } from '../config/database'
import { OneDriveProvider } from './storage/OneDriveProvider'
import { GoogleDriveProvider } from './storage/GoogleDriveProvider'
import type { IStorageProvider, FolderStructure, StoredFile } from './storage/IStorageProvider'

export interface StorageFolderResult {
  onedrive?: { folderId: string; folderUrl: string; docsFolderId: string }
  googledrive?: { folderId: string; folderUrl: string; docsFolderId: string }
}

export interface CloudSyncResult {
  onedrive?: { itemId: string; shareLink: string }
  googledrive?: { itemId: string; shareLink: string }
}

export class StorageService {
  constructor(private userId: string) {}

  private async getProviders(): Promise<IStorageProvider[]> {
    const user = await prisma.user.findUnique({ where: { id: this.userId }, select: { storage_provider: true } })
    const pref = user?.storage_provider ?? 'onedrive'
    const providers: IStorageProvider[] = []
    if (pref === 'onedrive' || pref === 'ambos') providers.push(new OneDriveProvider(this.userId))
    if (pref === 'googledrive' || pref === 'ambos') providers.push(new GoogleDriveProvider(this.userId))
    return providers
  }

  async createFolderStructure(clientName: string, processRef: string): Promise<StorageFolderResult> {
    const providers = await this.getProviders()
    const results = await Promise.allSettled(
      providers.map(p => p.createFolderStructure(clientName, processRef))
    )

    const out: StorageFolderResult = {}
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        const provider = providers[i].providerName
        const folder: FolderStructure = result.value
        if (provider === 'onedrive') {
          out.onedrive = {
            folderId: folder.root.folderId,
            folderUrl: folder.root.folderUrl,
            docsFolderId: folder.documentos.folderId,
          }
        } else {
          out.googledrive = {
            folderId: folder.root.folderId,
            folderUrl: folder.root.folderUrl,
            docsFolderId: folder.documentos.folderId,
          }
        }
      } else {
        const reason = result.reason
        const detail = reason?.response?.data ?? reason?.response?.status ?? reason?.message
        console.error(JSON.stringify({
          level: 'error',
          action: 'storage_folder_creation_failed',
          data: { provider: providers[i].providerName, userId: this.userId, error: reason?.message, detail },
        }))
      }
    })
    return out
  }

  async uploadBuffer(
    folderIds: { onedrive?: string | null; googledrive?: string | null },
    buffer: Buffer,
    fileName: string,
    mimeType: string,
  ): Promise<CloudSyncResult> {
    const providers = await this.getProviders()
    const out: CloudSyncResult = {}

    await Promise.allSettled(providers.map(async provider => {
      if (provider.providerName === 'onedrive' && folderIds.onedrive) {
        const file = await provider.uploadFile(buffer, fileName, folderIds.onedrive, mimeType)
        out.onedrive = { itemId: file.itemId, shareLink: file.publicLink }
      }
      if (provider.providerName === 'googledrive' && folderIds.googledrive) {
        const file = await provider.uploadFile(buffer, fileName, folderIds.googledrive, mimeType)
        out.googledrive = { itemId: file.itemId, shareLink: file.publicLink }
      }
    }))

    return out
  }

  async syncDocument(
    process: { onedrive_docs_folder_id: string | null; google_drive_docs_folder_id: string | null },
    buffer: Buffer,
    fileName: string,
    mimeType: string,
  ): Promise<CloudSyncResult> {
    return this.uploadBuffer(
      { onedrive: process.onedrive_docs_folder_id, googledrive: process.google_drive_docs_folder_id },
      buffer, fileName, mimeType,
    )
  }

  async createVideoUploadSession(
    process: { id: string; onedrive_folder_id: string | null; google_drive_folder_id: string | null },
    fileName: string,
    fileSize: number,
    mimeType: string,
    targetProvider: 'onedrive' | 'googledrive'
  ): Promise<{ uploadUrl: string; uploadId: string; provider: string }> {
    const provider: IStorageProvider = targetProvider === 'onedrive'
      ? new OneDriveProvider(this.userId)
      : new GoogleDriveProvider(this.userId)

    const connected = await provider.checkConnection(this.userId)
    if (!connected) {
      const name = targetProvider === 'onedrive' ? 'OneDrive' : 'Google Drive'
      throw new Error(`${name} não está conectado. Conecte sua conta nas Configurações.`)
    }

    const rootFolderId = targetProvider === 'onedrive' ? process.onedrive_folder_id : process.google_drive_folder_id
    if (!rootFolderId) {
      throw new Error('Pasta do processo não encontrada. Reconecte o provedor e edite o processo para criar as pastas.')
    }

    const videosFolder = await provider.createFolder('Videos', rootFolderId)
    const session = await provider.createUploadSession(fileName, videosFolder.folderId, fileSize, mimeType)
    return { uploadUrl: session.uploadUrl, uploadId: session.uploadId, provider: targetProvider }
  }

  async finalizeVideoUpload(
    targetProvider: 'onedrive' | 'googledrive',
    uploadId: string,
    itemId: string
  ): Promise<StoredFile> {
    const provider: IStorageProvider = targetProvider === 'onedrive'
      ? new OneDriveProvider(this.userId)
      : new GoogleDriveProvider(this.userId)
    return provider.finalizeUpload(uploadId, itemId)
  }

  async checkConnections(): Promise<{ onedrive: boolean; googledrive: boolean }> {
    const [od, gd] = await Promise.allSettled([
      new OneDriveProvider(this.userId).checkConnection(this.userId),
      new GoogleDriveProvider(this.userId).checkConnection(this.userId),
    ])
    return {
      onedrive: od.status === 'fulfilled' && od.value,
      googledrive: gd.status === 'fulfilled' && gd.value,
    }
  }
}
