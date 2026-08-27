import assert from 'node:assert/strict'
import test from 'node:test'
import sharp from 'sharp'

test('sharp can render an SVG with lifecycle scripts disabled', async () => {
  const png = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'))
    .png()
    .toBuffer()

  assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG')
})
