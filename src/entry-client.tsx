// @refresh reload
import { mount, StartClient } from '@solidjs/start/client'

mount(() => <StartClient />, document.getElementById('app') || document.body)

// Service Worker временно отключён из-за проблем с блокировкой загрузки

export default {}
