import type { CSSProperties } from 'react';

const colors = ['#f5bf43', '#ec797a', '#6faede', '#8d75ca', '#65bda5', '#ed9561'];
const pieces = Array.from({ length: 72 }, (_, index) => ({
  '--piece-color': colors[index % colors.length],
  '--piece-start': `${index % 2 ? 85 : 15}vw`,
  '--piece-x': `${((index * 47) % 101) - (index % 2 ? 85 : 15)}vw`,
  '--piece-y': `${-25 - (index * 13) % 45}vh`,
  '--piece-turn': `${(index % 2 ? 1 : -1) * (220 + (index * 37) % 560)}deg`,
  '--piece-delay': `${(index % 9) * 25}ms`,
} as CSSProperties));

export function StudentConfetti() {
  return <div className="student-confetti" aria-hidden="true">{pieces.map((style, index) => <i key={index} style={style} className={index % 4 === 0 ? 'confetti-star' : ''} />)}</div>;
}
