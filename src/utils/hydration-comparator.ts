// utils/hydration-comparator.ts
export const compareServerClientDOM = () => {
  if (typeof window === 'undefined') return

  const compareDOM = () => {
    const serverDOM = document.querySelector('[data-server-rendered="true"]')
    const clientDOM = document.body

    if (!serverDOM) {
      console.warn('Не найден серверный DOM-контейнер')
      return
    }

    const differences: {
      type: 'attribute' | 'structure' | 'content'
      path: string
      details: string
    }[] = []

    const traverseAndCompare = (serverNode: Element, clientNode: Element, path = '') => {
      // Расширенное сравнение атрибутов
      const compareAttributes = (server: Element, client: Element) => {
        const serverAttrs = Array.from(server.attributes)
        const clientAttrs = Array.from(client.attributes)

        // Проверка атрибутов сервера в клиенте
        serverAttrs.forEach((serverAttr) => {
          const clientAttrValue = client.getAttribute(serverAttr.name)

          if (clientAttrValue === null) {
            differences.push({
              type: 'attribute',
              path,
              details: `Атрибут ${serverAttr.name} отсутствует в клиентском DOM`
            })
          } else if (clientAttrValue !== serverAttr.value) {
            differences.push({
              type: 'attribute',
              path,
              details: `Атрибут ${serverAttr.name} differs (${serverAttr.value} vs ${clientAttrValue})`
            })
          }
        })

        // Дополнительная проверка клиентских атрибутов
        clientAttrs.forEach((clientAttr) => {
          const serverAttrValue = server.getAttribute(clientAttr.name)

          if (serverAttrValue === null) {
            differences.push({
              type: 'attribute',
              path,
              details: `Клиентский атрибут ${clientAttr.name} отсутствует в серверном DOM`
            })
          }
        })
      }

      // Сравнение типов узлов
      if (serverNode.nodeName !== clientNode.nodeName) {
        differences.push({
          type: 'structure',
          path,
          details: `Несоответствие типов узлов (${serverNode.nodeName} vs ${clientNode.nodeName})`
        })
      }

      // Сравнение атрибутов
      compareAttributes(serverNode, clientNode)

      // Рекурсивное сравнение дочерних элементов
      const serverChildren = Array.from(serverNode.children)
      const clientChildren = Array.from(clientNode.children)

      serverChildren.forEach((child, index) => {
        const clientChild = clientChildren[index]
        if (clientChild) {
          traverseAndCompare(
            child as Element,
            clientChild as Element,
            `${path}/${child.nodeName}[${index}]`
          )
        } else {
          differences.push({
            type: 'structure',
            path,
            details: `Отсутствует дочерний элемент ${child.nodeName}`
          })
        }
      })
    }

    try {
      traverseAndCompare(serverDOM, clientDOM)

      // Улучшенная визуализация
      const createReport = () => {
        const reportContainer = document.createElement('div')
        reportContainer.style.cssText = `
          position: fixed; 
          bottom: 10px; 
          left: 10px; 
          background: ${differences.length ? 'rgba(255,0,0,0.7)' : 'rgba(0,255,0,0.7)'};
          color: white;
          padding: 10px;
          z-index: 10000;
          max-height: 300px;
          overflow-y: auto;
          font-family: monospace;
        `

        const groupedDifferences = differences.reduce(
          (acc, diff) => {
            if (!acc[diff.type]) acc[diff.type] = []
            acc[diff.type].push(diff)
            return acc
          },
          {} as Record<string, typeof differences>
        )

        reportContainer.innerHTML = `
          <h3>🔍 DOM Hydration Comparison</h3>
          <p>Total Differences: ${differences.length}</p>
          ${Object.entries(groupedDifferences)
            .map(
              ([type, diffs]) => `
            <details>
              <summary>${type.toUpperCase()} Differences (${diffs.length})</summary>
              <ul>
                ${diffs.map((diff) => `<li>${diff.path}: ${diff.details}</li>`).join('')}
              </ul>
            </details>
          `
            )
            .join('')}
        `

        document.body.appendChild(reportContainer)
      }

      // Подсветка проблемных элементов
      differences.forEach((diff) => {
        try {
          const elements = document.evaluate(
            diff.path,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          )
          const element = elements.singleNodeValue as Element
          if (element) {
            element.setAttribute('data-hydration-error', diff.type)
            ;(element as HTMLElement).style.border =
              diff.type === 'attribute'
                ? '2px dashed orange'
                : diff.type === 'structure'
                  ? '2px solid red'
                  : '2px dotted yellow'
          }
        } catch (highlightError) {
          console.warn('Ошибка подсветки элемента:', highlightError)
        }
      })

      // Move groupedDifferences before logging and reporting
      const groupedDifferences = differences.reduce(
        (acc, diff) => {
          if (!acc[diff.type]) acc[diff.type] = []
          acc[diff.type].push(diff)
          return acc
        },
        {} as Record<string, typeof differences>
      )

      // Логирование
      console.group('🔍 DOM Hydration Comparison')
      console.log('Total Differences:', differences.length)
      console.log('Grouped Differences:', groupedDifferences)
      console.groupEnd()

      // Создаем репорт
      createReport()
    } catch (error) {
      console.error('Ошибка сравнения DOM:', error)
    }
  }

  // Запускаем после полной гидрации
  setTimeout(compareDOM, 100)
}
