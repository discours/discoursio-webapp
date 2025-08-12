#!/usr/bin/env node

/**
 * Скрипт для проверки доступности серверов
 * Проверяет API сервер и локальный dev сервер
 */

import fetch from 'node-fetch'

const API_URL = 'https://v3.dscrs.site/graphql'
const LOCAL_URL = 'http://localhost:3001'
const LOCAL_GRAPHQL_URL = 'http://localhost:3001/graphql'

/**
 * Проверяет API сервер
 */
async function checkApiServer() {
  try {
    console.log('🔍 Проверка API сервера...')

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: '{ __typename }'
      })
    })

    if (response.ok) {
      console.log('✅ API сервер доступен')
      return true
    } else {
      console.log('⚠️ API сервер отвечает с ошибкой:', response.status)
      return false
    }
  } catch (error) {
    console.log('❌ API сервер недоступен:', error.message)
    return false
  }
}

/**
 * Проверяет локальный dev сервер
 */
async function checkLocalServer() {
  try {
    console.log('🔍 Проверка локального сервера...')
    
    const response = await fetch(LOCAL_URL, {
      method: 'GET',
      timeout: 5000
    })
    
    if (response.ok) {
      console.log('✅ Локальный сервер доступен')
      return true
    } else {
      console.log('⚠️ Локальный сервер отвечает с ошибкой:', response.status)
      return false
    }
  } catch (error) {
    console.log('❌ Локальный сервер недоступен:', error.message)
    return false
  }
}

/**
 * Проверяет локальный GraphQL через прокси
 */
async function checkLocalGraphQL() {
  try {
    console.log('🔍 Проверка локального GraphQL через прокси...')
    
    const response = await fetch(LOCAL_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: '{ __typename }'
      }),
      timeout: 5000
    })
    
    if (response.ok) {
      console.log('✅ Локальный GraphQL доступен через прокси')
      return true
    } else {
      console.log('⚠️ Локальный GraphQL отвечает с ошибкой:', response.status)
      return false
    }
  } catch (error) {
    console.log('❌ Локальный GraphQL недоступен через прокси:', error.message)
    return false
  }
}

/**
 * Основная функция
 */
async function main() {
  console.log('🚀 Проверка доступности серверов')
  console.log('═══════════════════════════════════════════════════════════════')
  
  const apiAvailable = await checkApiServer()
  const localAvailable = await checkLocalServer()
  const localGraphQLAvailable = await checkLocalGraphQL()
  
  console.log('═══════════════════════════════════════════════════════════════')
  
  if (apiAvailable && localAvailable && localGraphQLAvailable) {
    console.log('🎉 Все серверы доступны! Тесты должны работать.')
  } else if (apiAvailable && !localAvailable) {
    console.log('⚠️ API сервер доступен, но локальный сервер не запущен.')
    console.log('💡 Запустите: npm run dev')
  } else if (apiAvailable && localAvailable && !localGraphQLAvailable) {
    console.log('⚠️ Локальный сервер доступен, но GraphQL прокси не работает.')
    console.log('💡 Проверьте настройки прокси в dev сервере')
  } else if (!apiAvailable && localAvailable) {
    console.log('⚠️ Локальный сервер доступен, но API сервер недоступен.')
    console.log('💡 Проверьте интернет соединение')
  } else {
    console.log('❌ Ни один сервер не доступен.')
    console.log('💡 Проверьте интернет и запустите локальный сервер')
  }
  
  console.log('\n📊 Статус:')
  console.log(`   API сервер: ${apiAvailable ? '✅' : '❌'}`)
  console.log(`   Локальный сервер: ${localAvailable ? '✅' : '❌'}`)
  console.log(`   Локальный GraphQL: ${localGraphQLAvailable ? '✅' : '❌'}`)
}

// Запуск
main().catch(console.error)
