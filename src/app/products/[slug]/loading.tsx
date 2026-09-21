export default function ProductDetailLoading() {
  return (
    <main className="deba-detail-page deba-detail-state-page" dir="rtl">
      <div className="deba-detail-state-card" aria-busy="true">
        <div className="deba-detail-state-kicker">DEBA MARKETPLACE</div>
        <div className="deba-state-skeleton deba-state-skeleton-lg" />
        <div className="deba-state-skeleton deba-state-skeleton-md" />
        <div className="deba-state-skeleton deba-state-skeleton-sm" />
        <div className="deba-state-skeleton-grid">
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </main>
  )
}
