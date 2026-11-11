import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { closeDatabase, getDb } from "../server/db";

const configuredAdmin = process.env.LICITAHUB_ADMIN_EMAIL?.trim().toLowerCase();
const requestedEmail = process.argv[2]?.trim().toLowerCase();

if (!configuredAdmin || !requestedEmail || requestedEmail !== configuredAdmin) {
  console.error(
    "Use o e-mail administrativo previamente configurado para este projeto."
  );
  process.exitCode = 1;
} else {
  const prompt = createInterface({ input, output });
  try {
    const confirmation = await prompt.question(
      "A conta já foi criada e o titular foi verificado fora do sistema? Digite PROMOVER SUPERADMIN para confirmar: "
    );
    if (confirmation !== "PROMOVER SUPERADMIN") {
      console.log("Operação cancelada; nenhuma alteração foi feita.");
    } else {
      const [account] = await getDb()
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(eq(users.email, requestedEmail))
        .limit(1);
      if (!account) {
        console.error(
          "Conta não encontrada. Crie e verifique a conta antes de promover o papel."
        );
        process.exitCode = 1;
      } else if (account.role === "superadmin") {
        console.log("A conta já possui o papel de superadmin.");
      } else {
        await getDb()
          .update(users)
          .set({ role: "superadmin", updatedAt: new Date() })
          .where(eq(users.id, account.id));
        console.log(
          "Papel de superadmin concedido à conta administrativa configurada."
        );
      }
    }
  } catch {
    console.error("Não foi possível concluir a promoção administrativa.");
    process.exitCode = 1;
  } finally {
    prompt.close();
    await closeDatabase();
  }
}
