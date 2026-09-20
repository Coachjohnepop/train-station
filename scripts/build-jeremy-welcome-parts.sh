#!/bin/bash
# Rebuild landing intro:
#   - logo card at 2x (half duration)
#   - whistle cut after the peak, Jeremy audio fades in over it
#   - Jeremy picture fades in under the logo
#   - part 1 ends at 1:40; part 2 is 1:41–end (READY)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/public/videos/jeremy-welcome-source.mp4"
OUT1="$ROOT/public/videos/jeremy-welcome.mp4"
OUT2="$ROOT/public/videos/jeremy-welcome-ready.mp4"
LIVE="$ROOT/public/videos/jeremy-welcome.mp4"

if [ ! -f "$SRC" ]; then
  cp "$LIVE" "$SRC"
fi

# Original: logo ~0–8.5s, dissolve ~8.5–9.6s, Jeremy from ~9.6s.
# Whistle peaks ~0.75s. Part split at 1:40 / 1:41.
LOGO_END=8.5
JEREMY_IN=9.6
PART1_END=100
PART2_START=101
FADE=0.8
WHISTLE_PEAK=0.75
WHISTLE_FADE=0.7
AUDIO_LEAD=0.8

LOGO_HALF=$(python3 -c "print($LOGO_END / 2)")
FADE_ST=$(python3 -c "print(max(0, $LOGO_HALF - $FADE))")

echo "source=$SRC"
echo "logo 2x → ${LOGO_HALF}s, fade ${FADE_ST}s, Jeremy from ${JEREMY_IN}s, part1 to ${PART1_END}s"

ffmpeg -hide_banner -y -i "$SRC" -filter_complex "
[0:v]trim=0:${LOGO_END},setpts=0.5*(PTS-STARTPTS),format=yuva420p,fade=t=out:st=${FADE_ST}:d=${FADE}:alpha=1[logo];
[0:v]trim=start=${JEREMY_IN}:end=${PART1_END},setpts=PTS-STARTPTS[jer];
[jer][logo]overlay=0:0:eof_action=pass[v];
[0:a]atrim=0:1.55,asetpts=PTS-STARTPTS,afade=t=out:st=${WHISTLE_PEAK}:d=${WHISTLE_FADE}[whistle];
[0:a]atrim=start=${JEREMY_IN}:end=${PART1_END},asetpts=PTS-STARTPTS,afade=t=in:st=${AUDIO_LEAD}:d=0.6[jera];
[whistle][jera]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[a]
" -map "[v]" -map "[a]" \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 128k -ar 48000 -ac 2 \
  -movflags +faststart "$OUT1"

ffmpeg -hide_banner -y -ss "$PART2_START" -i "$SRC" -t 20.2 \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 128k -ar 48000 -ac 2 \
  -movflags +faststart "$OUT2"

echo "--- part1 ---"
ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT1"
echo "--- part2 ---"
ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT2"
ls -lh "$OUT1" "$OUT2" "$SRC"
