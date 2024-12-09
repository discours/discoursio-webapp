import { Component } from 'solid-js'
import { EmailProps } from './types'

const EmailConfirmation: Component<EmailProps> = (props) => {
  return (
    <div style={{ padding: '20px' }}>
      <h2>Подтверждение email</h2>
      <p>Для подтверждения email перейдите по ссылке:</p>
      <a href={props.link}>{props.link}</a>
    </div>
  )
}

export default EmailConfirmation
