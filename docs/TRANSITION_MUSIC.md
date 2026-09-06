# Built-in transition music

The app offers five rich MP3 recordings and four locally synthesized tunes labeled **(minimal)**. Built-in music can play for 30, 45, 60, 90, or 120 seconds, with a hard two-minute maximum. A recording that is longer than the selected time fades to silence over the final three seconds. Shorter recordings end naturally, without looping or padding with silence. YouTube keeps its own video length.

## Rich recordings

The project owner supplied these Suno-generated MP3s on September 6, 2026 and confirmed having commercial-use rights and permission to include them in the application. This is the owner's rights representation; these recordings are not classified as public domain. The original files are copied without modification.

| App name | Supplied filename | Bundled file | Approximate full length |
| --- | --- | --- | --- |
| Bells | Bell Transition Song.mp3 | `public/music/transitions/bells.mp3` | 2:00 |
| Oboe | Obo Transition.mp3 | `public/music/transitions/oboe.mp3` | 1:58 |
| Strings | Strings Transition.mp3 | `public/music/transitions/strings.mp3` | 1:59 |
| Guitar | Guitar Transition.mp3 | `public/music/transitions/guitar.mp3` | 2:10 |
| Koto | Koto Transition.mp3 | `public/music/transitions/koto.mp3` | 2:09 |

The Mac bundle includes the recordings, so playback needs no external service or internet connection. The browser version retrieves a selected recording from its own app host. The library does not contact Suno or send classroom information. Recordings load on demand and the decoded cache retains only one recording to bound memory use.

`src/transitionMusic.ts` is the shared registry for menus, validation, and audio playback. Existing minimal preference IDs remain unchanged; rich IDs start with `rich-`. Backups store the selected ID and length, without embedding MP3s. Pending downloads are canceled on close; late decoder results cannot start an old selection. The playing countdown uses the decoded file duration and the requested limit.

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

`src/transitionMelodies.ts` defines each minimal tune's phrases, note lengths, harmonies, instrument, key, and forms. The 90- and 120-second options repeat complete forms while retaining a gentle pace. The renderer fits complete phrases into the selected window, with a short lead-in and fade. It never truncates a minimal melody mid-phrase or appends an unrelated chord at a fixed deadline.

The earlier prototype played the same four-chord loop under every melody, which produced clashing notes. Each new melody note has an explicit harmony; accompaniment is quiet, omitted under fast ornaments, and releases before the next melody note. The music-box voice uses integer harmonics instead of the earlier inharmonic 2.76-times-frequency partial.

The original preview preference IDs remain stable: `sunny` → Ode to Joy, `tiptoe` → Au clair de la lune, `starlight` → Twinkle, Twinkle, Little Star, `meadow` → Lavender's Blue. Existing class settings and backups therefore retain a valid tune selection.

Tests cover all twenty minimal tune/duration combinations, finite bounded samples, soft endings, resolved melodic endings, absence of dissonant overlapping intervals in these arrangements, and suppression of the former metallic bell partial. Recording checks cover packaged assets, all rich preference/length backup combinations, the three-second fade, the two-minute cap, natural endings, failed loads, cancellation, and stale decoding. These are objective checks; the teacher's listening preference remains the final judge of tone and pace.
