import type { Shout } from '~/graphql/schema/core.gen'

import { ArticleCard } from '../../Feed/ArticleCard'

interface SearchCardProps {
  settings?: {
    noicon?: boolean
    noimage?: boolean
    nosubtitle?: boolean
    noauthor?: boolean
    nodate?: boolean
    isGroup?: boolean
    photoBottom?: boolean
    additionalClass?: string
    isFeedMode?: boolean
    isFloorImportant?: boolean
    isWithCover?: boolean
    isBigTitle?: boolean
    isVertical?: boolean
    isShort?: boolean
    withBorder?: boolean
    isCompact?: boolean
    isSingle?: boolean
    isBeside?: boolean
    withViewed?: boolean
    noAuthorLink?: boolean
  }
  article: Shout
}

export const ShoutsResultItem = (props: SearchCardProps) => {
  return <ArticleCard article={props.article} settings={props.settings} />
}
