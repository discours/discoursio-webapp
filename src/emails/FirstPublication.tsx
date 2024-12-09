import { Component } from 'solid-js'
import { EmailProps } from './types'

const FirstPublication: Component<EmailProps> = (props) => {
  return (
    <div style={{ padding: '20px' }}>
      <h2>Первая публикация</h2>
      <p>Поздравляем с первой публикацией на Дискурсе!</p>
      <h3>{props.title}</h3>
      <a href={props.link}>Читать статью</a>
    </div>
  )
}

export default FirstPublication
