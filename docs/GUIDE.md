# From AI Video to Audio-Reactive Shader Music Video Maker

Oct 11, 2026 · @Don Hughes

> **Alpha.** Timewarp is an early release, and two people have tested it so far, so expect rough edges. If a render or upload goes wrong, please [open an issue on GitHub](https://github.com/hughesdo/Timewarp-Visualizer/issues) with your browser, OS and what happened.

## What this is

Don gave Claude a 30-second AI-generated music video and one long message. In about an hour, Claude turned it into a single web page that makes a new music video from any song you give it.

Claude watched the video frame by frame, split it into its different looks, and rebuilt each look as a shader: a small program that draws pictures on your graphics card. The page analyzes your song, cuts between those shaders on the beat, and saves the result as a video file with your song as the soundtrack.

Three things came out of the session:

- **The web page, Timewarp Visualizer.** Load a song, press play, and it runs 12 scenes that react to the music, then exports an MP4. It is one HTML file of about 885 KB that runs offline, and it's also online as a live page.

- **The shader source code.** All 12 scenes plus the transition and glow effects, in the repo's `shaders` folder with a readme.

- **A repeatable method.** This document. You can follow it with your own video, either from scratch or by reusing this page as the engine.

## Words you'll see

You don't need to know any of this to use the page. It helps when you talk to Claude about building your own.

| Word             | What it means in plain English                                                                                                       |
|------------------|--------------------------------------------------------------------------------------------------------------------------------------|
| Prompt           | The message you type to Claude. A good one says what you want at the end, not how to build it.                                       |
| Shader           | A small program that colors every pixel on screen, many times a second, on your graphics card. Each scene in the page is one shader. |
| GLSL             | The programming language shaders are written in. It is the same language Shadertoy uses.                                             |
| WebGL            | The part of your web browser that runs shaders.                                                                                      |
| Audio-reactive   | The picture changes with the music: it pulses on the bass, sparkles on the cymbals, and so on.                                       |
| Frequency bands  | Slices of the sound from low to high. Bass is the deep thump, mids are vocals and guitars, highs are cymbals and hiss.               |
| Kick, snare, hat | The three main drum hits. Kick is the low thump, snare is the crack, hi-hat is the tick. The page detects each one.                  |
| BPM              | Beats per minute, the tempo of the song.                                                                                             |
| Bar              | A group of 4 beats. Cuts in the page land on bar lines, the way a human editor would cut.                                            |
| Section change   | The point where a song shifts, such as verse into chorus or a drop.                                                                  |
| Transition       | The effect between two scenes, such as a white flash or a wipe.                                                                      |
| Render or export | Making the final video file.                                                                                                         |
| MP4              | The common video file format that plays almost everywhere.                                                                           |
| HTML file        | A web page saved as a file. Double-click it and it opens in your browser.                                                            |
| Artifact         | A web page Claude publishes for you on claude.ai, with a link you can share.                                                         |

## The starting prompt

The whole build came from one message with the video attached. Don attached the MP4 file to the chat (the paperclip, or drag the file into the message box) and typed this. It is copied exactly, typos and all, because spelling didn't matter. The ideas did.

are you ready for another audio reactive video into a shader pipeline? This one will have multiple different shaders in it. You'll have to decide where to break the video down into the different shaders. The end intention here is that we have a audio reactive shader webpage that can be recorded and reused to all the users own music and create a video of the muxed shaders and audio. Don't depend on the audio in this video. Assume the shaders are audio reactive on different frequncies from the user own audio music file input. The end goal is multiple audio reactive shaders that change automatcally after having rendern one for a random amount of time. Perhaps mix it up via music change and the shaders can be reused in the video. We should use and or reuse each individial shader you create into any one music file rendering. The final web page should also allow the user to record his or her music video as output. please look at the video in details create shaders as you see fit from it's rendering. I assume you'll need to break the video down into segments of different shaders.

The attached video was a 29.8-second MP4, 1598 by 1080 pixels at about 60 frames per second, 23 MB, with its own soundtrack.

### Why it worked

The message described the finished result and the rules, then left the method to Claude. Each sentence pinned down one requirement:

| What Don wrote                                                                         | What it told Claude                                                |
|----------------------------------------------------------------------------------------|--------------------------------------------------------------------|
| "multiple different shaders" and "you'll have to decide where to break the video down" | Split the video into looks yourself; don't make one shader.        |
| "a webpage that can be recorded and reused" with "the users own music"                 | The deliverable is a reusable tool, not a one-off video.           |
| "Don't depend on the audio in this video"                                              | Copy the visuals only. The music will always come from the user.   |
| "audio reactive on different frequencies"                                              | Different parts of the picture should follow bass, mids and highs. |
| "change automatically after a random amount of time" and "mix it up via music change"  | Switch scenes on a timer and when the song changes section.        |
| "use and or reuse each individual shader"                                              | Every shader must appear in every video, and repeats are allowed.  |
| "allow the user to record"                                                             | Video export is part of the job.                                   |
| "look at the video in detail"                                                          | Study the frames closely rather than guessing from a summary.      |

The word "another" also mattered. Don had done single-shader versions of this before, so Claude could treat it as the next step up rather than a first experiment.

### The follow-up messages

After the page was built, Don sent two short follow-ups. Neither changed the build.

- "perfect can we publish that as a artifact to share?" Claude had already published it as a private artifact and explained that sharing is turned on from the page's Share menu.

- "so does this render the video to the music provided?" Claude confirmed that the loaded song drives the analysis, the edit, the reactions, and the soundtrack of the exported video, start to finish.

## What Claude did, step by step

Claude worked in its own cloud workspace, a private computer where it can run programs. Don didn't have to install anything. These are the steps in order.

1.  **Read the file's details.** A video tool called ffmpeg reported the length, size, frame rate and the fact that it had a soundtrack, which Claude then ignored as asked.

2.  **Hunted for the cuts automatically.** ffmpeg's scene-change detector flagged about 90 moments where the picture jumped. Many were flashes and glitches inside a scene, not real scene changes, so the numbers alone weren't enough.

3.  **Made contact sheets.** Claude pulled frames into grids so it could see the whole video at once:

    - One frame every half second, 60 frames on two sheets, for the overall shape.

    - One frame every 0.2 seconds with the time stamped on each, five sheets, to pin down exact times.

    - About 20 full-size frames, one per distinct look, to study details like the Roman numerals, the waterfall streaks and the light rays.

4.  **Separated scenes from effects.** This was the key judgment. A scene is a look that holds for a while, such as the clock mandala or the waterfall. An effect lasts a few frames, such as a white flash, a light bar, a red lens flare or a glitch. Scenes became the 12 shaders. Effects became transitions and hit effects that can go on top of any scene.

5.  **Posted the breakdown before writing code.** Claude sent Don the list of 12 scenes with their timestamps and the list of effects, so he could correct it early. The full breakdown is in the next section.

6.  **Built shared building blocks first.** Several scenes reuse the same pieces, so Claude wrote them once:

    - A clock drawer, with Roman numerals built from straight strokes (I, V and X are all lines) using thick and thin strokes like an antique dial, plus ticks, rings, arrow-tipped hands and a glow.

    - The holographic filament streak, made of 30 thin strands that bulge around the clock.

    - Crystal shard fans, noise patterns, star fields, and a sheet of handwritten math formulas used as a texture.

7.  **Wrote each scene, then checked it against the source.** For every shader, Claude rendered a still image in a hidden browser and put it next to the matching frame from the video. Some of the fixes this caught:

    - The filament streak first looked like a flat rainbow ribbon. Claude switched to a pink, gold, cyan and violet holographic palette and made the strands bulge around the clock.

    - The waterfall was too pink with far too many droplets. It got darker violet streaks, sparse droplets, and twin columns that spread into a bell over time, as in the source.

    - The chalk formulas came out upside down. A texture setting fixed it.

    - A thin seam line showed on the left side of the circular scenes. Claude changed how the noise wraps around the circle.

    - The Ink Negative scene came out blue instead of black ink on paper. Claude removed the glow causing it.

    - The small satellite clocks were too colorful. They became mostly cream with a soft blue halo, like the source.

8.  **Built the engine around the shaders.** This covered the song analyzer, the automatic editor that plans the cuts, the transitions and hit effects, the glow, the controls, and the two ways to export. Section 6 explains how these work.

9.  **Tested the whole page.** Claude generated a test beat at a known 124 BPM, with 4 deliberate section changes, then checked:

    - The analyzer measured 124.1 BPM and found all 4 section changes.

    - The planned edit used all 12 scenes across 13 cuts.

    - A 3-second test export produced a real MP4 with 90 frames of video and the audio track, checked with ffprobe.

    - Real-time recording captured both picture and sound.

    - The layout worked at phone width without sideways scrolling.

10. **Published and delivered.** Claude published the page as an artifact and sent the single HTML file plus a zip of the shader source.

## The breakdown

The 30-second video turned into 12 scenes, 8 transitions plus the hard cut, and 12 hit effects. Times below are where each look appears in the source video. The page numbers its scenes I to XII, like a clock face.

### The 12 scenes

| \#   | Scene              | In the source                                                        | What it looks like                                                                                                                | What the music drives                                                                                                             |
|------|--------------------|----------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| I    | Chrono Mandala     | 0:00 to 0:01.8, 0:13.8 to 0:15.3, 0:19.2 to 0:20.7, 0:25.6 to 0:29.8 | Ornate Roman-numeral clock with ornamental rings, 16 smaller clocks around it, a holographic filament streak and crystal shards   | Kick punches the zoom, bass brightens the dial and streak, highs make the strands shimmer, snares nudge the hands                 |
| II   | Portal Falls       | 0:02.0 to 0:04.9, 0:07.6 to 0:08.8                                   | Black dome portal with swirling wings, twin neon pink and cyan waterfall curtains that spread into a bell, cyan splash            | Bass raises the splash and spreads the curtains, mids speed the flow, highs light streaks and droplets, kick flashes the dome rim |
| III  | Clock Tunnel       | 0:06.2 to 0:07.2                                                     | Flying through a tunnel lined with clocks, colored warp-speed lines, rainbow lens rings                                           | Bass speeds the flight, snare fires white speed wedges, highs brighten the lines                                                  |
| IV   | Equation Nebula    | 0:08.8 to 0:11.0                                                     | Blue nebula, chalk formulas that write themselves, a distant waterfall over a lake with its reflection, a moon with an orbit ring | Highs make the chalk glow, snare pulses the big blurred formulas, bass widens the light beam and mist                             |
| V    | Twin Lenses        | 0:11.3 to 0:13.1                                                     | Two chrome lenses with spinning galaxies inside and mirror-smear echoes to the sides. An abstract take on the goggle-cat shot     | Bass pulses the lenses and galaxy cores, mids spin the galaxies and brighten the echoes, hats fire streaks                        |
| VI   | Ink Negative       | 0:13.2 to 0:13.7                                                     | The mandala as black ink on white paper, mirrored at the edges, with slice glitches                                               | Hats trigger the slices, kick punches, highs light the glare                                                                      |
| VII  | Clock Vortex       | 0:15.3 to 0:16.1, 0:18.0 to 0:19.2                                   | Indigo spiral vortex with clocks spiraling inward, crystal shard fans, a pink arc                                                 | Overall loudness drives the spin, low-mids light the folds, bass grows the shards                                                 |
| VIII | Starburst          | 0:16.9 to 0:17.6                                                     | Radial light rays from a cluster of small clocks                                                                                  | Bass extends the rays, kick flares the core, highs flicker the fine rays                                                          |
| IX   | Eclipse Ring       | 0:21.3 to 0:22.9                                                     | Glowing peach ring around a teal-rimmed clock, faint chalk behind                                                                 | Bass brightens and grows the ring, highs drive the wisps around it                                                                |
| X    | Eclipse Tiles      | 0:20.8 to 0:21.3                                                     | Kaleidoscope columns of eclipse clocks, cyan at the sides, orange in the middle                                                   | Loudness scrolls the columns, kick pulses the brightness                                                                          |
| XI   | Chalkboard Mandala | 0:22.9 to 0:26.6                                                     | The mandala over a blackboard of formulas and chalk geometry, with a color-split edge                                             | Highs light the chalk, snare pulses the giant blurred formulas, kick adds color split                                             |
| XII  | LED Spectrum       | 0:17.6 to 0:18.0                                                     | Dot-matrix LED screen showing a 48-bar spectrum analyzer and clocks                                                               | The bars are the live spectrum of your song, bass pulses the clocks                                                               |

Every scene also has random variations, such as a mirrored layout or a different starting pose, so a repeat later in the video doesn't look identical.

### The transitions

These play between scenes. Big ones go on section changes, quick ones on ordinary cuts.

| Transition            | Seen in the source at    | What it does                                                         |
|-----------------------|--------------------------|----------------------------------------------------------------------|
| Flash                 | 0:01.0, 0:26.8           | Fades through white                                                  |
| Lens flare burst      | 0:00.4, 0:05.0           | Red wash with a green streak and a hot star                          |
| Zoom blur             | 0:05.4                   | Rushes toward the center while crossfading                           |
| Light-bar wipe        | 0:07.2, 0:27.0 to 0:28.6 | A cream-white bar sweeps across and reveals the next scene behind it |
| LED pixel dissolve    | 0:06.0                   | The picture becomes LED dots that swap over cell by cell             |
| Glitch slices         | 0:19.4 to 0:19.8         | Horizontal bands jump and switch, with color split                   |
| Curved-screen squeeze | 0:11.2                   | The picture bends onto a curved panel and back                       |
| Vertical smear        | 0:01.8                   | A streaky smear crossfade                                            |
| Hard cut              | throughout               | A straight cut                                                       |

### The hit effects

These fire inside a scene, timed to drum hits. The "Hit effects" slider controls how often.

- **On snares:** light bars, vertical, diagonal or horizontal, sometimes two crossing.

- **On strong kicks:** lens flare, zoom punch, color split (RGB split), white flash.

- **On hi-hats:** slice glitch.

- **On bar lines, held for a beat or two:** LED matrix look, edge neon (outlines only, seen at 0:20.0), invert to negative, mirror echo, white wash (0:26.8), lightning bolt (0:16.4).

## How the finished page works

The page does its thinking before you press Play. It studies the whole song once, plans the full edit, then draws every frame from that plan.

![How the page turns a song into a video](how-it-works.png)

how the page turns a song into a video · 5 steps

Everything after step 2 reads from the analysis, so the preview and the exported video always match.

**Listening.** When you load a song, the page measures it 100 times a second. It tracks how loud the bass, low-mids, mids, highs and very highs are, and marks every kick, snare and hi-hat hit. It works out the tempo, where each beat and bar line falls, and where the song changes section. All of this is scaled to your song, so a quiet acoustic track moves the picture as much as a loud club track.

**Editing.** The page plans the whole video like an editor would. Every section change gets a new scene with a big transition such as a flash or a lens flare. Between those, scenes run for random lengths between your Shortest and Longest settings and change on bar lines. Scenes are dealt like a shuffled deck, so all 12 appear before any repeats and the same scene never plays twice in a row. Light bars, flares and glitches are placed on the strongest drum hits.

**Drawing.** For each frame, the page runs the current scene's shader with that instant's music values. During a transition it runs both scenes and blends them. Then it adds any hit effects, a glow around bright areas, a soft vignette and a touch of film grain.

**Saving.** The frame-perfect render repeats the drawing step for every frame of the song, in order, and packs the frames together with your song into an MP4. Real-time recording simply captures the screen and sound while the song plays.

## Using the page

Open the page in Chrome or Edge, load a song, press Play, then Render. You can use the [live page](https://hughesdo.github.io/Timewarp-Visualizer/), or download timewarp.html and double-click it to open.

1.  **Load your song.** The page opens waiting for one. Click "Load audio file", or drag the file onto the preview. MP3, WAV, M4A, AAC, OGG, FLAC and Opus all work. The analysis takes a few seconds. Play and Render stay off until a song is loaded.

2.  **Preview.** Press Play or the space bar. Left and right arrows jump 5 seconds. Click or drag on the colored timeline to jump anywhere.

3.  **Adjust,** if you want, with the controls below. Every change replans the edit instantly.

4.  **Export.** Pick a size and click "Render MP4 (frame-perfect)". When it finishes, click "Save video".

### Reading the timeline

Each colored block is one scene, labeled with its Roman numeral. Peach vertical lines mark where the music changes section. The small triangles above are cuts: peach for big transitions, white for quick ones. Hover to see the time and scene name.

### The controls

| Control                                     | What it does                                                                                                              |
|---------------------------------------------|---------------------------------------------------------------------------------------------------------------------------|
| Scenes list: switch                         | Removes a scene from the edit. At least one must stay on.                                                                 |
| Scenes list: Solo                           | Previews only that scene, ignoring the edit. Click again to stop.                                                         |
| Shortest scene / Longest scene              | The range for how long each scene runs, in seconds.                                                                       |
| Cut on                                      | Any beat, every bar line (default), or every 2 bars.                                                                      |
| Transitions                                 | Mixed (like the source video), Smooth, or Hard cuts.                                                                      |
| Hit effects                                 | How often light bars, flares and glitches fire, from 0% to 100%.                                                          |
| Audio reactivity                            | How strongly the visuals respond to the music, from 0% to 200%.                                                           |
| Force a scene change when the music changes | Section changes always get a new scene with a big transition.                                                             |
| Match high-energy scenes to loud parts      | Puts the tunnel, LED and starburst scenes in loud stretches and the calm ones in quiet stretches.                         |
| Reshuffle and Seed                          | Each seed number is one particular edit. Same song plus same seed always gives the same video. Reshuffle tries a new one. |
| Size                                        | 720p, 1080p, 1440p and 4K widescreen, 1080x1920 vertical for Reels and Shorts, 1080x1350 portrait, or square.             |
| Frame rate                                  | 30 or 60 frames per second.                                                                                               |
| Bitrate                                     | Video quality, 8 to 80 Mbps. 16 is a good default for 1080p, 40 or more for 4K.                                           |
| Preview quality                             | Draft, Half, High or Full. Lower it if the preview stutters. It doesn't affect the export.                                |

The page remembers your settings in that browser. Hover over any export setting for a short explanation of what it does.

Under the settings, the Export card shows:

- **A size estimate** for the finished file, worked out from the bitrate and the song's length. A small tag appears when the video is past what a free X account can post (2 minutes 20 seconds, or 512 MB). Click a tag for details.
- **What your browser will write**, checked before you render. A cyan dot with "H.264 + AAC · X-ready" means you're set. An amber or red dot means this browser can't make a file X will take, and says why.
- **Posting to X**, a panel that opens with a click and explains X's limits for free and Premium accounts.

### The two ways to export

- **Render MP4 (frame-perfect)** builds every frame one at a time, so nothing is ever dropped, even at 4K. It can run faster or slower than the song depending on your computer. It needs Chrome or Edge. Use this for anything you'll post.

- **Record in real time** plays the song through once and records what's on screen. It works in more browsers, but a slow computer can drop frames, and you should keep the tab in front while it records. Some browsers save these recordings as WebM, which X won't accept.

When the video is ready, the line next to Save video lists its format and size, with a tag saying whether it's X-ready.

"Save video" downloads the file straight to your computer, from the live page or the HTML file.

## Doing it yourself with your own video

You can repeat this with your video in one of two ways. Path A builds everything from scratch, as Don did. Path B hands Claude the finished page and asks it to swap in new scenes from your video. Path B is faster and less likely to go wrong, because the song analysis, editing and export are already built and tested.

### What you need

- **A Claude conversation that can take a video and run code.** This session used Claude with its code workspace, which lets Claude run tools like ffmpeg to look at your video frame by frame. If Claude says it can't open or watch your video, ask it whether it can run code in this chat.

- **Your video.** MP4 is best. 15 to 60 seconds, with clearly different looks, works well. Don's was 30 seconds and 23 MB.

- **Chrome or Edge,** for testing and exporting.

- **A song or two** to test with.

- **Time.** Expect about an hour of Claude working. You can step away while it does.

- **For Path B only:** the timewarp.html file. Don can send it to you.

### Step by step

1.  **Pick and trim your video.** Keep the best 15 to 60 seconds. More distinct looks means more scenes.

2.  **Start a new conversation** and attach the video, with the paperclip or by dragging the file into the message box. For Path B, attach timewarp.html as well.

3.  **Paste one of the prompts below,** or write your own in your own words. Don's original, with its typos, worked fine.

4.  **Check the breakdown.** Claude should send a list of scenes with timestamps before it writes code. Reply with any corrections, for example "merge 3 and 4, they're the same place" or "skip the title card at 0:02".

5.  **Let it work.** It renders test images and compares them to your video as it goes. You don't need to watch.

6.  **Test with your own song.** Open the page, load a song, and watch the whole thing through once.

7.  **Give feedback and repeat.** One or two changes per message works best. The next section has examples.

8.  **Share it.** Ask Claude to publish it as an artifact and to give you the HTML file too. The artifact starts private, so turn on sharing from the page's Share menu before you post the link.

### Prompt for Path A: build from scratch

Copy this, attach your video, and send:

I've attached a short AI-generated music video. Please turn it into a reusable, audio-reactive music video maker that runs in a web browser.  
  
1. Study the video closely, frame by frame. Break it into its distinct looks (scenes), and separate those from short effects like flashes, wipes and glitches. Before writing any code, send me the list of scenes with their timestamps so I can check it.  
  
2. Recreate each scene as its own GLSL shader that matches the look as closely as you can. Check each one against frames from my video and fix what doesn't match.  
  
3. Ignore the audio in my video. The shaders should react to a song the user loads: bass, mids and highs should each drive different parts of the picture, and drum hits should trigger effects.  
  
4. Build one self-contained web page (a single HTML file) that:  
- lets the user load their own song  
- analyzes the whole song first: tempo, beats, bar lines and where the music changes  
- switches scenes automatically on bar lines, after random lengths, and always when the music changes section  
- uses every scene at least once in every video before repeating any  
- uses transitions and effects copied from my video  
- previews in real time and exports an MP4 with the song as the soundtrack  
  
5. Test it, publish it as an artifact I can share, and give me the HTML file too.

### Prompt for Path B: reuse this page as the engine

Attach your video and timewarp.html, then send:

I've attached two files: timewarp.html, a working audio-reactive music video maker, and my own AI-generated music video.  
  
Keep everything about the page that isn't the scenes: the song analysis, the automatic editing, the transitions, the hit effects, the controls and the export. Replace its 12 clock-themed scenes with new scenes based on my video. Use as many scenes as my video has distinct looks.  
  
Study my video frame by frame, break it into its distinct looks, and send me the list with timestamps before you write any shaders. Then write one GLSL shader per look, check each one against frames from my video, and fix what doesn't match. If my video has transitions or effects the page doesn't have yet, add them.  
  
The new scenes should use the same audio inputs as the existing ones (bass, mids, highs, kick, snare, hat) so they react to music the same way. When it works, publish it as an artifact and give me the updated HTML file.

If your video features a character or logo you made yourself, say so in the prompt. Claude won't redraw a character or logo it recognizes as someone else's. That is why the goggle-cat shot in Don's video became the abstract Twin Lenses scene.

## Prompting tips for beginners

Describe the finished thing and the rules it must follow, then let Claude work out how. You don't need technical words. Don's prompt never said FFT, WebGL or beat tracking, and Claude built all three.

### Writing the first message

- **Say what it's for.** "A page anyone can reuse with their own music" leads to a very different build than "make me one video".

- **Say what to ignore.** "Don't depend on the audio in this video" kept Claude from copying the old soundtrack's timing.

- **State the must-haves as rules.** "Use every shader in every video" and "let the user record the result" are easy to check at the end.

- **Ask for a checkpoint.** "Send me the scene list before writing code" lets you fix the plan while it's cheap to change.

- **Ask for testing.** "Check each shader against frames from my video" and "test it" catch problems before you see them.

- **Leave the method open.** Don wrote "create shaders as you see fit". Claude is good at choosing the technique. You're good at judging the result.

- **Spelling doesn't matter.** Clear ideas do.

### Giving feedback while it works

Point at the exact spot and say what's wrong compared to your video. Vague feedback such as "make it better" or "it's off" gives Claude nothing to aim at.

| Instead of                   | Try                                                                                                                                    |
|------------------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| "The waterfall looks wrong." | "In Portal Falls, the water is too pink. In my video at 0:03 it's mostly dark purple with thin pink and cyan streaks."                 |
| "It's too busy."             | "Turn the light bars down, they fire on almost every snare. Once every couple of bars is plenty."                                      |
| "The edit is boring."        | "Scenes run too long in the chorus. Cut every bar there, and every 2 bars in the verses."                                              |
| "Fix the colors."            | "Scene III is too saturated. The source at 0:06.5 is washed out with a white glow."                                                    |
| "It doesn't work."           | "When I click Render MP4 in Chrome on Windows, the bar stays at 0% and the status says 'Render failed: ...'." Paste the exact message. |

A few habits that help:

- **Send screenshots.** A screenshot of the page next to a frame from your video says more than a paragraph.

- **Change one or two things at a time,** so you can tell which change did what.

- **Say what you like too.** "Keep the tunnel exactly as it is" stops Claude from changing it while fixing something else.

- **Ask questions.** "Why does the edit cut there?" or "what does Audio reactivity actually change?" are fair questions, and the answers make your next request better.

- **Ask for a fresh start when it drifts.** If a long conversation gets tangled, ask Claude to summarize where things stand and continue in a new conversation with the files attached.

## Limits and honest notes

This is an alpha release. Two people have tested it on their own computers so far, and its MP4 files have been checked against X's video requirements. How fast it runs on other computers and graphics cards is the main unknown.

- **Speed.** The shaders are fairly heavy. On a decent desktop or gaming laptop they should run smoothly at 1080p. On an older laptop, set Preview quality to Draft. The frame-perfect render is never affected by stutter, it just takes longer.

- **Browsers.** Frame-perfect MP4 needs Chrome or Edge. Other browsers may only offer real-time recording; the Export card tells you what yours can do. Phones aren't a good fit.

- **Video format.** Render MP4 writes H.264 video with AAC-LC audio, the format X asks for. The audio is always AAC: Chrome and Edge on Windows and Mac use their own encoder, and browsers without one (Chrome on Linux, Firefox) use an encoder built into the page. If a browser can't encode H.264, the video falls back to VP9, which plays in VLC and browsers but not on X or QuickTime. The Export card warns you before you render.

- **Audio sync.** The sound sits about 21 ms behind the picture. Every AAC encoder adds this short start-up delay. It's about one frame at 60 fps, below what anyone can see.

- **Real-time recordings.** A slow computer can drop frames. If the browser can only record WebM, some players show no running time for the file.

- **Chalk font.** The handwritten formulas use a free Google font, Caveat. Offline, they fall back to a plain serif font.

- **Look, not copy.** The scenes recreate the style of the source in code. They are not pixel copies of the video, and they move differently.

- **Characters and logos.** Claude won't redraw a recognizable character or logo that belongs to someone else, so the goggle cat became the abstract Twin Lenses. If something in your video is your own creation, tell Claude.

- **Big exports.** A long song at 4K and a high bitrate makes a large file. Keep enough free space, and use 1080p for quick tests.

- **Posting to X.** Free X accounts can post up to 2 minutes 20 seconds and 512 MB. X Premium allows up to 4 hours and 16 GB on the web. These are X's rules, not the page's, and X changes them from time to time; see [help.x.com](https://help.x.com/en/using-x/x-videos).

## For the curious: technical appendix

Skip this unless you want to read or change the code. Everything lives in timewarp.html, with no installs and no server.

### The shader files (in the shaders folder)

Each scene is built by joining common.glsl, any library it uses, and its own scene file, then drawing it across the whole screen.

| File                                                                                                                                                                       | What it holds                                                                                                                                  |
|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------|
| common.glsl                                                                                                                                                                | Shared inputs, noise, shapes, the holographic palette, Roman numerals, the clock drawer, filaments, shards, stars                              |
| mandala_lib.glsl                                                                                                                                                           | The full mandala layout: hero clock, 16 satellite clocks at positions measured from the source, streak and shards. Used by scenes I, VI and XI |
| eclipse_lib.glsl                                                                                                                                                           | The glowing ring with its clock. Used by scenes IX and X                                                                                       |
| scene_mandala, scene_falls, scene_tunnel, scene_nebula, scene_lenses, scene_ink, scene_vortex, scene_starburst, scene_eclipse, scene_tiles, scene_chalk, scene_led (.glsl) | The 12 scenes                                                                                                                                  |
| post.glsl                                                                                                                                                                  | Transitions and hit effects                                                                                                                    |
| bloom.glsl                                                                                                                                                                 | Two levels of glow                                                                                                                             |
| final.glsl                                                                                                                                                                 | Highlight roll-off, vignette, film grain, fade in and out                                                                                      |

### Inputs every scene receives

All audio values run from 0 to 1 and are scaled to each song, so a quiet song still moves the picture.

| Input                                | Meaning                                                                              |
|--------------------------------------|--------------------------------------------------------------------------------------|
| uBass, uLowMid, uMid, uHigh, uTreble | Loudness of 20 to 150 Hz, 150 to 500 Hz, 500 Hz to 2 kHz, 2 to 6 kHz and 6 to 16 kHz |
| uLevel                               | Overall loudness                                                                     |
| uKick, uSnare, uHat                  | Jump to the hit's strength on each drum hit, then fade                               |
| uBeat, uBarPh                        | How far through the current beat and bar, from 0 to 1                                |
| uTime                                | Song time in seconds                                                                 |
| uFlow                                | A clock that runs faster when the music is loud, used for motion                     |
| uSceneT                              | Seconds since this scene started                                                     |
| uSeed, uVar                          | Random values per appearance, used for variations                                    |
| uReact                               | The Audio reactivity slider                                                          |
| uSpec                                | A 64-band spectrum from 30 Hz to 16 kHz, as a texture                                |
| uMath                                | The handwritten formula sheet, as a texture                                          |

### How the song is analyzed

- The song is decoded and mixed to mono, then measured 100 times a second with a 2048-point FFT, which splits sound into frequencies.

- Band levels are converted to decibels, scaled between each song's quiet and loud points, then smoothed with a fast attack and a 0.22-second release.

- Drum hits are found by spectral flux, a sudden rise in energy within each drum's frequency range, compared against a moving average.

- Tempo comes from autocorrelation of the hit pattern. Beats are then placed with a dynamic-programming beat tracker that lets the tempo drift slightly.

- Bar lines are set where kicks and bass land most often, assuming 4 beats per bar.

- Section changes come from comparing the sound of each 16-beat stretch with the stretch before it (a self-similarity novelty curve), plus sudden loudness changes. They are snapped to the nearest bar line.

### How the edit is planned

Section changes become fixed cuts. The gaps between them are split into random lengths between the Shortest and Longest settings, snapped to the chosen grid. If the song is too short for every scene, lengths shrink until all of them fit. Scenes are dealt from a shuffled deck, so all of them appear before any repeats, with no scene twice in a row and similar scenes kept apart. With energy matching on, each scene has an energy rating that is matched to how loud each stretch is. Hit effects are scheduled on the strongest snares, kicks and hats, and longer looks on bar lines, kept clear of transitions.

### How the export works

- **Frame-perfect:** the browser's WebCodecs encoder plus the open-source mp4-muxer library (version 5.2.2, MIT license), which is built into the file. Each frame is rendered at the exact time it belongs to, encoded, and packed with the song into an MP4.

- **Audio for the MP4:** the song is converted to 44.1 or 48 kHz and at most two channels, then encoded as AAC-LC at 192 kbps stereo or 128 kbps mono. Those are the only rates Chrome's Windows encoder accepts. Browsers with no AAC encoder use FFmpeg's AAC encoder, compiled to WebAssembly and built into the page (LGPL-2.1+, with a bridge from @mediabunny/aac-encoder under MPL-2.0; see `vendor/AAC-ENCODER.md`).

- **Real time:** the browser's MediaRecorder captures the canvas and the audio together as the song plays.

Because the analysis is done ahead of time, the preview and the export see the same audio values on every frame. What you preview is what you get.
