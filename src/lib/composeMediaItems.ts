export const AUDIO_REGEX = /\.(mp3|wav|ogg|m4a)$/i

const removeMediaFileExtension = (fileName: string) => {
  return fileName.replace(AUDIO_REGEX, '')
}

export const composeMediaItems = (
  value: { originalFilename?: string; url: string }[],
  optionalParams = {}
) => {
  return value.map((fileData) => {
    return {
      url: fileData.url,
      source: '',
      title: fileData.originalFilename ? removeMediaFileExtension(fileData.originalFilename) : '',
      body: '',
      ...optionalParams
    }
  })
}
