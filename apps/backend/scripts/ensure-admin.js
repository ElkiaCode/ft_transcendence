const bcrypt = require('bcrypt');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

let prisma;

function getAdminConfig() {
  const admin = {
    username: process.env.ADMIN_USERNAME?.trim() ?? '',
    email: process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? '',
    password: process.env.ADMIN_PASSWORD ?? '',
  };

  const configuredValues = Object.values(admin).filter(Boolean).length;

  if (configuredValues === 0) {
    return null;
  }

  if (configuredValues !== 3) {
    throw new Error(
      'ADMIN_USERNAME, ADMIN_EMAIL and ADMIN_PASSWORD must all be configured',
    );
  }

  if (!/^[a-zA-Z0-9_]{3,30}$/.test(admin.username)) {
    throw new Error(
      'ADMIN_USERNAME must contain 3 to 30 letters, numbers or underscores',
    );
  }

  if (
    admin.email.length > 255 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin.email)
  ) {
    throw new Error('ADMIN_EMAIL must be a valid email address');
  }

  if (admin.password.length < 8 || admin.password.length > 72) {
    throw new Error('ADMIN_PASSWORD must contain between 8 and 72 characters');
  }

  return admin;
}

async function main() {
  const admin = getAdminConfig();

  if (!admin) {
    console.log('Automatic admin creation is disabled');
    return;
  }

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  prisma = new PrismaClient({ adapter });

  const passwordSalt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(admin.password, passwordSalt);
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
    await prisma?.$disconnect();
  });
