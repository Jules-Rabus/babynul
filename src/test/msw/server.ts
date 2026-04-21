import { setupServer } from "msw/node";
import { supabaseHandlers } from "./handlers/supabase";

export const server = setupServer(...supabaseHandlers);
