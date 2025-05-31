import { ImageResponse } from '@vercel/og';
import { APIEvent } from '@solidjs/start/server';

export async function GET(event: APIEvent) {
  try {
    const url = new URL(event.request.url);
    const title = url.searchParams.get('title') || 'Topic Discussion';
    const description = url.searchParams.get('description') || 'Join the conversation about this topic';
    const participantCount = url.searchParams.get('participants') || '0';
    const articleCount = url.searchParams.get('articles') || '0';
    const cover = url.searchParams.get('cover');

    return new ImageResponse(
      {
        type: 'div',
        props: {
          style: {
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0f172a',
            backgroundImage: 'linear-gradient(45deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
            position: 'relative',
          },
          children: [
            // Background pattern
            {
              type: 'div',
              props: {
                style: {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  opacity: 0.1,
                  backgroundImage: 'radial-gradient(circle at 25% 25%, #ffffff 2px, transparent 2px), radial-gradient(circle at 75% 75%, #ffffff 2px, transparent 2px)',
                  backgroundSize: '50px 50px',
                },
              },
            },
            
            // Logo/Brand area
            {
              type: 'div',
              props: {
                style: {
                  position: 'absolute',
                  top: '40px',
                  left: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                },
                children: [
                  {
                    type: 'div',
                    props: {
                      style: {
                        width: '40px',
                        height: '40px',
                        backgroundColor: '#3b82f6',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px',
                        fontWeight: 'bold',
                        color: 'white',
                      },
                      children: 'D',
                    },
                  },
                  {
                    type: 'div',
                    props: {
                      style: {
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: 'white',
                      },
                      children: 'Discoursio',
                    },
                  },
                ],
              },
            },

            // Topic badge
            {
              type: 'div',
              props: {
                style: {
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  padding: '8px 20px',
                  borderRadius: '20px',
                  fontSize: '16px',
                  fontWeight: '600',
                  marginBottom: '24px',
                },
                children: 'TOPIC',
              },
            },

            // Main content
            {
              type: 'div',
              props: {
                style: {
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  maxWidth: '800px',
                  padding: '0 40px',
                },
                children: [
                  {
                    type: 'h1',
                    props: {
                      style: {
                        fontSize: '64px',
                        fontWeight: 'bold',
                        color: 'white',
                        margin: '0 0 24px 0',
                        lineHeight: '1.1',
                        textAlign: 'center',
                      },
                      children: title,
                    },
                  },
                  {
                    type: 'p',
                    props: {
                      style: {
                        fontSize: '24px',
                        color: '#94a3b8',
                        margin: '0 0 32px 0',
                        lineHeight: '1.4',
                        textAlign: 'center',
                      },
                      children: description,
                    },
                  },
                ],
              },
            },

            // Stats section
            {
              type: 'div',
              props: {
                style: {
                  display: 'flex',
                  gap: '40px',
                  marginTop: '40px',
                },
                children: [
                  {
                    type: 'div',
                    props: {
                      style: {
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: '20px',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '12px',
                        backdropFilter: 'blur(10px)',
                      },
                      children: [
                        {
                          type: 'div',
                          props: {
                            style: {
                              fontSize: '32px',
                              fontWeight: 'bold',
                              color: '#3b82f6',
                              marginBottom: '8px',
                            },
                            children: articleCount,
                          },
                        },
                        {
                          type: 'div',
                          props: {
                            style: {
                              fontSize: '16px',
                              color: '#94a3b8',
                            },
                            children: 'Articles',
                          },
                        },
                      ],
                    },
                  },
                  {
                    type: 'div',
                    props: {
                      style: {
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: '20px',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '12px',
                        backdropFilter: 'blur(10px)',
                      },
                      children: [
                        {
                          type: 'div',
                          props: {
                            style: {
                              fontSize: '32px',
                              fontWeight: 'bold',
                              color: '#10b981',
                              marginBottom: '8px',
                            },
                            children: participantCount,
                          },
                        },
                        {
                          type: 'div',
                          props: {
                            style: {
                              fontSize: '16px',
                              color: '#94a3b8',
                            },
                            children: 'Participants',
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },

            // Cover image (if provided)
            cover ? {
              type: 'div',
              props: {
                style: {
                  position: 'absolute',
                  top: '40px',
                  right: '40px',
                  width: '120px',
                  height: '120px',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '3px solid rgba(255, 255, 255, 0.2)',
                },
                children: {
                  type: 'img',
                  props: {
                    src: cover,
                    style: {
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    },
                  },
                },
              },
            } : null,
          ].filter(Boolean),
        },
      },
      {
        width: 1200,
        height: 630,
        headers: {
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      }
    );
  } catch (error) {
    console.error('Error generating topic OG image:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}
