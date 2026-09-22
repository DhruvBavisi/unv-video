export default function LoadingScreen({ label = 'INITIALIZING INVESTIGATION...' }) {
  return (
    <div className="loading" role="status">
      <span className="loading__title">CLASSIFIED FILE</span>
      <span className="loading__status">{label}</span>
    </div>
  )
}