import { Show } from 'solid-js'

export const CharsCounter = (props: { body: string; limit: number }) => {
  return (
    <Show when={props.limit}>
      <div>
        <small>
          {props.body?.length} / {props.limit || '∞'}
        </small>
      </div>
    </Show>
  )
}
