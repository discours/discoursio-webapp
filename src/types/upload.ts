export type FileTypeToUpload = 'image' | 'video' | 'doc' | 'audio'

export type UploadedFile = {
  url: string
  originalFilename?: string
  localFile?: File // Локальный файл для мгновенного превью
}
