import { Component } from 'solid-js'
import { EmailProps } from './types'

const NewComment: Component<EmailProps> = (props) => {
  return (
    <div style={{ padding: '20px' }}>
      <h2>Новый комментарий</h2>
      <p>К вашей статье "{props.title}" добавлен новый комментарий:</p>
      <div style={{ padding: '10px', background: '#f5f5f5' }}>{props.content}</div>
      <a href={props.link}>Перейти к комментарию</a>
    </div>
  )
}

export default NewComment
