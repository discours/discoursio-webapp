import { APIEvent } from '@solidjs/start/server'
import { ImageResponse } from '@vercel/og'
import { cdnUrl } from '~/config'
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '~/lib/openGraph'

/**
 * Generate basic OG images for pages without specific content
 * Simple white background with centered logo
 */
export function GET(_event: APIEvent) {
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
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        headers: {
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      }
    )
  } catch (error) {
    console.error('Error generating basic OG image:', error)
    return new Response('Error generating image', { status: 500 })
  }
}
