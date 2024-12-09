import { Component } from 'solid-js'
import { EmailProps } from './types'

const PasswordReset: Component<EmailProps> = (props) => {
  return (
    <div style={{ padding: '20px' }}>
      <h2>Сброс пароля</h2>
      <p>Для сброса пароля перейдите по ссылке:</p>
      <a href={props.link}>{props.link}</a>
    </div>
  )
}

export default PasswordReset
