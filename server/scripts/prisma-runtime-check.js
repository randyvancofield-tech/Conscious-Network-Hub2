const { loadServerEnv, logServerEnvDiagnostics } = require('./load-env');

loadServerEnv();
logServerEnvDiagnostics('PRISMA_RUNTIME_CHECK');

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    take: 1,
    select: {
      id: true,
      email: true,
    },
  });
  console.log(`Prisma runtime OK: users=${users.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
