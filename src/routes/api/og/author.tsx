import { APIEvent } from '@solidjs/start/server'
import { ImageResponse } from '@vercel/og'
import { cdnUrl } from '~/config'

/**
 * Generate OG images for author profiles with dynamic content
 * Usage: /api/og/author?name=AuthorName&bio=AuthorBio&avatar=AvatarURL
 */

export function GET(event: APIEvent) {
  try {
    const url = new URL(event.request.url)
    const name = url.searchParams.get('name') || 'Author Profile'
    const bio = url.searchParams.get('bio') || ''
    const avatar = url.searchParams.get('avatar')
    const articlesCount = url.searchParams.get('articlesCount')
    const followersCount = url.searchParams.get('followersCount')

    // --- Elements ---

    // Top Left: Logo
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

    // Top Right: Stats
    const topRight =
      articlesCount || followersCount
        ? {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                top: 40,
                right: 60,
                display: 'flex',
                gap: 20,
                color: 'rgba(255,255,255,0.8)'
              },
              children: [
                articlesCount
                  ? {
                      type: 'div',
                      props: {
                        style: { fontSize: 24 },
                        children: `${articlesCount} статей`
                      }
                    }
                  : null,
                followersCount
                  ? {
                      type: 'div',
                      props: {
                        style: { fontSize: 24 },
                        children: `${followersCount} подписчиков`
                      }
                    }
                  : null
              ].filter(Boolean)
            }
          }
        : null

    // Center-left: Author Name
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
          fontSize: name.length > 30 ? 50 : 62,
          lineHeight: 1.12,
          textShadow: '2px 2px 7px rgba(0,0,0,0.55)',
          letterSpacing: '-1px'
        },
        children: name
      }
    }

    // Bottom left: Bio
    const bottomLeft = bio
      ? {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              left: 60,
              bottom: 44,
              fontSize: 28,
              color: 'rgba(255,255,255,0.88)',
              fontWeight: 300,
              letterSpacing: 0.5,
              textShadow: '1px 1px 2px rgba(0,0,0,0.34)',
              maxWidth: 800,
              lineHeight: 1.3
            },
            children: bio.length > 120 ? `${bio.substring(0, 120)}...` : bio
          }
        }
      : null

    // --- Background with avatar if available ---
    const backgroundStyle = avatar
      ? {
          background: `linear-gradient(rgba(0,0,0,0.50), rgba(0,0,0,0.65)), url(${avatar})`,
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
        children: [topLeft, topRight, mainTitle, bottomLeft].filter(Boolean)
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
    console.error('OG Image generation error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(`Failed to generate the image: ${errorMessage}`, {
      status: 500
    })
  }
}
