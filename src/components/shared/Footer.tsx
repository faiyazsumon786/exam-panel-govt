'use client'

import { useAuth } from '@/hooks/useAuth'
import { Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FooterProps {
  className?: string
}

export function Footer({ className }: FooterProps) {
  const { profile } = useAuth()
  
  const fullName = profile?.full_name || ''
  const phone = profile?.phone || ''
  const messageText = fullName 
    ? `Assalamu Alaikum Admin, please approve my account.\nName: ${fullName}\nPhone: ${phone}`
    : `Assalamu Alaikum Admin`
  const encodedText = encodeURIComponent(messageText)

  const telegramUrl = `https://t.me/MR_Expart_SH`
  const whatsappUrl = `https://wa.me/8801609450034?text=${encodedText}`

  return (
    <footer className={cn("w-full py-6 mt-auto border-t border-slate-900/60 bg-slate-950/20 text-center space-y-4 px-4 z-10", className)}>
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <p className="text-[11px] text-slate-600 order-last md:order-first">
          © {new Date().getFullYear()} Luminous Skill Development Training Centre - SH TECH ZONE. All rights reserved.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-6">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors"
          >
            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2C6.48 2 2 6.48 2 12a9.9 9.9 0 0 0 1.32 4.96L2 22l5.14-1.35c1.47.8 3.12 1.35 4.86 1.35 5.52 0 10-4.48 10-10S17.52 2 12 2zm4.83 12.02c-.25-.13-1.44-.71-1.67-.79-.22-.08-.39-.13-.55.13-.16.26-.63.79-.77.95-.15.16-.3.18-.54.06-1-.48-1.67-.93-2.35-2.09-.15-.26-.01-.39.11-.51.11-.11.25-.29.37-.43.12-.14.16-.24.24-.4.08-.17.04-.32-.02-.44-.06-.13-.55-1.33-.75-1.82-.2-.48-.4-.42-.55-.42h-.47a.9.9 0 0 0-.65.3c-.22.25-.85.84-.85 2.04 0 1.2.87 2.37 1 2.53.12.16 1.72 2.63 4.17 3.69.58.25 1.04.4 1.39.51.59.19 1.12.16 1.54.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.47-.29z" clipRule="evenodd" />
            </svg>
            WhatsApp
          </a>
          <span className="text-slate-800 hidden md:inline">|</span>
          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-sky-400 transition-colors"
          >
            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15.68-.79 3.42-1.12 4.79-.14.58-.35.78-.56.8-.46.04-.81-.31-1.26-.6-0.7-.46-1.09-.75-1.77-1.2-0.79-.52-.28-.81.17-1.28.12-.12 2.18-2 2.22-2.17.01-.02.01-.1-.05-.15s-.14-.03-.21-.01c-.09.02-1.61 1.02-4.54 3a1.9 1.9 0 0 1-1.11.41c-.41-.01-1.21-.23-1.8-.42-.72-.23-1.3-.36-1.25-.76.03-.21.31-.42.85-.64 3.31-1.44 5.51-2.4 6.61-2.88 3.14-1.38 3.8-1.62 4.22-1.63.1 0 .31.02.45.14.12.1.15.24.17.34.02.09.02.26 0 .38z"/>
            </svg>
            Telegram
          </a>
          <span className="text-slate-800 hidden md:inline">|</span>
          <a
            href="https://www.luminouscentre.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-indigo-400 transition-colors"
          >
            <Globe className="h-3.5 w-3.5" />
            Official Website
          </a>
        </div>
      </div>
    </footer>
  )
}
