const bcrypt = require('bcrypt');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
// const { PrismaClient } = require('../src/generated/prisma');

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const admin = {
  username: 'guillaume',
  email: 'guillaume@gmail.com',
  password: 'pass1234',
};

async function main() {
  const passwordHash = await bcrypt.hash(admin.password, 12);
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: admin.email }, { username: admin.username }],
    },
    select: { id: true },
  });

  if (existingUser) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        username: admin.username,
        email: admin.email,
        passwordHash,
        globalRole: 'ADMIN',
        isActive: true,
        isBanned: false,
        profile: {
          upsert: {
            create: {
              displayName: admin.username,
              bio: '',
            },
            update: {
              displayName: admin.username,
            },
          },
        },
      },
    });

    console.log(`Admin user ensured: ${admin.email}`);
    return;
  }

  await prisma.user.create({
    data: {
      username: admin.username,
      email: admin.email,
      passwordHash,
      globalRole: 'ADMIN',
      isActive: true,
      isBanned: false,
      profile: {
        create: {
          displayName: admin.username,
          bio: '',
        },
      },
    },
  });

  console.log(`Admin user created: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error('Failed to ensure admin user:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
