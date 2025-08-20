// utils/hydration-validator.ts

import type { JSX } from 'solid-js'
import { hydrate, isServer, renderToString } from 'solid-js/web'

/**
 * Расширенная проверка различий в DOM структуре
 */
const analyzeStructuralDifferences = (serverNode: Element, clientNode: Element): string[] => {
  const issues: string[] = []

  try {
    // Сравнение базовых свойств
    if (serverNode.tagName !== clientNode.tagName) {
      issues.push(`Tag mismatch: server=${serverNode.tagName}, client=${clientNode.tagName}`)
    }

    if (serverNode.id !== clientNode.id) {
      issues.push(`ID mismatch: server="${serverNode.id}", client="${clientNode.id}"`)
    }

    if (serverNode.className !== clientNode.className) {
      issues.push(`Class mismatch: server="${serverNode.className}", client="${clientNode.className}"`)
    }

    // Сравнение атрибутов
    const serverAttrs = Array.from(serverNode.attributes)
    const clientAttrs = Array.from(clientNode.attributes)

    // Проверяем отсутствующие атрибуты на клиенте
    serverAttrs.forEach((attr) => {
      if (!clientNode.hasAttribute(attr.name)) {
        issues.push(`Missing attribute on client: ${attr.name}="${attr.value}"`)
      } else if (clientNode.getAttribute(attr.name) !== attr.value) {
        issues.push(
          `Attribute value mismatch: ${attr.name} server="${attr.value}" client="${clientNode.getAttribute(attr.name)}"`
        )
      }
    })

    // Проверяем лишние атрибуты на клиенте
    clientAttrs.forEach((attr) => {
      if (!serverNode.hasAttribute(attr.name)) {
        issues.push(`Extra attribute on client: ${attr.name}="${attr.value}"`)
      }
    })

    // Сравнение количества дочерних элементов
    if (serverNode.children.length !== clientNode.children.length) {
      issues.push(`Children count mismatch: server=${serverNode.children.length}, client=${clientNode.children.length}`)
    }

    // Сравнение текстового содержимого (без whitespace)
    const serverText = serverNode.textContent?.replace(/\s+/g, ' ').trim()
    const clientText = clientNode.textContent?.replace(/\s+/g, ' ').trim()

    if (serverText !== clientText) {
      issues.push(
        `Text content mismatch: server="${serverText?.substring(0, 100)}" client="${clientText?.substring(0, 100)}"`
      )
    }
  } catch (error) {
    issues.push(`Analysis error: ${error}`)
  }

  return issues
}

/**
 * Рекурсивное сравнение узлов с детальной диагностикой
 */
const compareNodes = (
  serverNode: Element | null,
  clientNode: Element | null,
  path = '',
  maxDepth = 5,
  currentDepth = 0
): string[] => {
  const issues: string[] = []

  if (currentDepth > maxDepth) {
    issues.push(`Max depth reached at ${path}`)
    return issues
  }

  if (!serverNode && !clientNode) {
    return issues
  }

  if (!serverNode) {
    issues.push(`Missing server node at ${path}`)
    return issues
  }

  if (!clientNode) {
    issues.push(`Missing client node at ${path}`)
    return issues
  }

  // Анализируем различия в текущем узле
  const nodeIssues = analyzeStructuralDifferences(serverNode, clientNode)
  nodeIssues.forEach((issue) => {
    issues.push(`${path}: ${issue}`)
  })

  // Рекурсивно сравниваем дочерние элементы
  const minChildren = Math.min(serverNode.children.length, clientNode.children.length)
  for (let i = 0; i < minChildren; i++) {
    const serverChild = serverNode.children[i] as Element
    const clientChild = clientNode.children[i] as Element
    const childPath = `${path}/${serverChild.tagName}[${i}]`

    const childIssues = compareNodes(serverChild, clientChild, childPath, maxDepth, currentDepth + 1)

    issues.push(...childIssues)
  }

  // Проверяем лишние дочерние элементы
  if (serverNode.children.length > clientNode.children.length) {
    for (let i = clientNode.children.length; i < serverNode.children.length; i++) {
      const extraChild = serverNode.children[i] as Element
      issues.push(`${path}: Extra server child ${extraChild.tagName}[${i}]`)
    }
  }

  if (clientNode.children.length > serverNode.children.length) {
    for (let i = serverNode.children.length; i < clientNode.children.length; i++) {
      const extraChild = clientNode.children[i] as Element
      issues.push(`${path}: Extra client child ${extraChild.tagName}[${i}]`)
    }
  }

  return issues
}

/**
 * Безопасная валидация гидрации с детальной диагностикой
 */
export const validateHydration = async (
  renderComponent: () => JSX.Element
): Promise<{
  isValid: boolean
  issues: string[]
  summary: {
    serverHTML: string | null
    clientHTML: string | null
    timestamp: number
  }
}> => {
  if (isServer) {
    return {
      isValid: true,
      issues: ['Skipped on server'],
      summary: {
        serverHTML: null,
        clientHTML: null,
        timestamp: Date.now()
      }
    }
  }

  const issues: string[] = []
  let serverHTML: string | null = null
  let clientHTML: string | null = null

  try {
    console.log('🔍 Starting hydration validation...')

    // Рендерим серверную версию
    serverHTML = await renderToString(renderComponent)
    console.log('🔍 Server HTML rendered, length:', serverHTML.length)

    // Создаем контейнер для серверного HTML
    const serverContainer = document.createElement('div')
    serverContainer.innerHTML = serverHTML

    // Создаем контейнер для клиентской гидрации
    const clientContainer = document.createElement('div')

    // Безопасная гидрация с обработкой ошибок
    try {
      hydrate(renderComponent, clientContainer)
      clientHTML = clientContainer.innerHTML
      console.log('🔍 Client hydrated, length:', clientHTML.length)
    } catch (hydrationError) {
      issues.push(`Hydration failed: ${hydrationError}`)
      console.error('🔍 Hydration error:', hydrationError)
      return {
        isValid: false,
        issues,
        summary: {
          serverHTML,
          clientHTML: null,
          timestamp: Date.now()
        }
      }
    }

    // Сравниваем DOM структуры
    const serverRoot = serverContainer.firstElementChild
    const clientRoot = clientContainer.firstElementChild

    if (!serverRoot || !clientRoot) {
      issues.push('Missing root elements for comparison')
    } else {
      console.log('🔍 Comparing DOM structures...')
      const comparisonIssues = compareNodes(serverRoot, clientRoot, 'root')
      issues.push(...comparisonIssues)
    }

    // Дополнительные проверки
    if (serverHTML.length !== clientHTML.length) {
      issues.push(`HTML length mismatch: server=${serverHTML.length}, client=${clientHTML.length}`)
    }

    // Проверяем наличие hydration-специфичных атрибутов
    const hasHydrationAttrs = clientHTML.includes('data-hk')
    if (!hasHydrationAttrs) {
      issues.push('Missing hydration attributes (data-hk) in client HTML')
    }

    const isValid = issues.length === 0

    console.log('🔍 Hydration validation completed:', {
      isValid,
      issuesCount: issues.length,
      firstIssue: issues[0] || 'None'
    })

    return {
      isValid,
      issues,
      summary: {
        serverHTML,
        clientHTML,
        timestamp: Date.now()
      }
    }
  } catch (error) {
    const errorMessage = `Validation error: ${error}`
    issues.push(errorMessage)
    console.error('🔍 Validation error:', error)

    return {
      isValid: false,
      issues,
      summary: {
        serverHTML,
        clientHTML,
        timestamp: Date.now()
      }
    }
  }
}

/**
 * Удобная функция для быстрой проверки компонента
 */
export const quickHydrationCheck = async (
  renderComponent: () => JSX.Element,
  componentName = 'Component'
): Promise<boolean> => {
  try {
    const result = await validateHydration(renderComponent)

    if (!result.isValid) {
      console.group(`🔍 Hydration issues in ${componentName}:`)
      result.issues.forEach((issue, index) => {
        console.warn(`${index + 1}. ${issue}`)
      })
      console.groupEnd()
    } else {
      console.log(`✅ ${componentName} hydration is valid`)
    }

    return result.isValid
  } catch (error) {
    console.error(`🔍 Quick check failed for ${componentName}:`, error)
    return false
  }
}
