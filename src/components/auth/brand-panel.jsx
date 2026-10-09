import { APP_NAME, LOGO_PATH } from '@/lib/constants'
import { ThemeToggle } from '@/components/ui/theme-toggle'

export function AuthBrandPanel({ eyebrow, headline, description, features }) {
  const identity = (
    <div className="login-brand-identity">
      <img
        src={LOGO_PATH}
        alt=""
        width={64}
        height={64}
        className="login-brand-logo"
      />
      <div className="min-w-0 leading-tight overflow-hidden">
        <p className="font-display text-[1rem] font-extrabold text-espresso whitespace-nowrap truncate">{APP_NAME}</p>
        <p className="login-brand-tagline whitespace-nowrap truncate">OPTICAL CLINIC MANAGEMENT</p>
      </div>
    </div>
  )

  return (
    <>
      <section className="login-brand">
        <div aria-hidden="true" className="login-iris pointer-events-none absolute inset-0" />
        <div className="login-brand-desktop-header">
          {identity}
          <ThemeToggle />
        </div>

        <div className="login-brand-content">
          <div className="login-brand-copy">
            <p className="login-eyebrow">{eyebrow}</p>
            <h2 className="login-headline">{headline}</h2>
            <p className="login-brand-description">{description}</p>
          </div>

          <ul className="login-features">
            {features.map(({ icon: Icon, label }) => (
              <li key={label} className="login-feature">
                <span className="login-feature-icon">
                  <Icon className="size-4" strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="login-brand-compact">
        {identity}
        <ThemeToggle />
      </div>
    </>
  )
}