/**
 * Génère les icônes PNG de la PWA avec ImageMagick. Son moteur SVG interne ignore dégradés et
 * rotations : le dessin de public/favicon.svg est donc refait ici avec ses primitives.
 */
import { execFileSync } from 'node:child_process';

const CANVAS = 1024;
const BACKGROUND = '#0b0f1e';
const TILTED = 'translate 512,512 rotate -10';

function render(size: number, name: string, padding = 0): void {
  const inner = size - 2 * padding;
  execFileSync('magick', [
    '-size',
    `${CANVAS}x${CANVAS}`,
    '-define',
    'gradient:angle=135',
    'gradient:#4cc2ff-#ff5d7e',
    '-write',
    'mpr:foil',
    '+delete',
    '-size',
    `${CANVAS}x${CANVAS}`,
    `xc:${BACKGROUND}`,
    '-tile',
    'mpr:foil',
    '-draw',
    `${TILTED} roundrectangle -212,-322 212,322 52,52`,
    '+tile',
    '-fill',
    '#131a30',
    '-draw',
    `${TILTED} roundrectangle -176,-286 176,286 28,28`,
    '-fill',
    'none',
    '-stroke',
    '#ffc94d',
    '-strokewidth',
    '84',
    '-draw',
    'stroke-linecap round line 400,400 624,624',
    '-draw',
    'stroke-linecap round line 624,400 400,624',
    '-resize',
    `${inner}x${inner}`,
    '-background',
    BACKGROUND,
    '-gravity',
    'center',
    '-extent',
    `${size}x${size}`,
    '-depth',
    '8',
    `public/icons/${name}`,
  ]);
}

render(192, 'icon-192.png');
render(512, 'icon-512.png');
// Zone sûre des icônes masquables : le contenu tient dans 80 % de la largeur.
render(512, 'icon-maskable-512.png', 52);
