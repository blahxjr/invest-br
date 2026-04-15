// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Skeleton } from '@/components/ui/Skeleton'

describe('Skeleton', () => {
  it('renderiza classes base de animação e cor', () => {
    const { container } = render(<Skeleton />)

    const skeleton = container.firstChild as HTMLElement
    expect(skeleton).toHaveClass('animate-pulse')
    expect(skeleton).toHaveClass('rounded-md')
    expect(skeleton).toHaveClass('bg-gray-200')
  })

  it('mescla className customizada', () => {
    const { container } = render(<Skeleton className="h-12 w-full" />)

    const skeleton = container.firstChild as HTMLElement
    expect(skeleton).toHaveClass('h-12')
    expect(skeleton).toHaveClass('w-full')
  })
})
