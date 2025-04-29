import type { Author } from '~/graphql/schema/core.gen'
import { AuthorBadge } from '../Author/AuthorBadge'

interface AuthorSearchItemProps {
  author: Author
}

export const AuthorSearchItem = (props: AuthorSearchItemProps) => {
  return (
    <div style={{ "margin-bottom": "20px" }}>
      <AuthorBadge 
        author={props.author} 
        showMessageButton={false} 
      />
    </div>
  )
}
