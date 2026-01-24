import { Languages, Moon, Sun } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { setTheme, useTheme } from './theme';

export default function App() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();

  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const nextLang = useMemo(() => (i18n.language === 'zh-CN' ? 'en-US' : 'zh-CN'), [i18n.language]);

  return (
    <div className="min-h-dvh bg-bg-0 text-fg-0">
      <div className="mx-auto flex min-h-dvh max-w-6xl gap-4 p-4">
        <aside className="w-64 shrink-0 rounded-xl2 border border-border bg-bg-1 shadow-panel">
          <div className="border-b border-border p-4">
            <div className="text-sm text-fg-2">{t('app.subtitle')}</div>
            <div className="text-lg font-semibold">{t('app.title')}</div>
          </div>
          <nav className="p-2 text-sm">
            <a className="block rounded-lg px-3 py-2 hover:bg-bg-2" href="#">
              {t('nav.records')}
            </a>
            <a className="block rounded-lg px-3 py-2 hover:bg-bg-2" href="#">
              {t('nav.sync')}
            </a>
            <a className="block rounded-lg px-3 py-2 hover:bg-bg-2" href="#">
              {t('nav.settings')}
            </a>
          </nav>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="flex items-center justify-between rounded-xl2 border border-border bg-bg-1 px-4 py-3 shadow-panel">
            <div className="min-w-0">
              <div className="truncate text-sm text-fg-2">{t('header.kicker')}</div>
              <div className="truncate text-base font-semibold">{t('header.title')}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-2 px-3 py-2 text-sm hover:brightness-110"
                type="button"
                onClick={() => setTheme(nextTheme)}
                aria-label={t('actions.toggleTheme')}
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                <span className="hidden sm:inline">{t('actions.theme')}</span>
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-2 px-3 py-2 text-sm hover:brightness-110"
                type="button"
                onClick={() => void i18n.changeLanguage(nextLang)}
                aria-label={t('actions.toggleLanguage')}
              >
                <Languages size={16} />
                <span className="hidden sm:inline">{t('actions.language')}</span>
              </button>
            </div>
          </header>

          <section className="rounded-xl2 border border-border bg-bg-1 p-6 shadow-panel">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm text-fg-2">{t('home.hint')}</div>
                <div className="text-xl font-semibold">{t('home.welcome')}</div>
              </div>
              <div className="shrink-0">
                <span className="inline-flex items-center rounded-md bg-brand px-3 py-1 text-xs font-semibold text-black">
                  {t('home.badge')}
                </span>
              </div>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-fg-1 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-bg-2 p-4">
                <div className="font-semibold">{t('home.card1.title')}</div>
                <div className="mt-1 text-fg-2">{t('home.card1.desc')}</div>
              </div>
              <div className="rounded-lg border border-border bg-bg-2 p-4">
                <div className="font-semibold">{t('home.card2.title')}</div>
                <div className="mt-1 text-fg-2">{t('home.card2.desc')}</div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

