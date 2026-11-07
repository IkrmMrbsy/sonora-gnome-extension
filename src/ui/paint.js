import Cairo from 'gi://cairo';

// Cairo helpers shared by the pill and the card. They only need a drawing
// context, so they carry no widget state.

// HiDPI: a drawing area reports logical pixels while its surface is scaled.
export function surfaceScale(area, width) {
  const [surfaceWidth] = area.get_surface_size();
  return surfaceWidth && width ? surfaceWidth / width : 1;
}

export function drawRadialTint(cr, width, height, rgb, {
  scale = 1,
  originX = 0.11,
  originY = 0.17,
  radiusFactor = 0.62,
} = {}) {
  const [r, g, b] = rgb;
  const cx = width * originX * scale;
  const cy = height * originY * scale;
  const radius = Math.max(width, height) * radiusFactor * scale;

  const gradient = new Cairo.RadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStopRGBA(0, r / 255, g / 255, b / 255, 0.50);
  gradient.addColorStopRGBA(0.55, r / 255, g / 255, b / 255, 0.16);
  gradient.addColorStopRGBA(1, r / 255, g / 255, b / 255, 0);
  cr.setSource(gradient);
  cr.paint();
}

export function drawArrow(cr, {
  width,
  height,
  rgb,
  scale = 1,
  background = [13, 13, 18],
}) {
  const [r, g, b] = rgb;
  const [br, bg, bb] = background;
  const w = width * scale;
  const h = height * scale;

  cr.moveTo(0, h);
  cr.lineTo(w / 2, 0);
  cr.lineTo(w, h);
  cr.closePath();
  cr.setSourceRGBA(br / 255, bg / 255, bb / 255, 0.94);
  cr.fillPreserve();
  cr.setSourceRGBA(r / 255, g / 255, b / 255, 0.42);
  cr.setLineWidth(1 * scale);
  cr.stroke();
}

export function roundedClip(cr, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  cr.newPath();
  cr.arc(r, r, r, Math.PI, 1.5 * Math.PI);
  cr.arc(width - r, r, r, 1.5 * Math.PI, 2 * Math.PI);
  cr.arc(width - r, height - r, r, 0, 0.5 * Math.PI);
  cr.arc(r, height - r, r, 0.5 * Math.PI, Math.PI);
  cr.closePath();
  cr.clip();
}
