import Pango from 'gi://Pango';
import St from 'gi://St';

export function formatClock(seconds) {
  seconds = Math.max(0, Math.round(seconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function formatWeek(seconds) {
  const minutes = Math.max(0, Math.round(seconds / 60));
  if (minutes < 60)
    return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function ellipsize(label) {
  label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
  label.clutter_text.line_wrap = false;
}

export function iconButton(styleClass, iconName, callback, iconSize = 15) {
  const button = new St.Button({
    style_class: styleClass,
    child: new St.Icon({icon_name: iconName, icon_size: iconSize}),
  });
  button.connect('clicked', () => callback());
  return button;
}
