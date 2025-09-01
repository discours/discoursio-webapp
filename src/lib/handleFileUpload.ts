import { UploadFile } from '@solid-primitives/upload'
import { cdnUrl } from '../config'
import { validateUploads } from './validateUploads'

// Запасной URL для CDN (старый эндпоинт)
const fallbackCdnUrl = 'https://files.dscrs.site'

// Проверка доступности CDN сервера
const checkCdnAvailability = async (url: string, token?: string): Promise<boolean> => {
  try {
    // Формируем заголовки для проверки
    let headers = {}
    if (token) {
      if (token.startsWith('Bearer ')) {
        headers = { Authorization: token }
      } else {
        headers = { Authorization: `Bearer ${token}` }
      }
    }

    // Попытка проверить работоспособность quoter API
    // Quoter не имеет эндпоинта /health, но отвечает 401 на GET /
    const response = await fetch(url, {
      method: 'GET',
      headers,
      // Устанавливаем короткий таймаут, чтобы не ждать долго
      signal: AbortSignal.timeout(2000)
    }).catch(() => null)

    // Quoter возвращает 401 для неавторизованного GET, что означает что он доступен
    return !!response && (response.ok || response.status === 401)
  } catch (error) {
    console.warn('[checkCdnAvailability] Failed to check CDN:', error)
    return false
  }
}

export const filesToUploadFiles = (files: File[]): UploadFile[] => {
  return files.map((file) => ({
    name: file.name,
    size: file.size,
    source: file.name,
    file: file
  }))
}

// Move clipboard paste handler to a separate file
export type FileType = 'audio' | 'video' | 'image' | 'file'

export const allowedImageTypes = new Set([
  'image/bmp',
  'image/gif',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/tiff',
  'image/webp',
  'image/x-icon'
])

export const handleImageUpload = async (files: File[], token?: string): Promise<string | undefined> => {
  try {
    const uploadFiles = filesToUploadFiles(files)
    const validFiles = await validateUploads('image', uploadFiles)
    if (!validFiles) return 'Invalid file type'

    const result = await handleFileUpload(uploadFiles, token || '', 'image')
    if (result) return
  } catch (error) {
    console.error('Upload error:', error)
    return 'Upload failed'
  }
}

export const handleFileUpload = async (
  uploadFile: UploadFile | UploadFile[],
  token: string,
  type: FileType = 'image'
) => {
  const formData = new FormData()
  const files = Array.isArray(uploadFile) ? uploadFile : [uploadFile]

  // Validate image types if needed
  if (type === 'image') {
    const invalidImage = files.some((file) => !allowedImageTypes.has(file.file.type))
    if (invalidImage) {
      console.error(
        '[handleFileUpload] Invalid image type detected',
        files.map((file) => ({ name: file.name, type: file.file.type }))
      )
      throw new Error('Invalid image type')
    }
  }

  // Проверка размера файла - ограничение 5 МБ
  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 МБ в байтах
  const oversizedFiles = files.filter((file) => file.size > MAX_FILE_SIZE)

  if (oversizedFiles.length > 0) {
    console.error(
      '[handleFileUpload] File size exceeds limit',
      oversizedFiles.map((file) => ({ name: file.name, size: file.size }))
    )
    throw new Error('Файл слишком большой. Максимальный размер файла: 5 МБ.')
  }

  files.forEach((file) => {
    formData.append('file', file.file, file.name)
  })

  // Выбор активного CDN URL - проверяем основной и запасной
  let activeCdnUrl = cdnUrl
  const isPrimaryAvailable = await checkCdnAvailability(cdnUrl, token)

  if (!isPrimaryAvailable) {
    console.warn('[handleFileUpload] Primary CDN unavailable, trying fallback:', fallbackCdnUrl)
    const isFallbackAvailable = await checkCdnAvailability(fallbackCdnUrl, token)

    if (isFallbackAvailable) {
      activeCdnUrl = fallbackCdnUrl
      console.log('[handleFileUpload] Using fallback CDN:', activeCdnUrl)
    } else {
      console.error('[handleFileUpload] Both primary and fallback CDNs are unavailable')
      // Продолжаем с основным URL, но предупреждаем пользователя
    }
  }

  console.log('[handleFileUpload] Uploading files to CDN:', activeCdnUrl, {
    filesCount: files.length,
    hasToken: !!token,
    fileTypes: files.map((f) => f.file.type)
  })

  try {
    // Проверяем и форматируем токен авторизации
    let authHeader = {}
    if (token) {
      console.log('[handleFileUpload] Token format check:', {
        tokenLength: token.length,
        startsWithBearer: token.startsWith('Bearer '),
        type: typeof token
      })

      // Проверяем разные форматы токена
      if (token.startsWith('Bearer ')) {
        authHeader = { Authorization: token }
      } else {
        authHeader = { Authorization: `Bearer ${token}` }
      }
    }

    // Пытаемся загрузить файл
    let uploadAttempts = 0
    const maxAttempts = 2 // Максимальное число попыток загрузки
    let response: Response | null = null

    while (uploadAttempts < maxAttempts) {
      try {
        // Используем активный CDN URL для загрузки
        response = await fetch(activeCdnUrl, {
          method: 'POST',
          body: formData,
          headers: {
            ...authHeader,
            Accept: 'application/json'
          },
          // Увеличиваем таймаут для больших файлов
          signal: AbortSignal.timeout(30000)
        })

        // Если успешно загрузили, прерываем цикл
        if (response.ok) break

        // Если ошибка, но не 500, прерываем цикл
        if (response.status !== 500) break

        // Если получили 500, пробуем альтернативный URL
        uploadAttempts++

        if (uploadAttempts < maxAttempts) {
          // Переключаемся на другой URL при следующей попытке
          activeCdnUrl = activeCdnUrl === cdnUrl ? fallbackCdnUrl : cdnUrl
          console.log(`[handleFileUpload] Retry ${uploadAttempts} with URL:`, activeCdnUrl)
        }
      } catch (error) {
        console.error('[handleFileUpload] Upload attempt failed:', error)
        uploadAttempts++

        if (uploadAttempts < maxAttempts) {
          // Переключаемся на другой URL при следующей попытке
          activeCdnUrl = activeCdnUrl === cdnUrl ? fallbackCdnUrl : cdnUrl
          console.log(`[handleFileUpload] Retry ${uploadAttempts} with URL:`, activeCdnUrl)
        } else {
          throw new Error('Не удалось загрузить файл после нескольких попыток. Проверьте соединение.')
        }
      }
    }

    if (!response) {
      throw new Error('Не удалось получить ответ от сервера загрузки файлов.')
    }

    console.log('[handleFileUpload] Upload response:', {
      status: response.status,
      statusText: response.statusText,
      location: response.headers.get('Location'),
      contentType: response.headers.get('Content-Type'),
      ok: response.ok
    })

    if (!response.ok) {
      let errorText = ''
      try {
        // Пытаемся получить JSON ответ с ошибкой
        const errorJson = await response.json().catch(() => null)
        if (errorJson) {
          errorText = JSON.stringify(errorJson)
        } else {
          // Если не получилось, читаем как текст
          errorText = await response.text().catch(() => 'Failed to read error response')
        }
      } catch (_err) {
        errorText = 'Failed to parse error response'
      }

      console.error('[handleFileUpload] Upload failed:', {
        status: response.status,
        statusText: response.statusText,
        errorText,
        cdnUrl: activeCdnUrl
      })

      // Проверяем тип ошибки и формируем подходящее сообщение
      if (response.status === 500) {
        if (errorText.includes('environment variable not found')) {
          throw new Error('Ошибка конфигурации сервера: отсутствует переменная окружения.')
        }
        throw new Error('Ошибка сервера: сервис временно недоступен. Попробуйте позже.')
      }

      if (response.status === 401) {
        // Проверяем тип ошибки 401 - может быть авторизация или квота
        if (errorText.includes('Quota exceeded')) {
          throw new Error('Превышена квота загрузки файлов. Обратитесь к администратору для увеличения лимита.')
        }
        throw new Error('Ошибка авторизации. Пожалуйста, войдите в систему снова.')
      }

      if (response.status === 403) {
        throw new Error('Недостаточно прав для загрузки файлов.')
      }

      if (response.status === 413) {
        throw new Error('Файл слишком большой. Максимальный размер файла: 5 МБ.')
      }

      if (response.status === 415) {
        throw new Error('Неподдерживаемый формат файла. Проверьте тип загружаемого файла.')
      }

      if (response.status === 404) {
        throw new Error('Сервис загрузки временно недоступен. Попробуйте позже.')
      }

      throw new Error(`Ошибка загрузки: ${response.status} ${response.statusText}`)
    }

    if (type === 'image') {
      // Новый API возвращает имя файла напрямую в теле ответа
      const responseText = await response.text()
      console.log('[handleFileUpload] Got filename from response:', responseText)

      if (!responseText || responseText.trim() === '') {
        console.error('[handleFileUpload] Empty filename in response')
        throw new Error('Empty filename in response')
      }

      const filename = responseText.trim()

      // Новый API возвращает только имя файла, строим URL
      const originalFilename = filename
      const url = `${activeCdnUrl}/${filename}`

      console.log('[handleFileUpload] Constructed image URL:', {
        filename,
        url,
        originalFilename,
        activeCdnUrl
      })

      // Check image availability
      try {
        await new Promise<void>((resolve, _reject) => {
          let retryCount = 0
          const maxRetries = 5 // Увеличиваем количество попыток
          const checkUploadedImage = () => {
            console.log(`[handleFileUpload] Checking image availability (attempt ${retryCount + 1}): ${url}`)
            const uploadedImage = new Image()

            uploadedImage.addEventListener('load', () => {
              console.log('[handleFileUpload] Image loaded successfully:', url)
              resolve()
            })

            uploadedImage.addEventListener('error', (error) => {
              console.warn(
                `[handleFileUpload] Error loading image (attempt ${retryCount + 1}):`,
                error instanceof Event ? 'Event object (no details)' : error
              )
              retryCount++
              if (retryCount >= maxRetries) {
                console.error('[handleFileUpload] Max retries reached, giving up')
                // Возвращаем URL даже если не удалось подтвердить его доступность
                // чтобы не блокировать пользователя
                resolve()
                // return reject(new Error('Failed to load uploaded image after multiple attempts'))
              } else {
                const delay = retryCount * 1000 // Увеличиваем задержку с каждой попыткой
                console.log(`[handleFileUpload] Retrying in ${delay / 1000} seconds (attempt ${retryCount + 1})`)
                setTimeout(() => checkUploadedImage(), delay)
              }
            })

            uploadedImage.src = url
          }
          checkUploadedImage()
        })
      } catch (imageCheckError) {
        console.warn('[handleFileUpload] Image availability check failed but continuing anyway:', imageCheckError)
        // Продолжаем работу даже если не удалось проверить изображение
      }

      return { url, originalFilename } as const
    }

    // Для остальных типов файлов возвращаем имя файла
    const responseText = await response.text()
    return { url: '', originalFilename: responseText.trim() }
  } catch (error) {
    console.error('[handleFileUpload] Error during upload:', error)
    throw error
  }
}
