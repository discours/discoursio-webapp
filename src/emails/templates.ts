import EmailConfirmation from './EmailConfirmation'
import FirstPublication from './FirstPublication'
import NewComment from './NewComment'
import PasswordReset from './PasswordReset'

const TEMPLATE_MAPPING = {
  'email_confirmation': 'authorizer_email_confirmation',
  'password_reset': 'authorizer_password_reset',
  'first_publication': 'email_first_publication',
  'new_comment': 'new_comment_notification'
} as const

export const EMAIL_TEMPLATES = {
  [TEMPLATE_MAPPING.email_confirmation]: EmailConfirmation,
  [TEMPLATE_MAPPING.password_reset]: PasswordReset,
  [TEMPLATE_MAPPING.first_publication]: FirstPublication,
  [TEMPLATE_MAPPING.new_comment]: NewComment
} as const

export type TemplateKey = keyof typeof EMAIL_TEMPLATES

export const getMailgunTemplate = (path: string | undefined): TemplateKey | undefined => {
  if (!path) return undefined
  return TEMPLATE_MAPPING[path as keyof typeof TEMPLATE_MAPPING]
}
