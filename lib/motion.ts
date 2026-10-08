// Hover/press feedback for the public header and auth buttons: pointer cursor,
// colors ease over 150ms, a press scales to 98%. Motion is off under
// prefers-reduced-motion. Disabled shadcn Buttons already ignore the pointer.
export const pressMotion =
  "cursor-pointer transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
