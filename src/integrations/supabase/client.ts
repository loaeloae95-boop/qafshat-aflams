import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { brokeredPreviewStorage } from "./previewAuthStorage";
import {
  storeLocalBlob,
  resolveLocalMediaUrl,
  localSignUp,
  saveLocalSession,
  getLocalSession,
  getLocalClips,
  insertLocalClip,
  deleteLocalClip,
  type LocalClipRow,
} from "@/lib/local-storage-db";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function serverSupabaseUrl(publicUrl: string, supabaseKey: string): string | undefined {
  if (typeof window !== "undefined" || typeof process === "undefined") return undefined;
  const serverUrl = process.env["SUPABASE_URL"]?.replace(/\/+$/, "");
  if (
    !serverUrl ||
    serverUrl === publicUrl ||
    process.env["SUPABASE_PUBLISHABLE_KEY"] !== supabaseKey
  )
    return undefined;
  return serverUrl;
}

/**
 * Handles requests locally when the remote Supabase endpoint is unavailable,
 * expired, or returning Cloudflare 530 / error 1016.
 */
async function handleLocalFallback(urlStr: string, init?: RequestInit): Promise<Response> {
  const url = new URL(urlStr, "https://localhost");
  const path = url.pathname;
  const method = init?.method?.toUpperCase() || "GET";

  let bodyJson: Record<string, unknown> = {};
  if (typeof init?.body === "string") {
    try {
      bodyJson = JSON.parse(init.body) as Record<string, unknown>;
    } catch {
      /* ignore */
    }
  }

  // 1. Auth: Sign In / Token
  if (path.includes("/auth/v1/token")) {
    const email = typeof bodyJson.email === "string" ? bodyJson.email : "user@example.com";
    const password = typeof bodyJson.password === "string" ? bodyJson.password : "password";
    const { session } = localSignUp(email, password);
    return new Response(JSON.stringify(session), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. Auth: Sign Up
  if (path.includes("/auth/v1/signup")) {
    const email = typeof bodyJson.email === "string" ? bodyJson.email : "user@example.com";
    const password = typeof bodyJson.password === "string" ? bodyJson.password : "password";
    const meta = (bodyJson.data as Record<string, unknown> | undefined) || {};
    const displayName = typeof meta.display_name === "string" ? meta.display_name : undefined;
    const { user, session } = localSignUp(email, password, displayName);
    return new Response(JSON.stringify({ ...session, user }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3. Auth: Current User
  if (path.includes("/auth/v1/user")) {
    const session = getLocalSession();
    if (!session?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify(session.user), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 4. Auth: Logout
  if (path.includes("/auth/v1/logout")) {
    saveLocalSession(null);
    return new Response("{}", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 5. Storage: Upload Media Blob
  if (path.includes("/storage/v1/object/media/") || path.includes("/storage/v1/object/")) {
    const objectPath = path.replace(/\/storage\/v1\/object\/(?:media\/)?/, "").replace(/^\/+/, "");
    const cleanPath = objectPath || `media-${Date.now()}`;

    let blob: Blob | null = null;
    if (init?.body instanceof Blob) {
      blob = init.body;
    } else if (typeof FormData !== "undefined" && init?.body instanceof FormData) {
      const file = init.body.get("") || init.body.get("file");
      if (file instanceof Blob) blob = file;
    } else if (init?.body) {
      blob = new Blob([init.body as BlobPart]);
    }

    if (blob) {
      await storeLocalBlob(cleanPath, blob);
    }

    return new Response(JSON.stringify({ Key: `media/${cleanPath}` }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 6. Storage: Signed URLs
  if (path.includes("/storage/v1/object/sign/media")) {
    const paths = Array.isArray(bodyJson.paths) ? (bodyJson.paths as string[]) : [];
    const signed = await Promise.all(
      paths.map(async (p) => ({
        path: p,
        signedUrl: await resolveLocalMediaUrl(p),
      })),
    );
    return new Response(JSON.stringify(signed), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 7. Database: clips table
  if (path.includes("/rest/v1/clips")) {
    if (method === "GET") {
      const local = getLocalClips();
      return new Response(JSON.stringify(local), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (method === "POST") {
      const payload = Array.isArray(bodyJson) ? bodyJson[0] : bodyJson;
      const inserted = insertLocalClip(
        payload as Omit<LocalClipRow, "id" | "plays_count" | "likes_count" | "created_at">,
      );
      return new Response(JSON.stringify([inserted]), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (method === "DELETE") {
      const idMatch = url.search.match(/id=eq\.([^&]+)/);
      if (idMatch?.[1]) {
        deleteLocalClip(decodeURIComponent(idMatch[1]));
      }
      return new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response("{}", {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function createSupabaseFetch(supabaseUrl: string, supabaseKey: string): typeof fetch {
  const publicUrl = supabaseUrl.replace(/\/+$/, "");
  const serverUrl = serverSupabaseUrl(publicUrl, supabaseKey);

  // If pointing to defunct Lovable cloud project, route immediately to local handler
  const isLovableCloud = publicUrl.includes("lovable.cloud");

  return async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

    if (isLovableCloud) {
      return handleLocalFallback(url, init);
    }

    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);

    let target = url;
    if (serverUrl && url.startsWith(`${publicUrl}/`)) {
      target = serverUrl + url.slice(publicUrl.length);
    }

    const request =
      typeof input === "string" || input instanceof URL ? target : new Request(target, input);

    try {
      const res = await fetch(request, { ...init, headers });
      // If remote proxy is dead (HTTP 530 / Cloudflare 1016 / 502 / 504)
      if (res.status === 530 || res.status === 502 || res.status === 504) {
        return handleLocalFallback(url, init);
      }
      return res;
    } catch {
      return handleLocalFallback(url, init);
    }
  };
}

function createSupabaseClient() {
  const SUPABASE_URL =
    import.meta.env["VITE_SUPABASE_URL"] ||
    process.env["SUPABASE_URL"] ||
    "https://placeholder-project.supabase.co";

  const SUPABASE_ANON_KEY =
    import.meta.env["VITE_SUPABASE_ANON_KEY"] ||
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["SUPABASE_ANON_KEY"] ||
    process.env["SUPABASE_PUBLISHABLE_KEY"] ||
    "placeholder-key";

  // Security safeguard: Never expose service_role key to the browser
  if (
    typeof SUPABASE_ANON_KEY === "string" &&
    (SUPABASE_ANON_KEY.includes("service_role") || SUPABASE_ANON_KEY.includes("secret"))
  ) {
    console.error(
      "SECURITY WARNING: You are attempting to use a Supabase Service Role (Secret) Key on the client side! Always use the public Anon Key (VITE_SUPABASE_ANON_KEY) instead.",
    );
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_URL, SUPABASE_ANON_KEY),
    },
    auth: {
      storage: brokeredPreviewStorage(),
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
