import { ImageResponse } from '@vercel/og'
import { APIEvent } from '@solidjs/start/server'

/**
 * Dynamic OG image generation for articles
 * Usage: /api/og/article?title=Title&author=Author&topic=Topic&cover=cover-url
 */
export async function GET(event: APIEvent) {
  try {
    const url = new URL(event.request.url)
    const title = url.searchParams.get('title') || 'Discours Article'
    const author = url.searchParams.get('author')
    const cover = url.searchParams.get('cover')
    const topic = url.searchParams.get('topic')

    // Debug logging
    console.log('OG Image params:', { title, author, cover, topic })

    // Ensure we have content to display
    const displayTitle = title && title !== 'Discours Article' ? title : 'Untitled Article'

    // Build the image element structure
    const imageElement = {
      type: 'div',
      props: {
        style: {
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: cover ? 
            `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${cover})` :
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        },
        children: [
          // Content container
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '60px',
                textAlign: 'center',
                width: '100%',
                height: '100%',
                backgroundColor: cover ? 'rgba(0,0,0,0.3)' : 'transparent',
              },
              children: [
                // Title
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: title && title.length > 50 ? 48 : 64,
                      fontWeight: 'bold',
                      color: 'white',
                      lineHeight: 1.2,
                      marginBottom: 30,
                      textAlign: 'center',
                      maxWidth: '900px',
                      textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                    },
                    children: displayTitle
                  }
                },
                // Author
                author ? {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 24,
                      color: 'rgba(255,255,255,0.9)',
                      lineHeight: 1.4,
                      marginBottom: 20,
                      textAlign: 'center',
                      textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                    },
                    children: `by ${author}`
                  }
                } : null,
                // Topic badge
                topic ? {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 20,
                      color: 'white',
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      padding: '8px 16px',
                      borderRadius: '20px',
                      marginBottom: 20,
                    },
                    children: `#${topic}`
                  }
                } : null,
                // Author
                author ? {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 32,
                      color: 'rgba(255,255,255,0.8)',
                      marginBottom: 20,
                      textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                    },
                    children: `by ${author}`
                  }
                } : null
              ].filter(Boolean)
            }
          },
          // Brand badge
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                bottom: 40,
                right: 60,
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.9)',
                padding: '12px 24px',
                borderRadius: '25px',
                fontSize: 28,
                fontWeight: 'bold',
                color: '#333',
              },
              children: '📖 discours.io'
            }
          }
        ]
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
