/* This page only receives a video ID, start time, and per-player message channel.
 * Keep it independent of the app: no storage, roster, or native app commands. */
(() => {
  const params = new URLSearchParams(location.hash.slice(1));
  const videoId = params.get('video') || '';
  const channel = params.get('channel') || '';
  const start = Number(params.get('start') || 0);
  let player;
  let ready = false;
  let parentOrigin;
  let playPending = false;
  let hasPlayed = false;
  const send = (status, code) => {
    if (window.parent === window) return;
    // The initial ready event contains no private data. Later replies use the
    // origin of the parent that supplied our unique channel.
    window.parent.postMessage({ type: 'student-grouper-youtube', channel, status, code }, parentOrigin && parentOrigin !== 'null' ? parentOrigin : '*');
  };
  const play = () => {
    if (!ready) return;
    if (document.visibilityState === 'hidden') { playPending = true; return; }
    playPending = false;
    if (hasPlayed) player.seekTo(start, true);
    player.playVideo();
    hasPlayed = true;
  };
  if (!/^[\w-]{11}$/.test(videoId) || !/^[\w-]{16,80}$/.test(channel) || !Number.isSafeInteger(start) || start < 0 || start > 86400) return;
  window.addEventListener('message', (event) => {
    const message = event.data;
    if (event.source !== window.parent || !message || message.type !== 'student-grouper-youtube-command' || message.channel !== channel) return;
    if (parentOrigin && event.origin !== parentOrigin) return;
    parentOrigin = event.origin;
    if (message.command === 'play') { playPending = true; play(); }
    else if (message.command === 'pause') { playPending = false; if (ready) player.pauseVideo(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (ready) player.pauseVideo();
    } else if (playPending) play();
  });
  window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player('player', {
      width: '100%', height: '100%', videoId,
      host: 'https://www.youtube-nocookie.com',
      playerVars: { autoplay: 0, playsinline: 1, controls: 1, rel: 0, start, origin: location.origin },
      events: {
        onReady: () => { ready = true; send('ready'); if (playPending) play(); },
        onAutoplayBlocked: () => { playPending = false; send('blocked'); },
        onError: (event) => { playPending = false; send('error', event.data); },
        onStateChange: (event) => {
          if (event.data === 1) send('playing');
          else if (event.data === 2) send('paused');
          else if (event.data === 0) send('ended');
        },
      },
    });
  };
  const script = document.createElement('script');
  script.src = 'https://www.youtube.com/iframe_api';
  script.onerror = () => send('error');
  document.head.append(script);
})();
