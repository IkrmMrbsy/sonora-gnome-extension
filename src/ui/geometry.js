export function progressGeometry(rowWidth, currentWidth, durationWidth,
  position, duration, knobWidth = 9) {
  const width = Math.max(0, rowWidth - currentWidth - durationWidth - 16);
  const pct = duration > 0
    ? Math.min(1, Math.max(0, position / duration))
    : 0;
  const fillWidth = Math.round(width * pct);
  const knobX = Math.round(Math.max(0,
    Math.min(width - knobWidth, fillWidth - knobWidth / 2)));
  return {width, fillWidth, knobX};
}

export function clampStatsHeight(natural, min = 160, max = 360) {
  return Math.max(min, Math.min(max, natural));
}
