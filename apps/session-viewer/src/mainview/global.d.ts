// Side-effect CSS imports resolved by Vite at runtime.
declare module '*.css';

// Electrobun's bun-side index pulls in three / @babylonjs/core as ambient
// imports for its WGPU adapter. We don't use either, but TypeScript follows
// the import chain even with skipLibCheck because electrobun ships source
// `.ts` files. Declare them as `any` so type-check passes without paying for
// the full @types packages.
declare module 'three';
declare module '@babylonjs/core';
