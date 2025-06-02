import { APIEvent } from '@solidjs/start/server'
import { ImageResponse } from '@vercel/og'

/**
 * Generate OG images for topics with dynamic content
 * Usage: /api/og/topic?title=Title&description=Description&cover=CoverURL
 */

export function GET(event: APIEvent) {
  try {
    const url = new URL(event.request.url)
    const title = url.searchParams.get('title') || 'Discours Topic'
    const description = url.searchParams.get('description') || 'Join the conversation'
    const cover = url.searchParams.get('cover')

    // Debug hardcoded cdn url to cdn.discours.io
    const cdnUrl = 'https://cdn.discours.io'

    // --- Elements ---

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
          }
        ]
      }
    }

    // Center: Title
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
          color: cover ? 'white' : '#1f2937',
          fontWeight: 900,
          fontSize: title.length > 50 ? 50 : 62,
          lineHeight: 1.12,
          textShadow: cover ? '2px 2px 7px rgba(0,0,0,0.55)' : 'none',
          letterSpacing: '-1px'
        },
        children: title
      }
    }

    // Bottom left: Description
    const bottomLeft = description
      ? {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              left: 60,
              bottom: 44,
              fontSize: 32,
              color: cover ? 'rgba(255,255,255,0.88)' : 'rgba(31,41,55,0.7)',
              fontWeight: 300,
              letterSpacing: 0.5,
              textShadow: cover ? '1px 1px 2px rgba(0,0,0,0.34)' : 'none',
              maxWidth: 900
            },
            children: description
          }
        }
      : null

    // --- Background ---
    const backgroundStyle = cover
      ? {
          background: `linear-gradient(rgba(0,0,0,0.50), rgba(0,0,0,0.65)), url(${cover})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }
      : {
          background: 'white'
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
    console.error('Error generating topic OG image:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(`Failed to generate the image: ${errorMessage}`, {
      status: 500
    })
  }
}
