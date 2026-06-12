import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'submit' | 'hollow' | 'link' | 'ghost' | 'danger' | 'pill'
type Size = 'xs' | 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
  children: ReactNode
}

const variantClasses: Record<Variant, string> = {
  primary: 'btn-primary',
  submit:  'btn-primary',
  hollow:  'btn-hollow',
  link:    'btn-link',
  ghost:   'btn-ghost',
  danger:  'btn-danger',
  pill:    'btn-pill',
}

const sizeClasses: Record<Size, string> = {
  xs: 'btn-xs',
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'ghost',
    size = 'sm',
    fullWidth = false,
    className = '',
    type,
    children,
    ...props
  },
  ref,
): JSX.Element {
  return (
    <button
      ref={ref}
      // raw <button> defaults to type="submit" inside forms — only the
      // `submit` variant should keep that behavior
      type={type ?? (variant === 'submit' ? 'submit' : 'button')}
      className={`btn ${variantClasses[variant]} ${sizeClasses[size]}${fullWidth ? ' w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
})
