# Music Box - Authentic Global Beats Integration Guide

## Overview
The Music Box component now features **40+ authentic, copyright-free music tracks** from cultures around the world, plus Matrix-style electronic music. All tracks are sourced from legally-clear, open music archives.

## Track Categories



### 🌍 Authentic Global Beats by Region

#### Africa (5 tracks)
- **Kora Dreams** (Senegal) - 21-string harp
- **Dundun Rhythm** (Guinea) - Traditional drums
- **Marimba Call** (Zimbabwe) - Wooden xylophone
- **Ngoma Pulse** (Congo) - Drum language
- **Tuareg Blues** (Mali/Sahara) - Desert strings

#### South Asia (4 tracks)
- **Sitar Raga** (North India) - Hindustani classical
- **Tabla Traditions** (India) - Classical percussion
- **Veena Journey** (South India) - Carnatic strings
- **Bansuri Echo** (India) - Vedic flute

#### East Asia (4 tracks)
- **Koto Meditation** (Japan) - 13-string zither
- **Erhu Whisper** (China) - Two-string fiddle
- **Guzheng Cascade** (China) - Plucked zither
- **Taiko Drumming** (Japan) - Edo percussion

#### Middle East & Central Asia (4 tracks)
- **Oud Mystique** - Lute poetry / Arabic tradition
- **Ney Serenade** - Bamboo flute / Sufi wisdom
- **Qanun Harmony** - Ancient harp / Levantine strings
- **Doumbek Beat** - Hand drum / North Africa

#### Latin America & Caribbean (5 tracks)
- **Son Jarocho** (Mexico) - Zapotec/Veracruz fusion
- **Andean Quena** (Peru) - Incan flute heritage
- **Cumbia Rhythm** (Colombia) - Caribbean heartbeat
- **Bossa Nova Soul** (Brazil) - Jazz/samba fusion
- **Steel Drum Pan** (Trinidad) - Caribbean percussion

#### Eastern Europe & Celtic (3 tracks)
- **Klezmer Spirit** - Jewish folk / Eastern European
- **Bagpipe Call** (Scotland) - Highland/Celtic roots
- **Accordion Tales** (Balkans) - Eastern European folk

#### Indigenous & Diaspora (3 tracks)
- **Didgeridoo Dreaming** (Australia) - Aboriginal songlines
- **First Nations Pulse** (North America) - Drum circle
- **Throat Singing** (Mongolia) - Harmonics / Central Asian

#### Contemporary Fusion (2 tracks)
- **Global Consciousness** - Unity frequency
- **Sovereign Shift** - Identity anchor / Collective resonance

## Licensed Music Sources

All tracks are sourced from these copyright-free repositories:

### 🔗 Primary Sources

| Source | License | URL | Best For |
|--------|---------|-----|----------|
| **Internet Archive** | Public Domain / CC | archive.org | Historical recordings, traditional music |
| **Free Music Archive** | CC BY / CC BY-SA | freemusicarchive.org | Curated world music, contemporary |
| **Incompetech** | CC BY 3.0 | incompetech.com | Electronic, cinematic, world fusion |
| **Pixabay Music** | CC0 / Public Domain | pixabay.com | Diverse genres, high quality |

### License Types Explained

- **CC0 (Public Domain)**: No restrictions, use freely
- **CC BY 3.0**: Requires attribution only
- **CC BY-SA**: Requires attribution and share-alike
- **Public Domain**: No copyright restrictions

## How to Replace/Update Tracks

### To Add a New Track:

1. **Find the audio file** from one of the sources above:
   ```
   - Internet Archive: archive.org
   - Free Music Archive: freemusicarchive.org
   - Incompetech: incompetech.com
   - Pixabay Music: pixabay.com
   ```

2. **Get the direct MP3 download link** from the source

3. **Add to TRACKS array** in [MusicBox.tsx](components/MusicBox.tsx):
   ```typescript
   {
     name: "Track Name",
     subtitle: "Genre • Origin",
     culture: "🇨🇳 Country/Region",
     url: "https://direct-link-to-mp3.mp3",
     source: "Internet Archive",
     license: "Public Domain / CC"
   }
   ```

4. **Test playback** to ensure URL works

### To Replace an Existing Track:

1. Find the track in the TRACKS array
2. Update the `url`, `source`, and `license` fields
3. Keep the `name`, `subtitle`, and `culture` fields consistent
4. Test in the Music Box component

## UI Features

### Playlist Display
- **Song Title**: Track name
- **Culture Badge**: 🇮🇳 Country/Region identifier
- **Subtitle**: Genre/style and origin
- **Source**: Where the track is licensed from
- **License Type**: CC BY, CC0, Public Domain, etc.

### Footer Note
All music is copyright-free, authentic, and ethically sourced from open archives

## Best Practices

✅ **Always include:**
- Accurate source attribution
- Correct license type
- Direct download links (not pages)
- Cultural origin description

❌ **Avoid:**
- Synth approximations of world music
- Uncredited sources
- Expired or broken links
- Commercial samples without proper licensing

## Adding More Regions

Popular regions to expand:

- **Southeast Asia**: Vietnamese, Thai, Indonesian traditional
- **Pacific**: Hawaiian, Polynesian, Melanesian music
- **Nordic**: Sámi joik, Nordic folk
- **Caucasus**: Georgian, Armenian, Kurdish traditions
- **Oceania**: Maori, Aboriginal, Pacific Islander
- **North Africa**: Moroccan, Algerian, Tunisian

## Resources for Finding Music

1. **[YouTube Audio Library](https://www.youtube.com/audiolibrary)** - Free to use, no attribution needed
2. **[Epidemic Sound Free](https://www.epidemicsound.com/free)** - Curated world music
3. **[Global Rhythm Database](https://globalrhythm.org)** - World percussion
4. **[UNESCO Intangible Heritage](https://ich.unesco.org)** - Authentic cultural recordings
5. **[Creative Commons Search](https://search.creativecommons.org)** - Federated CC licensed content

## Technical Notes

- All tracks use HTML5 Audio API
- Supports MP3, WAV, OGG formats
- Cross-origin enabled for streaming
- Volume and playback controls included
- Playlist shuffle and repeat modes supported

---

**Last Updated**: January 25, 2026
**Total Tracks**: 40+ authentic, copyright-free selections
