import type { Medal } from '../game';
import type { Tone } from './art';
import css from './Pixels.module.css';
import { medalPicture, textPicture, type Picture } from './sprites';

/** `size`: world pixels per art pixel. */
function Pixels({ picture, size, alt }: { picture: Picture; size: number; alt: string }) {
  return <img className={css.pixels} src={picture.src} alt={alt} style={{ width: `calc(${picture.width * size} * var(--px))` }} />;
}

export function PixelText({ text, size, tone = 'white' }: { text: string; size: number; tone?: Tone }) {
  return <Pixels picture={textPicture(`${tone} ${text}`)} size={size} alt={text} />;
}

export function MedalCoin({ medal }: { medal: Medal }) {
  return <Pixels picture={medalPicture(medal)} size={4} alt={`${medal} medal`} />;
}
