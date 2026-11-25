import "dotenv/config";
import { createServer } from "http";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { getToken } from "next-auth/jwt";
import { setIO, retroRoom } from "./src/lib/socket/server";
import { canJoinRetroRoom } from "./src/lib/socket/roomAccess";
import { bootstrapDatabase } from "./src/server/bootstrap";

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";

// Auth.js resolves the absolute URL for sign-in/sign-out redirects from
// AUTH_URL/NEXTAUTH_URL if set, otherwise from the request's Host header
// (trustHost). Behind a reverse proxy (Azure App Service, etc.) that header
// isn't always what you'd expect, which is exactly how "sign out sent me to
// localhost" happens in production. Anchor it to our own APP_URL instead, so
// it's never at the mercy of proxy header forwarding.
process.env.AUTH_URL ??= process.env.APP_URL;

if (!dev) {
  if (!process.env.APP_URL || process.env.APP_URL.includes("localhost")) {
    console.error(
      `\n✖ APP_URL is "${process.env.APP_URL ?? "(unset)"}" in a production run. ` +
        "Every emailed link (magic-link sign-in, invites, mentions) and every auth " +
        "redirect will point at the wrong host. Set APP_URL to this deployment's real " +
        "public URL as an Application Setting before starting the server.\n",
    );
    process.exit(1);
  }
}

/**
 * Drop pages a previous build left in Next's on-disk route cache.
 *
 * Next writes rendered pages to `.next/server/route-cache/` at runtime, keyed
 * only by a hash of the route ("/login/page"), with nothing tying an entry to
 * the build that wrote it. A deploy that copies a new `.next` over the old one
 * without deleting anything (Azure's Zip Deploy does exactly that) leaves
 * those entries in place, and the new build serves them as cache hits: the
 * old login page, linking the old build's CSS, indefinitely.
 *
 * The cache is stamped with the BUILD_ID that filled it; a different build
 * clears it once on startup. Failures are logged, not fatal — a read-only
 * mount (WEBSITE_RUN_FROM_PACKAGE) can't hold a stale cache anyway.
 */
function clearStaleRouteCache() {
  const distDir = join(process.cwd(), ".next");
  const buildIdFile = join(distDir, "BUILD_ID");
  if (!existsSync(buildIdFile)) return;
  const routeCache = join(distDir, "server", "route-cache");
  const stamp = join(routeCache, ".build-id");
  try {
    const buildId = readFileSync(buildIdFile, "utf8").trim();
    const cachedFor = existsSync(stamp) ? readFileSync(stamp, "utf8").trim() : null;
    if (cachedFor === buildId) return;
    rmSync(routeCache, { recursive: true, force: true });
    mkdirSync(routeCache, { recursive: true });
    writeFileSync(stamp, buildId);
    console.log(`[startup] cleared route cache left by ${cachedFor ? `build ${cachedFor}` : "an earlier build"}`);
  } catch (error) {
    console.warn("[startup] could not check the route cache:", error);
  }
}

if (!dev) clearStaleRouteCache();

const secureCookie = (process.env.APP_URL ?? "").startsWith("https://");

const app = next({ dev });
const handle = app.getRequestHandler();

type PresenceEntry = { name: string; sockets: Set<string> };
// retrospectiveId -> userId -> presence entry. Lives only in this one process
// (see the single-instance note in the README's Socket.IO section).
const presenceByRoom = new Map<string, Map<string, PresenceEntry>>();

function broadcastPresence(io: SocketIOServer, retrospectiveId: string) {
  const room = presenceByRoom.get(retrospectiveId);
  const list = room ? [...room.entries()].map(([userId, entry]) => ({ userId, name: entry.name })) : [];
  io.to(retroRoom(retrospectiveId)).emit("presence:update", list);
}

function joinPresence(retrospectiveId: string, userId: string, name: string, socketId: string) {
  let room = presenceByRoom.get(retrospectiveId);
  if (!room) {
    room = new Map();
    presenceByRoom.set(retrospectiveId, room);
  }
  let entry = room.get(userId);
  if (!entry) {
    entry = { name, sockets: new Set() };
    room.set(userId, entry);
  }
  entry.sockets.add(socketId);
}

function leavePresence(retrospectiveId: string, userId: string, socketId: string) {
  const room = presenceByRoom.get(retrospectiveId);
  if (!room) return;
  const entry = room.get(userId);
  if (!entry) return;
  entry.sockets.delete(socketId);
  if (entry.sockets.size === 0) room.delete(userId);
  if (room.size === 0) presenceByRoom.delete(retrospectiveId);
}

// Before anything is served: create or update the schema, and provision the
// first Super Admin on a fresh database. Point this app at an empty Postgres
// and it sets itself up. See src/server/bootstrap.ts.
bootstrapDatabase().then(() => app.prepare()).then(() => {
  const httpServer = createServer((req, res) => handle(req, res));

  const io = new SocketIOServer(httpServer, { path: "/socket.io" });

  // Reject the handshake outright if the connecting browser doesn't have a
  // valid Auth.js session cookie — sockets never accept unauthenticated
  // connections, same as every page behind proxy.ts.
  io.use(async (socket, next) => {
    try {
      const token = await getToken({
        req: { headers: { cookie: socket.handshake.headers.cookie ?? "" } },
        secret: process.env.AUTH_SECRET,
        secureCookie,
      });
      if (!token?.id) {
        next(new Error("Unauthorized"));
        return;
      }
      socket.data.userId = token.id as string;
      socket.data.name = (token.name as string | undefined) ?? "Someone";
      socket.data.rooms = new Set<string>();
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("retro:join", async (retrospectiveId: string) => {
      if (typeof retrospectiveId !== "string" || retrospectiveId.length > 64) return;

      // Positive results are cached for the life of the socket (that is what
      // `socket.data.rooms` already is), so a re-join costs nothing. Negatives
      // are deliberately not cached: a user who has just been added to the
      // project should not stay locked out until they reload. Membership
      // revocation therefore takes effect on the next page load, which is
      // acceptable because these events carry no data of their own.
      if (!socket.data.rooms.has(retrospectiveId)) {
        const allowed = await canJoinRetroRoom(socket.data.userId, retrospectiveId).catch(() => false);
        if (!allowed) {
          socket.emit("retro:denied", { retrospectiveId });
          return;
        }
      }

      socket.join(retroRoom(retrospectiveId));
      socket.data.rooms.add(retrospectiveId);
      joinPresence(retrospectiveId, socket.data.userId, socket.data.name, socket.id);
      broadcastPresence(io, retrospectiveId);
    });

    socket.on("retro:leave", (retrospectiveId: string) => {
      if (typeof retrospectiveId !== "string") return;
      socket.leave(retroRoom(retrospectiveId));
      socket.data.rooms.delete(retrospectiveId);
      leavePresence(retrospectiveId, socket.data.userId, socket.id);
      broadcastPresence(io, retrospectiveId);
    });

    // Relayed, not persisted: live pointer position as a percentage of the
    // sending client's board container, for a Google-Docs-style presence
    // effect. Never touches the database.
    socket.on("cursor:move", (payload: { retrospectiveId?: string; x?: number; y?: number }) => {
      const { retrospectiveId, x, y } = payload ?? {};
      if (typeof retrospectiveId !== "string" || typeof x !== "number" || typeof y !== "number") return;
      // Emitting into a room never required joining it, so without this check
      // anyone signed in could push a cursor carrying their real name onto any
      // board in any company.
      if (!socket.data.rooms.has(retrospectiveId)) return;
      socket.to(retroRoom(retrospectiveId)).emit("cursor:move", {
        userId: socket.data.userId,
        name: socket.data.name,
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
      });
    });

    socket.on("disconnect", () => {
      for (const retrospectiveId of socket.data.rooms ?? []) {
        leavePresence(retrospectiveId, socket.data.userId, socket.id);
        broadcastPresence(io, retrospectiveId);
      }
    });
  });

  setIO(io);

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port} (${dev ? "development" : "production"})`);
  });
});
