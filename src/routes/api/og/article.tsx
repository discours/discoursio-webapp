import { ImageResponse } from '@vercel/og'
import { APIEvent } from '@solidjs/start/server'
import { cdnUrl } from '~/config'

/**
 * Generate OG images for articles with dynamic content
 * Usage: /api/og/article?title=Title&author=Author&cover=CoverURL&topic=Topic
 */

export function GET(event: APIEvent) {
  try {
    const url = new URL(event.request.url)
    const title = url.searchParams.get('title') || 'Discours Article'
    const author = url.searchParams.get('author')
    const cover = url.searchParams.get('cover')
    const topic = url.searchParams.get('topic')

    //Debug hardcoded cdn url to cdn.discours.io
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
          alignItems: 'center',
          gap: 10,
        },
        children: [
          // Logo image
          {
            type: 'img',
            props: {
              src: `${cdnUrl}/logo_sign.png`,
              width: 60,
              height: 60,
              style: {
                width: 60,
                height: 60,
                objectFit: 'contain',
                background: 'rgba(255,255,255,0.03)', // slight highlight if you want
                borderRadius: '16px', // round corners if you want
                marginRight: 0,
              }
            }
          },
          // Topic badge
          topic ? {
            type: 'div',
            props: {
              style: {
                fontSize: 28,
                color: 'white',
                fontWeight: 600,
                letterSpacing: 1,
                marginRight: 10,
              },
              children: topic
            }
          } : null,
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
          letterSpacing: '-1px',
          // add any custom font here if you use one
        },
        children: title,
      }
    }

    // Bottom left: Author
    const bottomLeft = author ? {
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
          textShadow: '1px 1px 2px rgba(0,0,0,0.34)',
        },
        children: author.length > 120 ? author.substring(0, 120) + '...' : author
      }
    } : null

    // --- Image background ---
    const backgroundStyle = cover
      ? {
          background: `linear-gradient(rgba(0,0,0,0.50), rgba(0,0,0,0.65)), url(${cover})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : {
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
          ...backgroundStyle,
        },
        children: [
          topLeft,
          mainTitle,
          bottomLeft,
        ].filter(Boolean)
      }
    }

    return new ImageResponse(
      imageElement as any,
      {
        width: 1200,
        height: 630,
        headers: {
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      },
    )
  } catch (e) {
    console.error('OG Image generation error:', e)
    const errorMessage = e instanceof Error ? e.message : 'Unknown error'
    return new Response(`Failed to generate the image: ${errorMessage}`, {
      status: 500,
    })
  }
}
