import Cogl from 'gi://Cogl';
import GdkPixbuf from 'gi://GdkPixbuf?version=2.0';
import GLib from 'gi://GLib';
import St from 'gi://St';

function roundedAlpha(x, y, width, height, radius) {
  const cx = Math.min(Math.max(x + 0.5, radius), width - radius);
  const cy = Math.min(Math.max(y + 0.5, radius), height - radius);
  const dx = x + 0.5 - cx;
  const dy = y + 0.5 - cy;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return Math.max(0, Math.min(1, radius - distance + 0.5));
}

export function pixbufToRGBA(pixbuf, radius = 0) {
  const width = pixbuf.get_width();
  const height = pixbuf.get_height();
  const channels = pixbuf.get_n_channels();
  const stride = pixbuf.get_rowstride();
  const pixels = pixbuf.get_pixels();
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = y * stride + x * channels;
      const dst = (y * width + x) * 4;
      data[dst] = pixels[src];
      data[dst + 1] = pixels[src + 1];
      data[dst + 2] = pixels[src + 2];
      data[dst + 3] = channels === 4 ? pixels[src + 3] : 255;
      if (radius > 0)
        data[dst + 3] *= roundedAlpha(x, y, width, height, radius);
    }
  }

  return {data, width, height, rowstride: width * 4};
}

export function setArtImage(actor, pixbuf, size, radius) {
  if (!pixbuf) {
    actor.set_content(null);
    return;
  }

  const scale = 2;
  const scaled = pixbuf.scale_simple(size * scale, size * scale,
    GdkPixbuf.InterpType.BILINEAR);
  if (!scaled)
    return;

  const rgba = pixbufToRGBA(scaled, radius * scale);
  const content = St.ImageContent.new_with_preferred_size(size, size);
  content.set_bytes(global.stage.context.get_backend().get_cogl_context(),
    new GLib.Bytes(rgba.data), Cogl.PixelFormat.RGBA_8888,
    rgba.width, rgba.height, rgba.rowstride);
  actor.set_content(content);
  actor.set_size(size, size);
}
