/** Gộp mọi khoảng trắng liên tiếp thành một dấu cách và cắt hai đầu. */
export const collapseSpaces = (value: string): string => value.replace(/\s+/g, ' ').trim();
