import { A, useLocation } from '@solidjs/router'
import { clsx } from 'clsx'
import { ConditionalWrapper } from '../_shared/ConditionalWrapper'
import styles from './Header.module.scss'

type Props = {
  onMouseOver: (event?: MouseEvent, time?: number) => void
  onMouseOut: (event?: MouseEvent, time?: number) => void
  href?: string
  body: string
  active?: boolean
  onClick?: (event: MouseEvent) => void
}

export const Link = (props: Props) => {
  const loc = useLocation()
  return (
    <li onClick={props.onClick} classList={{ 'view-switcher__item--selected': props.href === `/${loc.pathname}` }}>
      <ConditionalWrapper
        condition={props.href !== `/${loc.pathname}`}
        wrapper={(children) => <A href={props.href || '/'}>{children}</A>}
      >
        <span
          class={clsx('cursorPointer linkReplacement', { [styles.mainNavigationItemActive]: props.active })}
          onMouseOver={props.onMouseOver}
          onMouseOut={props.onMouseOut}
        >
          {props.body}
        </span>
      </ConditionalWrapper>
    </li>
  )
}
