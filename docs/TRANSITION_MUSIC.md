# Built-in transition music

The app synthesizes four instrumental arrangements locally. It contains no downloaded recordings, sampled performances, lyrics, or runtime requests to the source websites. Each arrangement lasts 30, 45, or 60 seconds.

## Sheet-music sources

Sources and their rights labels were checked on September 6, 2026. The Mutopia editions below explicitly label their notation public domain, including the typeset editions. Project Gutenberg identifies its nursery-song book as public domain in the USA.

| App tune | Source inspected | Use in this app |
| --- | --- | --- |
| Ode to Joy | Beethoven; Peter Chubb's public-domain [Mutopia edition 528](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=528), [score](https://www.mutopiaproject.org/ftp/BeethovenLv/ode/ode-a4.pdf) | Main theme and middle phrase, transposed to C. Shorter versions repeat the closing phrase. |
| Au clair de la lune | Traditional French melody; Felix Horetzky, *60 National Airs*, no. 21; Stan Sanderson's public-domain [Mutopia edition 1111](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1111), [score](https://www.mutopiaproject.org/ftp/HoretzkyF/horetzky21/horetzky21-let.pdf) | Melody transposed to F. Phrase-ending rests are replaced by held melody notes; the shortest version uses the refrain. |
| Twinkle, Twinkle, Little Star | Traditional tune *Ah! vous dirai-je, maman*, in Mozart's variations; Jeffrey Olson's public-domain [Mutopia edition 2236](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2236), [score, theme on pages 7–8](https://www.mutopiaproject.org/ftp/MozartWA/KV265/guitar-duo-complete/guitar-duo-complete-a4.pdf) | Familiar unornamented melody in C; trills omitted and held notes used at phrase endings. The 45-second version repeats the middle section. |
| Lavender's Blue | Lucy Crane's historical arrangement in Walter Crane's *The Baby's Opera*, p. 17; [Project Gutenberg book and rights record](https://www.gutenberg.org/ebooks/25418), [original score image](https://www.gutenberg.org/files/25418/25418-h/images/lavender.jpg), [MusicXML transcription by Linda Cantoni](https://www.gutenberg.org/files/25418/25418-h/music/lavender.xml) | Historical melody in G, retaining its 3/8 rhythm and taking the upper note of melody chords. Two, three, or four complete verses. No modern film/pop arrangement is used. |

The app's quiet root-and-third accompaniments are new arrangements. Only the underlying melodies are transcribed; the sources' complete guitar, piano, and choral accompaniments are not reproduced. Credits are retained here so future changes can be traced to their editions.

## Musical behavior

`src/transitionMelodies.ts` defines each tune's phrases, note lengths, harmonies, instrument, key, and forms for the three durations. The renderer fits complete phrases into the selected window, with a short lead-in and fade. It never truncates a melody mid-phrase or appends an unrelated chord at a fixed deadline.

The earlier prototype played the same four-chord loop under every melody, which produced clashing notes. Each new melody note has an explicit harmony; accompaniment is quiet, omitted under fast ornaments, and releases before the next melody note. The music-box voice uses integer harmonics instead of the earlier inharmonic 2.76-times-frequency partial.

The original preview preference IDs remain stable: `sunny` → Ode to Joy, `tiptoe` → Au clair de la lune, `starlight` → Twinkle, Twinkle, Little Star, `meadow` → Lavender's Blue. Existing class settings and backups therefore retain a valid tune selection.

Tests cover all twelve tune/duration combinations, finite bounded samples, soft endings, resolved melodic endings, absence of dissonant overlapping intervals in these arrangements, and suppression of the former metallic bell partial. These are objective checks; the teacher's listening preference remains the final judge of tone and pace.
