import { useEffect, useRef, useState } from 'react'
import { Download, Share } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'

const DISMISS_KEY = 'pwa-install-dismissed-until'
const DISMISS_DAYS = 7

function isRunningStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

function getInstallMode() {
  const userAgent = navigator.userAgent
  const isAppleMobile = /iPhone|iPad|iPod/i.test(userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return isAppleMobile ? 'ios' : 'manual'
}

export function PwaInstallPrompt() {
  const installEventRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [installMode, setInstallMode] = useState(getInstallMode)

  useEffect(() => {
    if (isRunningStandalone()) return undefined

    try {
      if (Number(window.localStorage.getItem(DISMISS_KEY) ?? 0) > Date.now()) return undefined
    } catch {
      // The prompt remains usable if local storage is unavailable.
    }

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault()
      installEventRef.current = event
      setInstallMode('native')
      setOpen(true)
    }
    const handleInstalled = () => {
      installEventRef.current = null
      setOpen(false)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    const fallbackTimer = window.setTimeout(() => setOpen(true), 1400)

    return () => {
      window.clearTimeout(fallbackTimer)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  const dismiss = () => {
    try {
      window.localStorage.setItem(
        DISMISS_KEY,
        String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000),
      )
    } catch {
      // Dismissing still closes the prompt when storage is unavailable.
    }
    setOpen(false)
  }

  const install = async () => {
    const promptEvent = installEventRef.current
    if (!promptEvent) {
      dismiss()
      return
    }

    try {
      await promptEvent.prompt()
      await promptEvent.userChoice
      installEventRef.current = null
      dismiss()
    } catch {
      setInstallMode('manual')
    }
  }

  const instructions = installMode === 'ios'
    ? 'In Safari, tap Share, then Add to Home Screen.'
    : installMode === 'manual'
      ? 'Open your browser menu and choose Install Eye Troops or Install this site as an app.'
      : 'Installing adds an app shortcut. Your clinic account and records remain online; patient data is not downloaded to this device.'

  return (
    <Dialog open={open} onOpenChange={(next) => !next && dismiss()}>
      <DialogContent
        title="Install Eye Troops?"
        description="Add the clinic app to your device for quick access."
        size="sm"
        showClose={false}
        footer={(
          <>
            <Button type="button" variant="outline" onClick={dismiss}>
              Not now
            </Button>
            {installMode === 'native' ? (
              <Button type="button" onClick={() => void install()}>
                <Download className="size-4" aria-hidden="true" />
                Install app
              </Button>
            ) : (
              <Button type="button" onClick={dismiss}>
                {installMode === 'ios' && <Share className="size-4" aria-hidden="true" />}
                Got it
              </Button>
            )}
          </>
        )}
      >
        <p className="text-[13px] leading-relaxed text-warmgray">{instructions}</p>
      </DialogContent>
    </Dialog>
  )
}
