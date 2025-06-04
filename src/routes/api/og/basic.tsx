import { APIEvent } from '@solidjs/start/server'
import { ImageResponse } from '@vercel/og'

/**
 * Generate basic OG images for pages without specific content
 * Simple white background with centered logo
 */
export function GET(_event: APIEvent) {
  //Debug hardcoded cdn url to cdn.discours.io
  const cdnUrl = 'https://cdn.discours.io'

  try {
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
            backgroundColor: 'white'
          },
          children: {
            type: 'img',
            props: {
              src: `${cdnUrl}/logo.png`,
              width: 200,
              height: 200,
              style: {
                width: 200,
                height: 200,
                objectFit: 'contain'
              }
            }
          }
        }
      },
      {
        width: 1200,
        height: 630
      }
    )
  } catch (error) {
    console.error('Error generating basic OG image:', error)
    return new Response('Error generating image', { status: 500 })
  }
}
