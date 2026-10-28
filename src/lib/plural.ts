/** `one` for exactly 1, `many` otherwise (0, 2, ...). */
export const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);
