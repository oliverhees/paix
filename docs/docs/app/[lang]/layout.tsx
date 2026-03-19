import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Head } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import 'nextra-theme-docs/style.css'
import '../globals.css'

export const metadata = {
  title: 'PAIONE Docs',
  description: 'PAIONE — The personal AI that evolves with you.',
}

const LOCALES = [
  { locale: 'en', name: 'English' },
  { locale: 'de', name: 'Deutsch' },
]

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params

  return (
    <html lang={lang} dir="ltr" suppressHydrationWarning>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>
      <body>
        <Layout
          navbar={
            <Navbar
              logo={
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.1rem' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M13 2L4.09 12.78a1 1 0 00.77 1.62H11v5.6a1 1 0 001.77.63L21.68 9.6a1 1 0 00-.77-1.6H13V2z" fill="#f97316"/>
                  </svg>
                  PAIONE
                </span>
              }
              projectLink="https://github.com/oliverhees/paione"
            />
          }
          footer={<Footer>PAIONE — The personal AI that evolves with you.</Footer>}
          docsRepositoryBase="https://github.com/oliverhees/paione/tree/main/docs"
          i18n={LOCALES}
          pageMap={await getPageMap(lang)}
        >
          {children}
        </Layout>
      </body>
    </html>
  )
}
