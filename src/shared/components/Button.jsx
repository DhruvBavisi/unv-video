export default function Button({
  as: Tag = 'button',
  variant = 'default',
  children,
  className = '',
  ...props
}) {
  return (
    <Tag className={`btn btn--${variant} ${className}`.trim()} {...props}>
      {children}
    </Tag>
  )
}