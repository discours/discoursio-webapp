import { APIEvent } from '@solidjs/start/server'
import { ImageResponse } from '@vercel/og'

/**
 * Generate basic OG images for pages without specific content
 * Used by PageLayout when no article data is available
 */
export async function GET(event: APIEvent) {
  try {
    const url = new URL(event.request.url)
    const title = url.searchParams.get('title') || 'Discours'
    const author = url.searchParams.get('author')
    const topic = url.searchParams.get('topic')

    // Debug logging
    console.log('Basic OG Image params:', { title, author, topic })

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
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        },
        children: [
          // Main content container
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px',
                color: 'white',
                textAlign: 'center',
                width: '100%',
                height: '100%',
              },
              children: [
                // Logo/Brand
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: '72px',
                      fontWeight: 'bold',
                      marginBottom: '20px',
                      color: 'white',
                    },
                    children: 'DISCOURS'
                  }
                },
                // Title
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: title.length > 50 ? '32px' : '40px',
                      fontWeight: '600',
                      lineHeight: '1.2',
                      marginBottom: '20px',
                      maxWidth: '800px',
                      color: 'white',
                      textAlign: 'center',
                    },
                    children: title
                  }
                },
                // Author or topic if provided
                author ? {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: '24px',
                      color: 'rgba(255, 255, 255, 0.8)',
                      marginTop: '20px',
                    },
                    children: `by ${author}`
                  }
                } : topic ? {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: '24px',
                      color: 'rgba(255, 255, 255, 0.8)',
                      marginTop: '20px',
                    },
                    children: `#${topic}`
                  }
                } : null
              ].filter(Boolean)
            }
          }
        ]
      }
    }

    return new ImageResponse(imageElement, {
      width: 1200,
      height: 630,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'cache-control': 'public, max-age=31536000, immutable'
      }
    })
  } catch (error) {
    console.error('[OG] Basic image generation error:', error)
    
    // Return a simple fallback image
    return new ImageResponse(
      {
        type: 'div',
        props: {
          style: {
            height: '100%',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#667eea',
            color: 'white',
            fontSize: '48px',
            fontWeight: 'bold',
          },
          children: 'DISCOURS'
        }
      },
      {
        width: 1200,
        height: 630,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'cache-control': 'public, max-age=31536000, immutable'
        }
      }
    )
  }
}
