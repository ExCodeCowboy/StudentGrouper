import { useId, type CSSProperties } from 'react';
import type { RevealEffect } from './types';
import './dragon.css';

function FriendlyDragon() {
  const id = useId();
  return <svg viewBox="0 0 320 340" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-skin`} x1="0" y1="0" x2=".85" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="#b1e1b7" /><stop offset=".5" stopColor="#82c7a2" /><stop offset="1" stopColor="#65ab8a" /></linearGradient>
      <linearGradient id={`${id}-wing`} x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="#f0e0f3" /><stop offset="1" stopColor="#c5abd9" /></linearGradient>
      <linearGradient id={`${id}-belly`} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="#fff0bd" /><stop offset="1" stopColor="#d8e4b5" /></linearGradient>
      <linearGradient id={`${id}-horn`} x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="#fff0bd" /><stop offset="1" stopColor="#e1b669" /></linearGradient>
      <clipPath id={`${id}-belly-clip`}><ellipse cx="174" cy="271" rx="43" ry="50" /></clipPath>
    </defs>
    <g stroke="#467f6c" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      <g className="dragon-tail">
        <path d="M119 232C86 265 41 249 36 215C18 223 21 254 46 274C72 296 110 285 140 268Z" fill={`url(#${id}-skin)`} />
        <path d="M36 220Q17 207 22 188Q39 190 48 204Z" fill={`url(#${id}-horn)`} stroke="#bb9c62" />
        <path d="M42 262Q68 282 99 269" fill="none" stroke="#a6d7a8" strokeWidth="5" />
      </g>
      <g className="dragon-wing-far" fill={`url(#${id}-wing)`} stroke="#9c87b4">
        <path d="M204 212Q227 165 266 159L262 202Q240 196 230 227Z" />
        <path d="M208 211L254 174L236 213" fill="none" stroke="#b19ac5" strokeWidth="2.5" />
      </g>
      <g className="dragon-wing-near" fill={`url(#${id}-wing)`} stroke="#9c87b4">
        <path d="M130 226Q107 176 55 139Q47 170 54 199Q75 184 86 214Q101 198 111 229Z" />
        <path d="M120 218L62 155L62 190M62 155L86 204M62 155L108 216" fill="none" stroke="#b39ac8" strokeWidth="2.5" />
        <path d="M58 148Q84 166 105 190" fill="none" stroke="#fff5fc" strokeWidth="3" />
      </g>
      <path d="M123 183L107 180L110 200L96 201L102 220L89 225L97 241" fill={`url(#${id}-horn)`} stroke="#bb9c62" />
      <path d="M144 176C113 193 92 224 96 269C97 302 118 322 159 324C198 328 242 317 245 289C246 259 228 224 220 199Z" fill={`url(#${id}-skin)`} />
      <path d="M218 228Q245 224 253 241Q260 258 242 268L224 254" fill="#78b995" />
      <path d="M244 248L250 246M245 257L251 254" fill="none" stroke="#467f6c" strokeWidth="2.5" />
      <ellipse cx="174" cy="271" rx="43" ry="50" fill={`url(#${id}-belly)`} stroke="#9daf7c" strokeWidth="2.5" />
      <g clipPath={`url(#${id}-belly-clip)`} fill="none" stroke="#b7c793" strokeWidth="2.5">
        <path d="M133 244Q176 257 215 243M130 261Q173 275 219 260M130 280Q174 292 219 279M137 299Q175 310 213 296" />
      </g>
      <path d="M141 220Q120 218 119 238Q115 253 134 260L151 261Q166 256 158 244L145 236" fill={`url(#${id}-skin)`} />
      <path d="M134 249L134 256M144 251L146 257" fill="none" strokeWidth="2.5" />
      <path d="M110 303Q98 320 116 327L142 328Q154 323 147 313Q135 299 110 303Z" fill="#82be99" />
      <path d="M195 306Q181 318 193 327L226 327Q244 325 238 314Q222 303 195 306Z" fill="#82be99" />
      <g fill="#fff0ca" stroke="#b4b48a" strokeWidth="1.5">
        <path d="M113 326Q112 316 119 317L124 327M127 327Q126 317 133 318L138 328M200 327Q201 316 208 317L211 327M215 327Q216 316 224 318L228 327" />
      </g>
      <g className="dragon-head">
        <path d="M215 61Q229 35 214 18Q239 23 240 48L235 70" fill={`url(#${id}-horn)`} stroke="#bb9c62" />
        <path d="M133 112Q109 111 103 89Q125 83 146 100" fill="#80c49e" />
        <path d="M116 96L135 105" fill="none" stroke="#b4dfb9" strokeWidth="5" />
        <path d="M131 102C128 63 155 40 190 41C227 39 251 64 253 103L251 130C273 128 292 141 296 157C306 184 286 204 264 206L226 206C208 225 177 223 153 208C131 195 121 173 124 150Z" fill={`url(#${id}-skin)`} />
        <path d="M151 56Q136 38 145 16Q152 33 175 41Q170 51 164 58Z" fill={`url(#${id}-horn)`} stroke="#bb9c62" />
        <path d="M153 41L161 47" fill="none" stroke="#fff4cf" strokeWidth="3" />
        <path d="M146 79Q159 60 181 57" fill="none" stroke="#d4edcb" strokeWidth="5" />
        <g fill="#fffdf1" stroke="#609d80" strokeWidth="2.5">
          <ellipse cx="230" cy="111" rx="15" ry="22" />
          <ellipse cx="179" cy="119" rx="20" ry="27" />
        </g>
        <g fill="#304d48" stroke="none">
          <ellipse cx="236" cy="114" rx="7" ry="12" /><ellipse cx="186" cy="122" rx="9" ry="15" />
          <circle cx="238" cy="109" r="3" fill="#fff" /><circle cx="189" cy="116" r="4" fill="#fff" /><circle cx="183" cy="128" r="2" fill="#b3d7c4" />
        </g>
        <path d="M162 84Q176 75 191 84M220 81Q230 76 239 83" fill="none" strokeWidth="4.5" />
        <path d="M224 145Q249 131 275 145Q294 154 296 169" fill="none" stroke="#c5e5b9" strokeWidth="6" />
        <ellipse cx="167" cy="169" rx="17" ry="11" fill="#efaeb0" fillOpacity=".85" stroke="none" />
        <g fill="#629e7d" stroke="none"><circle cx="148" cy="155" r="3" /><circle cx="157" cy="150" r="2.5" /><circle cx="165" cy="153" r="2" /></g>
        <ellipse cx="274" cy="156" rx="4" ry="3.5" fill="#4e8a72" stroke="none" />
        <g className="dragon-mouth">
          <path d="M216 181Q239 194 264 183C267 172 280 168 288 174C302 183 291 198 277 195Q271 194 265 191Q235 204 216 181Z" fill="#36584c" stroke="#4c846c" strokeWidth="2.5" />
          <path d="M240 190L243 197Q246 199 249 190" fill="#fff9dc" stroke="none" />
          <path d="M276 189Q283 183 289 189" fill="none" stroke="#d79b9e" strokeWidth="3" />
        </g>
      </g>
      <g fill="#a7d4ad" stroke="#68a486" strokeWidth="1.5"><path d="M108 268Q112 260 117 268Q112 274 108 268ZM113 281Q118 273 122 281Q118 287 113 281ZM223 283Q228 275 232 283Q228 289 223 283Z" /></g>
    </g>
  </svg>;
}

function DragonStage() {
  return <div className="dragon-reveal-scene">
    <div className="dragon-reveal-pal">
      <FriendlyDragon />
      <span className="dragon-hiccup">hic!</span>
    </div>
    {Array.from({ length: 32 }, (_, index) => <i className="dragon-bubble" key={index} style={{ '--bubble-x': `${25 + (index * 29) % 80}vw`, '--bubble-y': `${-15 - (index * 17) % 65}vh`, '--bubble-size': `${25 + index % 5 * 14}px`, '--bubble-delay': `${index % 8 * 80}ms`, '--bubble-color': ['#b1ddc9', '#d7c2ed', '#eed191', '#9fd8e4'][index % 4] } as CSSProperties} />)}
  </div>;
}

function DragonCover() { return <div className="dragon-bubble-cover"><span>?</span><i /><i /><i /></div>; }

export const dragonEffect: RevealEffect = {
  id: 'dragon', name: 'Dragon hiccup', description: 'A friendly little dragon hiccups a stream of rainbow bubbles that pop the covers open.',
  durationMs: 2800, sound: 'dragon', Stage: DragonStage, Cover: DragonCover,
};
