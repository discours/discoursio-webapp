// tests/hydration-validator.ts

import type { JSX } from 'solid-js'
import { hydrate, isServer, renderToString } from 'solid-js/web'

export const validateHydration = async (renderComponent: () => JSX.Element) => {
  if (isServer) return

  // Расширенная диагностика гидрации
  const serverHTML = await renderToString(renderComponent)
  const serverContainer = document.createElement('div')
  serverContainer.innerHTML = serverHTML

  const clientContainer = document.createElement('div')
  hydrate(renderComponent, clientContainer)

  // Встраиваем compareDOM прямо в функцию
  const compareNodes = (serverNode: Element | null, clientNode: Element | null, path = '') => {
    if (!serverNode || !clientNode) {
      throw new Error(`Отсутствует узел в пути: ${path}`)
    }

    // Базовые проверки
    if (serverNode.nodeName !== clientNode.nodeName) {
      throw new Error(`Несоответствие типов узлов в пути ${path}`)
    }

    // Сравнение атрибутов
    const serverAttrs = Array.from(serverNode.attributes)
    serverAttrs.forEach((attr) => {
      const clientAttrValue = clientNode.getAttribute(attr.name)
      if (clientAttrValue !== attr.value) {
        throw new Error(`Несоответствие атрибута ${attr.name} в пути ${path}`)
      }
    })

    // Рекурсивное сравнение дочерних элементов
    const serverChildren = Array.from(serverNode.children)
    const clientChildren = Array.from(clientNode.children)

    if (serverChildren.length !== clientChildren.length) {
      throw new Error(`Несоответствие количества дочерних элементов в пути ${path}`)
    }

    serverChildren.forEach((child, index) => {
      compareNodes(
        child as Element,
        clientChildren[index] as Element,
        `${path}/${child.nodeName}[${index}]`
      )
    })
  }

  // Сравниваем первые дочерние элементы
  compareNodes(serverContainer.firstElementChild, clientContainer.firstElementChild)
}
