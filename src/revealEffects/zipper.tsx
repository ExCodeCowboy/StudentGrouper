import type { RevealEffect } from './types';
import './zipper.css';

function ZipperStage() {
  return <div className="rainbow-zip-stage">
    <div className="rainbow-screen-curtain">
      <div className="rainbow-zip-half zip-left"><span>✦</span></div>
      <div className="rainbow-zip-half zip-right"><span>✦</span></div>
      <i className="rainbow-zip-teeth" />
    </div>
    <div className="rainbow-zip-trail" />
    <div className="rainbow-zip-slider"><span>★</span><i /></div>
  </div>;
}
// The screen curtain covers every destination together, so no card cover is needed.
function ZipperCover() { return null; }
export const zipperEffect: RevealEffect = {
  id: 'zipper', name: 'Rainbow zipper', description: 'A giant star zipper opens a rainbow curtain across the whole screen.',
  durationMs: 2200, Stage: ZipperStage, Cover: ZipperCover,
};
