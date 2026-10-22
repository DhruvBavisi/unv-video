export default function CharacterRole({
  part = 'all',
  role = '',
  name = '',
  tagline = '',
  description = '',
  meta = '',
}) {
  const showLabel = part === 'all' || part === 'label'
  const showDesc = part === 'all' || part === 'desc'

  return (
    <div className="role">
      <div className="role__inner">
        {showLabel && role && (
          <span className="role__label label">
            <span className="role__label-line" aria-hidden="true" />
            {role}
          </span>
        )}
        {showLabel && name && <h3 className="role__name">{name}</h3>}
        {showDesc && tagline && <p className="role__tagline">{tagline}</p>}
        {showDesc && description && <p className="role__description">{description}</p>}
        {showDesc && meta && <p className="role__meta">{meta}</p>}
      </div>
    </div>
  )
}