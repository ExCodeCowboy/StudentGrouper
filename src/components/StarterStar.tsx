import { Star } from 'lucide-react';
import './starterStar.css';

export function StarterStar() {
  return <span className="starter-star" title="Starter: goes first"><Star aria-hidden="true" /><span className="sr-only">Starter</span></span>;
}
