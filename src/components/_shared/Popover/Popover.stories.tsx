import type { Meta, StoryObj } from 'storybook-solidjs'
import { Popover } from './Popover'

const meta: Meta<typeof Popover> = {
  title: 'atoms/Popover',
  component: Popover,
  tags: ['autodocs']
}

export default meta

type Story = StoryObj<typeof Popover>

export const Default: Story = {
  render: () => (
    <Popover content="Это содержимое всплывающей подсказки">
      {(setTooltipEl) => <button ref={setTooltipEl}>Наведите курсор</button>}
    </Popover>
  )
}

export const WithJSXContent: Story = {
  render: () => (
    <Popover
      content={
        <div>
          <h3>Заголовок подсказки</h3>
          <p>Это более сложное содержимое подсказки</p>
        </div>
      }
    >
      {(setTooltipEl) => <button ref={setTooltipEl}>Наведите курсор для JSX контента</button>}
    </Popover>
  )
}

export const Disabled: Story = {
  render: () => (
    <Popover content="Эта подсказка не появится" disabled={true}>
      {(setTooltipEl) => <button ref={setTooltipEl}>Подсказка отключена</button>}
    </Popover>
  )
}
