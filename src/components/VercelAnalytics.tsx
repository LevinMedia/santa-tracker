"use client"

import Script from "next/script"

const analyticsQueueStub = `
  window.va = window.va || function () {
    (window.vaq = window.vaq || []).push(arguments)
  }
`

export function VercelAnalytics() {
  return (
    <>
      <Script id="vercel-analytics-stub" strategy="afterInteractive">
        {analyticsQueueStub}
      </Script>
      <Script src="/_vercel/insights/script.js" strategy="afterInteractive" />
    </>
  )
}
