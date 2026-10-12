import QRCode from "qrcode";
import { zipSync } from "fflate";
import { prisma } from "@/lib/prisma";
import { getSession, canAccessTournament } from "@/lib/dal";
import { tableQrUrl } from "@/lib/tables";

// Every table's QR as table_<number>.png in one .zip, for printing a whole venue at once.
// Rendered larger than the on-screen preview so it stays sharp on paper. PNGs are already
// compressed, so they're stored in the zip as-is (level 0).
const PRINT_SIZE = 1024;

export async function GET(_req: Request, ctx: RouteContext<"/admin/tournaments/[id]/tables/download">) {
  const { id } = await ctx.params;

  // Route handlers don't go through the (protected) layout — check access here, like an action.
  const session = await getSession();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  if (!(await canAccessTournament(session.user.id, session.user.role, id))) {
    return new Response("Forbidden", { status: 403 });
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: { name: true, tables: { orderBy: { tableNumber: "asc" } } },
  });
  if (!tournament) return new Response("Not found", { status: 404 });

  const files: Record<string, Uint8Array> = {};
  for (const t of tournament.tables) {
    const png = await QRCode.toBuffer(tableQrUrl(t.qrToken), { width: PRINT_SIZE, margin: 2 });
    files[`table_${t.tableNumber}.png`] = new Uint8Array(png);
  }
  const zip = zipSync(files, { level: 0 });

  const slug = tournament.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const filename = `${slug || "tournament"}-tables-qr.zip`;
  return new Response(Buffer.from(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
