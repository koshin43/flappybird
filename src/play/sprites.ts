import type { BirdColor, Medal, Sky } from '../game';
import * as art from './art';

/** Turns art into canvases for the renderer and image URLs for the overlays, each made once. */

function toCanvas(b: art.Bitmap): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = b.width;
  canvas.height = b.height;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(b.width, b.height);
  image.data.set(b.data);
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function once<K, V>(make: (key: K) => V): (key: K) => V {
  const made = new Map<K, V>();
  return (key) => {
    if (!made.has(key)) made.set(key, make(key));
    return made.get(key)!;
  };
}

export const skyCanvas = once((kind: Sky) => toCanvas(art.sky(kind)));
export const groundCanvas = once<void, HTMLCanvasElement>(() => toCanvas(art.ground()));
export const lipCanvas = once<void, HTMLCanvasElement>(() => toCanvas(art.pipeLip()));
export const bodyCanvas = once<void, HTMLCanvasElement>(() => toCanvas(art.pipeBody()));
export const birdCanvas = once((key: `${BirdColor} ${number}`) => {
  const [color, frame] = key.split(' ');
  return toCanvas(art.bird(color as BirdColor, Number(frame)));
});

export interface Picture {
  src: string;
  width: number;
  height: number;
}

const picture = (b: art.Bitmap): Picture => ({ src: toCanvas(b).toDataURL(), width: b.width, height: b.height });

export const textPicture = once((key: `${art.Tone} ${string}`) => {
  const [tone, ...words] = key.split(' ');
  return picture(art.text(words.join(' '), tone as art.Tone));
});
export const medalPicture = once((kind: Medal) => picture(art.medal(kind)));
