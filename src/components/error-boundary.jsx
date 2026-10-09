import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unhandled page error:', error, errorInfo)
    }
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh items-center justify-center bg-ivory px-6 py-12 text-center">
          <div className="w-full max-w-md rounded-card border border-champagne bg-surface p-6 shadow-card">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-dark">
              Something went wrong
            </p>
            <h1 className="mt-3 text-2xl font-bold text-espresso">We hit an unexpected error</h1>
            <p className="mt-2 text-sm text-warmgray">
              Please reload the page and try again. If the issue continues, contact the clinic administrator.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="mt-5 inline-flex h-11 items-center justify-center rounded-control bg-gold px-4 text-sm font-semibold text-white transition-colors hover:bg-gold-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
