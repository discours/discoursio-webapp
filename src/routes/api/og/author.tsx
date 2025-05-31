import { ImageResponse } from '@vercel/og'
import { APIEvent } from '@solidjs/start/server'

/**
 * Dynamic OG image generation for authors
 * Usage: /api/og/author?slug=author-slug
 * or: /api/og/author?name=Name&bio=Bio&avatar=avatar-url
 */
export async function GET(event: APIEvent) {
  try {
    const url = new URL(event.request.url)
    const slug = url.searchParams.get('slug')
    const name = url.searchParams.get('name') || 'Author'
    const bio = url.searchParams.get('bio')
    const avatar = url.searchParams.get('avatar')
    const articlesCount = url.searchParams.get('articlesCount')
    const followersCount = url.searchParams.get('followersCount')

    // If slug is provided, we could fetch author data from GraphQL here
    // For now, we'll use the provided parameters

    const imageElement = {
      type: 'div',
      props: {
        style: {
          height: '100%',
          width: '100%',
          display: 'flex',
          backgroundColor: '#1a1a2e',
          background: 'radial-gradient(circle at 30% 20%, #16213e 0%, #0f3460 100%)',
        },
        children: [
          // Left side - Author info
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                width: '60%',
                padding: '60px',
                color: 'white',
              },
              children: [
                // Avatar
                avatar ? {
                  type: 'img',
                  props: {
                    src: avatar,
                    style: {
                      width: '120px',
                      height: '120px',
                      borderRadius: '60px',
                      marginBottom: '30px',
                      border: '4px solid rgba(255,255,255,0.3)',
                    }
                  }
                } : {
                  type: 'div',
                  props: {
                    style: {
                      width: '120px',
                      height: '120px',
                      borderRadius: '60px',
                      marginBottom: '30px',
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '48px',
                    },
                    children: '👤'
                  }
                },
                // Name
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 56,
                      fontWeight: 'bold',
                      marginBottom: '20px',
                      textAlign: 'center',
                    },
                    children: name
                  }
                },
                // Bio
                bio ? {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 24,
                      opacity: 0.8,
                      lineHeight: 1.4,
                      textAlign: 'center',
                      marginBottom: '30px',
                      maxWidth: '400px',
                    },
                    children: bio.length > 100 ? bio.substring(0, 100) + '...' : bio
                  }
                } : null,
                // Stats
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      gap: '40px',
                      marginTop: '20px',
                    },
                    children: [
                      articlesCount ? {
                        type: 'div',
                        props: {
                          style: { textAlign: 'center' },
                          children: [
                            {
                              type: 'div',
                              props: {
                                style: { fontSize: '32px', fontWeight: 'bold' },
                                children: articlesCount
                              }
                            },
                            {
                              type: 'div',
                              props: {
                                style: { fontSize: '18px', opacity: 0.7 },
                                children: 'Articles'
                              }
                            }
                          ]
                        }
                      } : null,
                      followersCount ? {
                        type: 'div',
                        props: {
                          style: { textAlign: 'center' },
                          children: [
                            {
                              type: 'div',
                              props: {
                                style: { fontSize: '32px', fontWeight: 'bold' },
                                children: followersCount
                              }
                            },
                            {
                              type: 'div',
                              props: {
                                style: { fontSize: '18px', opacity: 0.7 },
                                children: 'Followers'
                              }
                            }
                          ]
                        }
                      } : null
                    ].filter(Boolean)
                  }
                }
              ].filter(Boolean)
            }
          },
          // Right side - Decorative
          {
            type: 'div',
            props: {
              style: {
                width: '40%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '60px',
                background: 'linear-gradient(45deg, rgba(102,126,234,0.3), rgba(118,75,162,0.3))',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: '80px',
                      marginBottom: '20px',
                    },
                    children: '✍️'
                  }
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 32,
                      color: 'white',
                      textAlign: 'center',
                      opacity: 0.9,
                    },
                    children: 'Author Profile'
                  }
                }
              ]
            }
          },
          // Brand
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                bottom: 40,
                right: 60,
                fontSize: 24,
                color: 'rgba(255,255,255,0.6)',
              },
              children: 'discours.io'
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
