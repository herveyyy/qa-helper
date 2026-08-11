/** Explicit Giya ↔ Livro ERP connection (giya-ai style — not silent cookie reuse). */
export type GiyaErpConnection = {
  connected: true;
  email: string;
  fullName: string;
  baseUrl: string;
  /** Session id from Connect / Desk — also mirrored into the browser cookie jar. */
  sid: string;
  connectedAt: number;
};

export const GIYA_CONNECTION_KEY = "giyaErpConnection";
