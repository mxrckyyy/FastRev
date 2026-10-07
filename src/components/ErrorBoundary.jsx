import { Component } from 'react'
import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  handleReset = () => {
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            The app hit an unexpected error. Your data is safe — try again, or
            reload the page if it keeps happening.
          </p>
          {import.meta.env.DEV && (
            <p className="max-w-md break-words font-mono text-xs text-muted-foreground">
              {error.message || String(error)}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={this.handleReset}>
            <RotateCw className="mr-1.5 size-4" aria-hidden="true" />
            Try again
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </div>
      </div>
    )
  }
}
