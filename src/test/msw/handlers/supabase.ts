// Node MSW handlers utilisés par vitest setup.
// Les tests unitaires n'émettent aucune requête réseau — ce tableau est vide
// mais le serveur MSW reste actif pour attraper les requêtes non interceptées.

import type { HttpHandler } from "msw";

export const supabaseHandlers: HttpHandler[] = [];
