import { createSignal, JSX } from 'solid-js'
import './Tooltip.scss'

interface TooltipProps {
  children?: JSX.Element
  link?: string
}

export const Tooltip = (props: TooltipProps) => {
  const [isShown, setShowed] = createSignal(false)
  const show = () => setShowed(true)
  return (
    <span>
      <a href={props.link || '#'} class="tooltip" onClick={show}>
        &zwnj;
      </a>
      <div class="tooltip-content" classList={{ hidden: !isShown() }}>
        {props.children}
      </div>
    </span>
  )
}

export default Tooltip
