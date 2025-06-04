import { APIEvent } from '@solidjs/start/server'
import { ImageResponse } from '@vercel/og'
import { cdnUrl } from '~/config'

/**
 * Generate OG images for articles with dynamic content
 * Usage: /api/og/article?title=Title&author=Author&topic=Topic&cover=CoverURL
 */

export function GET(event: APIEvent) {
  try {
    const url = new URL(event.request.url)
    const title = url.searchParams.get('title') || 'Discours Article'
    const author = url.searchParams.get('author') || ''
    const topic = url.searchParams.get('topic') || ''
    const cover = url.searchParams.get('cover')
    // --- Elements ---

    // Top Left: Logo with Topic Badge
    const topLeft = {
      type: 'div',
      props: {
        style: {
          position: 'absolute',
          top: 40,
          left: 60,
          display: 'flex',
          alignItems: 'center'
        },
        children: [
          // Logo image
          {
            type: 'img',
            props: {
              src: `${cdnUrl}/logo.png`,
              width: 60,
              height: 60,
              style: {
                width: 60,
                height: 60,
                objectFit: 'contain',
                borderRadius: '16px'
              }
            }
          },
          // Topic badge if available
          topic
            ? {
                type: 'div',
                props: {
                  style: {
                    marginLeft: 15,
                    padding: '4px 12px',
                    background: 'rgba(255, 255, 255, 0.25)',
                    color: 'white',
                    borderRadius: 30,
                    fontSize: 24,
                    backdropFilter: 'blur(4px)',
                    textShadow: '1px 1px 2px rgba(0,0,0,0.2)'
                  },
                  children: topic
                }
              }
            : null
        ].filter(Boolean)
      }
    }

    // Center-left: Title
    const mainTitle = {
      type: 'div',
      props: {
        style: {
          position: 'absolute',
          top: '50%',
          left: 60,
          transform: 'translateY(-50%)',
          maxWidth: 900,
          textAlign: 'left',
          color: 'white',
          fontWeight: 900,
          fontSize: title.length > 50 ? 50 : 62,
          lineHeight: 1.12,
          textShadow: '2px 2px 7px rgba(0,0,0,0.55)',
          letterSpacing: '-1px'
          // add any custom font here if you use one
        },
        children: title
      }
    }

    // Bottom left: Author
    const bottomLeft = author
      ? {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              left: 60,
              bottom: 44,
              fontSize: 32,
              color: 'rgba(255,255,255,0.88)',
              fontWeight: 300,
              letterSpacing: 0.5,
              textShadow: '1px 1px 2px rgba(0,0,0,0.34)'
            },
            children: author.length > 120 ? `${author.substring(0, 120)}...` : author
          }
        }
      : null

    // --- Image background ---
    const backgroundStyle = cover
      ? {
          background: `linear-gradient(rgba(0,0,0,0.50), rgba(0,0,0,0.65)), url(${cover})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }
      : {
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }

    // --- Main OG Image Structure ---
    const imageElement = {
      type: 'div',
      props: {
        style: {
          position: 'relative',
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          ...backgroundStyle
        },
        children: [topLeft, mainTitle, bottomLeft].filter(Boolean)
      }
    }

    return new ImageResponse(imageElement, {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    })
  } catch (error) {
    console.error('Error generating article OG image:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(`Failed to generate the image: ${errorMessage}`, {
      status: 500
    })
  }
}
