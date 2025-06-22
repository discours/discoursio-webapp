import { CoverImage1 } from './images/CoverImage1'
import { CoverImage2 } from './images/CoverImage2'
import { CoverImage3 } from './images/CoverImage3'
import { CoverImage4 } from './images/CoverImage4'
import { CoverImage5 } from './images/CoverImage5'
import { CoverImage6 } from './images/CoverImage6'
import { CoverImage7 } from './images/CoverImage7'
import { CoverImage8 } from './images/CoverImage8'
import { CoverImage9 } from './images/CoverImage9'
import { CoverImage10 } from './images/CoverImage10'
import { CoverImage11 } from './images/CoverImage11'
import { CoverImage12 } from './images/CoverImage12'
import type { CoverImageProps } from './types'

// not pretty, but I don't want to use dynamic imports
const coverImages = [
  CoverImage1,
  CoverImage2,
  CoverImage3,
  CoverImage4,
  CoverImage5,
  CoverImage6,
  CoverImage7,
  CoverImage8,
  CoverImage9,
  CoverImage10,
  CoverImage11,
  CoverImage12
]

let counter = 0
export const CoverImage = (props: CoverImageProps) => {
  const CoverImageComponent = coverImages[counter]
  counter++
  if (counter === coverImages.length) {
    counter = 0
  }
  return <CoverImageComponent {...props} />
}
