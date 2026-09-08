import type { CSSProperties } from 'react';
import type { RevealEffect } from './types';
import './fairy.css';

function FairyWithWand() {
  return <svg viewBox="0 0 260 260" aria-hidden="true">
    <g className="fairy-wing-left" fill="#e7d5f5" fillOpacity=".9" stroke="#b6a2d4" strokeWidth="3" strokeLinejoin="round">
      <path d="M119 139C73 128 18 101 27 66C37 32 87 71 119 139Z" />
      <path d="M117 137C77 125 41 150 54 181C67 208 109 169 117 137Z" fill="#d5eee7" />
      <path d="M112 133Q67 101 42 75M110 146Q78 153 64 176" fill="none" stroke="#fffafc" strokeWidth="3" />
    </g>
    <g className="fairy-wing-right" fill="#e7d5f5" fillOpacity=".9" stroke="#b6a2d4" strokeWidth="3" strokeLinejoin="round">
      <path d="M127 138C146 94 190 42 209 65C237 99 173 130 127 138Z" />
      <path d="M131 142C164 125 208 151 189 182C173 205 142 171 131 142Z" fill="#d5eee7" />
      <path d="M135 132Q171 104 199 76M138 149Q167 151 179 176" fill="none" stroke="#fffafc" strokeWidth="3" />
    </g>
    <g strokeLinecap="round" strokeLinejoin="round">
      <path d="M115 195Q111 210 107 226M137 195Q141 209 153 221" fill="none" stroke="#efc3a5" strokeWidth="11" />
      <path d="M107 221Q91 222 95 232Q105 240 117 229Z" fill="#9975b8" />
      <path d="M150 217Q159 214 167 226Q158 234 148 226Z" fill="#9975b8" />
      <path d="M110 144Q91 151 81 170M139 143Q164 131 184 116" fill="none" stroke="#f5cfaf" strokeWidth="12" />
      <circle cx="79" cy="171" r="7" fill="#f5cfaf" />
      <path d="M116 119L115 143L134 143L131 119" fill="#f5cfaf" />
      <path d="M111 135Q124 146 138 135L143 165Q148 183 162 195Q145 208 125 199Q109 211 89 197Q106 176 108 162Z" fill="#bc91d6" stroke="#9473b4" strokeWidth="3" />
      <path d="M124 161Q111 183 111 203M129 162Q137 181 146 202" fill="none" stroke="#dbc0ed" strokeWidth="3" />
      <path d="M126 145L129 152L137 153L131 158L132 166L126 162L119 166L121 158L115 153L123 152Z" fill="#ffe2a0" />
      <path d="M98 94L83 89Q81 105 101 110M149 94L164 89Q170 105 149 110" fill="#f5cfaf" stroke="#ddb196" strokeWidth="2" />
      <circle cx="135" cy="51" r="20" fill="#856065" />
      <path d="M123 43Q142 34 147 53" fill="none" stroke="#a77b7a" strokeWidth="4" />
      <circle cx="124" cy="96" r="31" fill="#f5cfaf" />
      <path d="M93 97C84 67 110 55 131 64C159 63 169 80 153 101L150 86Q131 92 116 77Q107 93 93 97Z" fill="#856065" />
      <path d="M97 80Q106 67 117 67" fill="none" stroke="#a77b7a" strokeWidth="4" />
      <circle cx="112" cy="98" r="3" fill="#57484f" /><circle cx="136" cy="98" r="3" fill="#57484f" />
      <circle cx="104" cy="108" r="5" fill="#eaa0a1" fillOpacity=".7" /><circle cx="144" cy="108" r="5" fill="#eaa0a1" fillOpacity=".7" />
      <path d="M116 110Q124 118 133 109" fill="none" stroke="#a56570" strokeWidth="2.5" />
      <g fill="#d4eee0"><circle cx="151" cy="64" r="6" /><circle cx="158" cy="70" r="6" /><circle cx="150" cy="76" r="6" /></g>
      <circle cx="151" cy="70" r="4" fill="#f6d47b" />
      <path d="M177 132L218 52" fill="none" stroke="#9c74b7" strokeWidth="6" />
      <circle cx="185" cy="116" r="6" fill="#f5cfaf" />
      <g className="fairy-wand-star">
        <path d="M219 25L225 43L244 49L227 58L226 78L212 65L192 69L201 51L192 35L211 38Z" fill="#f8d16a" stroke="#fff3bd" strokeWidth="3" />
        <path d="M220 39L224 49L232 51L222 55L220 63L215 55L206 53L216 49Z" fill="#fff9db" />
      </g>
    </g>
  </svg>;
}

function FairyStage() {
  return <div className="fairy-scene">
    <div className="fairy-flight"><FairyWithWand /></div>
    {Array.from({ length: 64 }, (_, index) => <i className="fairy-spark" key={index} style={{ '--spark-x': `${(index * 37) % 100}%`, '--spark-y': `${12 + (index * 23) % 75}%`, '--spark-delay': `${((index * 37) % 100) * 8}ms`, '--spark-color': ['#c28cdd', '#e8b72d', '#74bda9', '#ed9aa9'][index % 4], '--spark-size': `${15 + index % 4 * 7}px` } as CSSProperties}>✦</i>)}
  </div>;
}

function FairyCover() {
  return <div className="fairy-cover"><span>✧</span><i>✦</i><b>✦</b></div>;
}

export const fairyEffect: RevealEffect = {
  id: 'fairy', name: 'Fairy dust', description: 'A smiling fairy flutters past with her star wand, turning the covers into twinkling stardust.',
  durationMs: 3200, sound: 'fairy', Stage: FairyStage, Cover: FairyCover,
};
