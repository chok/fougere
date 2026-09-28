import './welcome.css';

export default function App() {
  return (
    <main className="welcome">
      <h1>🌿 Fougere</h1>
      <p className="host">Your app is running on <strong>React</strong>.</p>
      <ol>
        <li><a href="https://fougere.dev/docs/guides/business-logic">Handle your business logic <span>→</span></a></li>
        <li><a href="https://fougere.dev/docs/guides/data">Store your data <span>→</span></a></li>
        <li><a href="https://fougere.dev/docs/guides/topology">Shape your topology <span>→</span></a></li>
      </ol>
      <footer><a href="https://fougere.dev/docs">Docs</a></footer>
    </main>
  );
}
