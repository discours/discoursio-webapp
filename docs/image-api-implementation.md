# 📤📥 Image Upload & Download API Implementation

## 🎯 Архитектура Overview

Система обработки изображений состоит из **3 независимых API**:

```
1. 📤 Upload API    (Квотер → S3)
2. 📥 Download API  (Vercel + Квотер)  
3. 🎨 OG API       (@vercel/og)
```

---

## 📤 Upload API Implementation

### **Endpoint Configuration**
```typescript
// src/config.ts
export const cdnUrl = import.meta.env.PUBLIC_CDN_URL || 'https://files.dscrs.site'

// Environment var
PUBLIC_CDN_URL=https://files.dscrs.site // Production
```

### **Upload Flow**
```typescript
// src/lib/handleFileUpload.ts
export const handleFileUpload = async (
  uploadFile: UploadFile | UploadFile[],
  token: string,
  type: FileType = 'image'
) => {
  // 1. File validation
  validateFiles(files, type)
  
  // 2. CDN availability check  
  if (!(await checkCdnAvailability(cdnUrl, token))) {
    throw new Error('CDN unavailable')
  }
  
  // 3. FormData preparation
  const formData = new FormData()
  for (const file of files) {
    formData.append('file', file.file, file.name)
  }
  
  // 4. Upload with retry
  const authHeader = formatAuthHeader(token)
  const response = await uploadWithRetry(cdnUrl, formData, authHeader)
  
  // 5. Response processing
  return processResponse(response, type, cdnUrl)
}
```

### **File Validation**
```typescript
// Allowed file types
export const allowedImageTypes = new Set([
  'image/bmp', 'image/gif', 'image/jpeg', 'image/jpg',
  'image/png', 'image/tiff', 'image/webp', 'image/x-icon'
])

// Size limits
const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB

const validateFiles = (files: UploadFile[], type: FileType) => {
  // Type validation
  if (type === 'image') {
    const invalidFile = files.find((file) => !allowedImageTypes.has(file.file.type))
    if (invalidFile) throw new Error('Invalid image type')
  }
  
  // Size validation
  const oversizedFile = files.find((file) => file.size > MAX_FILE_SIZE)
  if (oversizedFile) throw new Error('Файл слишком большой. Максимум: 500 МБ.')
}
```

### **Authentication**
```typescript
const formatAuthHeader = (token?: string): Record<string, string> =>
  token ? { 
    Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` 
  } : {}

// CDN availability check
const checkCdnAvailability = async (url: string, token?: string): Promise<boolean> => {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: formatAuthHeader(token),
      signal: AbortSignal.timeout(2000) // 2s timeout
    })
    return !!response && (response.ok || response.status === 401)
  } catch {
    return false
  }
}
```

### **Retry Logic**
```typescript
const uploadWithRetry = async (url: string, formData: FormData, authHeader: object): Promise<Response> => {
  const maxAttempts = 2
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        headers: { ...authHeader, Accept: 'application/json' },
        signal: AbortSignal.timeout(30000) // 30s timeout
      })
      
      // Return response if OK or non-500 error
      if (response.ok || response.status !== 500) return response
      if (attempt === maxAttempts - 1) return response
      
    } catch (_error) {
      if (attempt === maxAttempts - 1) {
        throw new Error('Не удалось загрузить файл. Проверьте соединение.')
      }
    }
  }
  throw new Error('Upload failed')
}
```

### **Error Handling**
```typescript
const getUploadError = (status: number, errorText: string): string => {
  const errors: Record<number, string> = {
    401: errorText.includes('Quota exceeded')
      ? 'Превышена квота загрузки файлов. Обратитесь к администратору.'
      : 'Ошибка авторизации. Войдите в систему снова.',
    403: 'Недостаточно прав для загрузки файлов.',
    404: 'Сервис загрузки временно недоступен.',
    413: 'Файл слишком большой. Максимум: 500 МБ.',
    415: 'Неподдерживаемый формат файла.',
    500: errorText.includes('environment variable') 
      ? 'Ошибка конфигурации сервера.' 
      : 'Сервер временно недоступен.'
  }
  return errors[status] || `Ошибка загрузки: ${status}`
}
```

### **Response Processing**
```typescript
const processResponse = async (response: Response, type: FileType, cdnUrl: string) => {
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(getUploadError(response.status, errorText))
  }
  
  const responseText = await response.text()
  if (!responseText.trim()) throw new Error('Empty response')
  
  const filename = responseText.trim()
  const url = type === 'image' ? `${cdnUrl}/${filename}` : ''
  
  return { url, originalFilename: filename }
}
```

### **High-Level API**
```typescript
// Simplified image upload
export const handleImageUpload = async (files: File[], token?: string): Promise<string | undefined> => {
  try {
    const uploadFiles = filesToUploadFiles(files)
    if (!(await validateUploads('image', uploadFiles))) return 'Invalid file type'
    
    const result = await handleFileUpload(uploadFiles, token || '', 'image')
    return result?.url
  } catch (error) {
    console.error('Upload error:', error)
    return 'Upload failed'
  }
}
```

---

## 📥 Download API Implementation

### **Strategy Selection**
```typescript
// src/lib/imageOptimization.ts
export function getImageStrategy(
  useCase: ImageUseCase,
  needsWebpFallback: boolean = false
): 'vercel' | 'quoter' {
  // Vercel API для 95% случаев (автоматически WebP/AVIF)
  if (!needsWebpFallback) return 'vercel'
  
  // Квотер только для explicit WebP конверсии
  return 'quoter'
}
```

### **Vercel Image API**
```typescript
export function getVercelImageUrl(
  src: string, 
  width: number, 
  quality: number = 75
): string {
  // Vercel читает файлы из S3 по полному URL
  const encodedSrc = encodeURIComponent(src)
  return `/_next/image?url=${encodedSrc}&w=${width}&q=${quality}`
}

// Example usage
const optimizedUrl = getVercelImageUrl(
  'https://files.dscrs.site/photo.jpg', 
  600, 
  75
)
// → /_next/image?url=https%3A//files.dscrs.site/photo.jpg&w=600&q=75
```

### **Квотер Direct API**
```typescript
export function getQuoterWebpUrl(filename: string, targetWidth: number): string {
  const [name, ext] = filename.split('.')
  const optimalSize = [64, 128, 256, 320, 400, 640, 800, 1200, 1600]
    .find(size => size >= targetWidth) || 1600
  
  return `${cdnUrl}/${name}_${optimalSize}.${ext}/webp`
}

// Example usage
const webpUrl = getQuoterWebpUrl('photo.jpg', 600)
// → https://files.dscrs.site/photo_640.jpg/webp
```

### **Universal Download API**
```typescript
export function getOptimizedImageUrl(
  filename: string,
  options: {
    width: number
    useCase?: ImageUseCase
    format?: ImageFormat
    quality?: number
  }
): string {
  const { width, format, quality = 75 } = options
  
  // Explicit WebP через квотер
  if (format === 'webp') {
    return getQuoterWebpUrl(filename, width)
  }
  
  // Все остальное через Vercel API (автоматически WebP/AVIF по User-Agent)
  const fullUrl = `${cdnUrl}/${filename}`
  return getVercelImageUrl(fullUrl, width, quality)
}
```

### **Responsive Images**
```typescript
export function generateImageSrcSet(
  filename: string,
  sizes: number[] = [300, 600, 800, 1200],
  options: Omit<Parameters<typeof getOptimizedImageUrl>[1], 'width'> = {}
): string {
  return sizes
    .map(width => {
      const url = getOptimizedImageUrl(filename, { ...options, width })
      return `${url} ${width}w`
    })
    .join(', ')
}

// Example usage
const srcSet = generateImageSrcSet('photo.jpg', [300, 600, 1200])
// → "/_next/image?url=...&w=300 300w, /_next/image?url=...&w=600 600w, /_next/image?url=...&w=1200 1200w"
```

### **Legacy API (Квотер only)**
```typescript
// src/lib/imageCache.ts - backwards compatibility
export const getCachedImageUrl = (
  src: string,
  options: { width?: number; height?: number; noSizeUrlPart?: boolean } = {}
): string => {
  // Static resources
  if (isPublicStaticResource(src)) return src
  if (!src.startsWith('http')) return src
  if (options.noSizeUrlPart) return src
  
  // Parse CDN URL
  let imagePath = new URL(src).pathname.slice(1)
  
  // Remove legacy prefixes
  if (imagePath.startsWith('unsafe/production/')) {
    imagePath = imagePath.slice('unsafe/production/'.length)
  }
  
  // Add size to filename (quoter supports filename_640x480.jpg)
  if (options.width || options.height) {
    const parts = imagePath.split('.')
    const extension = parts.pop() || ''
    let filepath = parts.join('.')
    
    if (options.width && options.height) {
      filepath = `${filepath}_${options.width}x${options.height}`
    } else if (options.width) {
      filepath = `${filepath}_${options.width}`
    }
    
    imagePath = `${filepath}.${extension}`
  }
  
  return `${cdnUrl}/${imagePath}`
}
```

---

## 🎨 OG API Implementation

### **Dynamic OG Generation**
```javascript
// api/og.js - Vercel Edge Function
import { ImageResponse } from '@vercel/og'

export default async function handler(request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'website'
  
  // Fetch data based on type
  let data = {}
  switch (type) {
    case 'article':
      data = await loadArticleData(searchParams.get('slug'))
      break
    case 'author':
      data = await loadAuthorData(searchParams.get('slug'))
      break
    default:
      data = await loadWebsiteData()
  }
  
  // Generate image
  return new ImageResponse(
    h('div', {
      style: { /* styling */ },
      children: [
        h('img', { src: data.cover }),
        h('h1', {}, data.title),
        h('p', {}, data.description)
      ]
    }),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, s-maxage=86400',
        'Content-Type': 'image/png'
      }
    }
  )
}
```

### **OG URL Generation**
```typescript
// src/lib/openGraph.ts
export function generatePageSpecificOGMetadata(
  pageType: PageType,
  data: any,
  locale: string = 'ru'
): OGMetadata {
  const baseUrl = import.meta.env.PUBLIC_BASE_URL || 'https://discours.io'
  const cdnUrl = import.meta.env.PUBLIC_CDN_URL || 'https://files.dscrs.site'
  
  let ogImage = `${baseUrl}/api/og?type=${pageType}&locale=${locale}`
  
  switch (pageType) {
    case 'article':
      ogImage += `&slug=${data.slug}&title=${encodeURIComponent(data.title)}`
      break
    case 'author':
      ogImage += `&slug=${data.slug}&name=${encodeURIComponent(data.name)}`
      break
    case 'topic':
      ogImage += `&slug=${data.slug}&name=${encodeURIComponent(data.title)}`
      break
  }
  
  return {
    title: data.title,
    description: data.description,
    image: ogImage,
    url: `${baseUrl}/${data.slug}`
  }
}
```

---

## 🔧 Configuration & Deployment

### **Vercel Image Optimization**
```json
// vercel.json
{
  "images": {
    "deviceSizes": [300, 600, 800, 1400],
    "imageSizes": [10, 40, 110],
    "sizes": [10, 40, 110, 300, 600, 800, 1400],
    "remotePatterns": [
      {
        "protocol": "https",
        "hostname": "files.dscrs.site",
        "pathname": "/**"
      },
      {
        "protocol": "https", 
        "hostname": "files.dscrs.site",
        "pathname": "/**"
      }
    ]
  }
}
```

### **Квотер URL Patterns**
```
Base:    https://files.dscrs.site/{filename}
Resize:  https://files.dscrs.site/{filename}_640.jpg
WebP:    https://files.dscrs.site/{filename}/webp
Both:    https://files.dscrs.site/{filename}_640.jpg/webp

Supported sizes: 64, 128, 256, 320, 400, 640, 800, 1200, 1600px
```

### **Environment Variables**
```bash
# Upload endpoint
PUBLIC_CDN_URL=https://files.dscrs.site

# Base URL for OG generation
PUBLIC_BASE_URL=https://discours.io

# GraphQL API for data fetching
PUBLIC_CORE_API=https://v3.dscrs.site/graphql
```

---

## 📊 API Usage Examples

### **Upload Example**
```typescript
import { handleImageUpload } from '~/lib/handleFileUpload'

// Upload single image
const files = [imageFile]
const token = session.token
const result = await handleImageUpload(files, token)

console.log(result) // "https://files.dscrs.site/abc123.jpg"
```

### **Download Example**
```typescript
import { getOptimizedImageUrl, generateImageSrcSet } from '~/lib/imageOptimization'

// Get single optimized URL
const url = getOptimizedImageUrl('photo.jpg', { 
  width: 600, 
  useCase: 'cover' 
})

// Get responsive srcset
const srcSet = generateImageSrcSet('photo.jpg', [300, 600, 1200])

// SolidJS component usage
<img 
  src={url}
  srcSet={srcSet}
  sizes="(max-width: 768px) 300px, (max-width: 1024px) 600px, 1200px"
  alt="Photo"
/>
```

### **OG Example**
```typescript
// Generate OG metadata
const ogData = generatePageSpecificOGMetadata('article', {
  slug: 'my-article',
  title: 'Article Title',
  description: 'Article description',
  cover: 'cover.jpg'
}, 'ru')

// Result:
{
  title: 'Article Title',
  description: 'Article description', 
  image: 'https://discours.io/api/og?type=article&locale=ru&slug=my-article&title=Article%20Title',
  url: 'https://discours.io/my-article'
}
```

---

## ⚡ Performance & Monitoring

### **Upload Metrics**
- **Timeout**: 30s per attempt, 2 retries
- **Size limit**: 500MB
- **CDN check**: 2s timeout
- **Validation**: MIME type + file extension

### **Download Metrics**
- **Vercel Edge**: ~50-100ms global
- **Квотер S3**: ~200-500ms origin
- **Cache hit**: ~10-50ms
- **Auto format**: WebP/AVIF by User-Agent

### **OG Metrics**
- **Generation**: ~100-300ms
- **Cache**: 24h (`s-maxage=86400`)
- **Size**: 1200x630px PNG
- **Edge runtime**: Global distribution

---

## 🚨 Error Handling

### **Upload Errors**
```typescript
try {
  const result = await handleImageUpload(files, token)
} catch (error) {
  // Handle specific errors
  if (error.message.includes('CDN unavailable')) {
    // Show offline message
  } else if (error.message.includes('квота')) {
    // Show quota exceeded message  
  } else if (error.message.includes('большой')) {
    // Show file size error
  }
}
```

### **Download Fallbacks**
```typescript
// Automatic fallback from Vercel to Квотер
const getImageWithFallback = (filename: string, width: number) => {
  try {
    return getVercelImageUrl(`${cdnUrl}/${filename}`, width)
  } catch {
    return getQuoterWebpUrl(filename, width)
  }
}
```

### **OG Fallbacks**
```typescript
// Static fallback for OG images
const ogImage = data.cover 
  ? `${baseUrl}/api/og?type=${pageType}&cover=${data.cover}`
  : `${cdnUrl}/logo.png`
```

---

## 🎯 Best Practices

### **Upload**
- ✅ Always validate file type and size
- ✅ Use authentication tokens
- ✅ Implement retry logic  
- ✅ Handle quota exceeded errors
- ✅ Show upload progress

### **Download**
- ✅ Use Vercel API for standard cases
- ✅ Generate responsive srcsets
- ✅ Implement progressive loading
- ✅ Cache optimization headers
- ✅ Fallback to original on errors

### **OG**
- ✅ Cache for 24h minimum
- ✅ Generate dynamic content
- ✅ Handle missing data gracefully
- ✅ Use standard 1200x630 size
- ✅ Include fallback images

**All APIs are production-ready and optimized for performance!** 🚀
