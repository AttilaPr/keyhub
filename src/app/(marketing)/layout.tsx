import { MarketingFooter } from "@/components/marketing/footer"

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-svh flex flex-col bg-black" style={{ fontFamily: "'General Sans', sans-serif" }}>
      {/* General Sans from Fontshare */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://api.fontshare.com/v2/css?f[]=general-sans@200,300,400,500,600,700&display=swap"
        rel="stylesheet"
      />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  )
}
