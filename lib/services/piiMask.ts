// Phone numbers and emails typed by customers are masked before text goes to the AI.
// Stored chat and the inbox keep the original. shortcut: Vietnamese phone formats and plain emails only; names and addresses are not detected.
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const PHONE = /(?<!\d)(?:\+?84|0)(?:[\s.-]?\d){8,10}(?!\d)/g;

export const maskPersonalData = (text: string) => text.replace(EMAIL, '[email]').replace(PHONE, '[SĐT]');
