import Posts from './Posts';
import Welcome from './Welcome';

export default function App() {
  return location.pathname === '/posts' ? <Posts /> : <Welcome />;
}
