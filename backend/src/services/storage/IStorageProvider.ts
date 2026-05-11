export interface UploadSessionResult {
  uploadUrl: string
  uploadId: string
  provider: 'onedrive' | 'googledrive'
}

export interface StoredFile {
  itemId: string
  publicLink: string
  provider: 'onedrive' | 'googledrive'
  fileName: string
  fileSize: number
}

export interface StorageFolder {
  folderId: string
  folderUrl: string
  provider: 'onedrive' | 'googledrive'
}

export interface FolderStructure {
  root: StorageFolder
  documentos: StorageFolder
  videos: StorageFolder
  pdfs: StorageFolder
}

export interface IStorageProvider {
  readonly providerName: 'onedrive' | 'googledrive'

  createFolder(name: string, parentId?: string): Promise<StorageFolder>
  createFolderStructure(clientName: string, processRef: string): Promise<FolderStructure>

  uploadFile(buffer: Buffer, fileName: string, folderId: string, mimeType: string): Promise<StoredFile>
  createUploadSession(fileName: string, folderId: string, fileSize: number, mimeType?: string): Promise<UploadSessionResult>
  finalizeUpload(uploadId: string, itemId: string): Promise<StoredFile>

  createPublicLink(itemId: string): Promise<string>
  downloadFile(itemId: string): Promise<Buffer>
  checkConnection(userId: string): Promise<boolean>
}
