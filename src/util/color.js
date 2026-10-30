function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0)
    return {hue: 0, saturation: 0};

  const saturation = lightness > 0.5
    ? delta / (2 - max - min)
    : delta / (max + min);

  let hue;
  if (max === r)
    hue = ((g - b) / delta) % 6;
  else if (max === g)
    hue = (b - r) / delta + 2;
  else
    hue = (r - g) / delta + 4;

  hue *= 60;
  if (hue < 0)
    hue += 360;

  return {hue, saturation};
}

export function averageColor(pixels, rowstride, width, height) {
  let sumR = 0, sumG = 0, sumB = 0, count = 0;
  let allR = 0, allG = 0, allB = 0, all = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * rowstride + x * 4;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];

      allR += r;
      allG += g;
      allB += b;
      all++;

      if (rgbToHsl(r, g, b).saturation > 0.25) {
        sumR += r;
        sumG += g;
        sumB += b;
        count++;
      }
    }
  }

  if (count)
    return [Math.round(sumR / count), Math.round(sumG / count), Math.round(sumB / count)];
  if (all)
    return [Math.round(allR / all), Math.round(allG / all), Math.round(allB / all)];

  return [0, 0, 0];
}
