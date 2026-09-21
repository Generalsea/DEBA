export default function HomePage() {
  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">DEBA</p>
        <h1>Give useful things another life.</h1>
        <p className="lede">
          Buy, sell, exchange, or give away pre-owned and unused items through
          one fast, modern experience.
        </p>
        <div className="actions">
          <a className="primary" href="/marketplace">Browse marketplace</a>
          <a className="secondary" href="/sell">Sell an item</a>
          <a className="secondary" href="/donate">Give something</a>
        </div>
      </section>
    </main>
  );
}
