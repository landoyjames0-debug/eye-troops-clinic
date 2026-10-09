import { useEffect } from 'react'
import { toast } from 'sonner'
import { registerSW } from 'virtual:pwa-register'

export function PwaUpdatePrompt() {
  useEffect(() => {
    let updateServiceWorker = () => Promise.resolve()
    updateServiceWorker = registerSW({
      immediate: true,
      onNeedRefresh() {
        toast('A new app version is ready.', {
          duration: Infinity,
          action: {
            label: 'Refresh',
            onClick: () => void updateServiceWorker(true),
          },
        })
      },
    })
  }, [])

  return null
}
