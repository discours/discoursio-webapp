import { ImageResponse } from '@vercel/og'
import { APIEvent } from '@solidjs/start/server'
import { cdnUrl } from '~/config'

/**
 * Dynamic OG image generation for authors
 * Usage: /api/og/author?slug=author-slug
 * or: /api/og/author?name=Name&bio=Bio&avatar=avatar-url
 */
export async function GET(event: APIEvent) {
  try {
    const url = new URL(event.request.url)
    const name = url.searchParams.get('name') || 'Author'
    const bio = url.searchParams.get('bio')
    const avatar = url.searchParams.get('avatar')

    //Debug hardcoded cdn url to cdn.discours.io
    const cdnUrl = 'https://cdn.discours.io'


    // If slug is provided, we could fetch author data from GraphQL here
    // For now, we'll use the provided parameters

    // --- Elements ---

    // Top left: Logo
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
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '16px',
                marginRight: 0,
              }
            }
          },
        ]
      }
    }

    // Center-left: Author name as title
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
          fontSize: name.length > 20 ? 50 : 62,
          lineHeight: 1.12,
          textShadow: '2px 2px 7px rgba(0,0,0,0.55)',
          letterSpacing: '-1px',
        },
        children: name,
      }
    }

    // Bottom left: Bio
    const bottomLeft = bio ? {
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
          lineHeight: 1.3,
        },
        children: bio.length > 120 ? bio.substring(0, 120) + '...' : bio
      }
    } : null

    // --- Background with avatar if available ---
    const backgroundStyle = avatar
      ? {
          background: `linear-gradient(rgba(0,0,0,0.50), rgba(0,0,0,0.65)), url(${avatar})`,
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
