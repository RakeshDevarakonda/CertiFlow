import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Password@123';
const STATE_NAME = 'Maharashtra';

async function main() {
  console.log('🌱 Starting database seed...');

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // 1. Seed Anika (Training Centre User)
  const anika = await prisma.user.upsert({
    where: { email: 'anika@certiflow.com' },
    update: {
      name: 'Anika Sharma',
      role: Role.TRAINING_CENTRE,
      state: STATE_NAME,
      district: 'Pune',
      passwordHash
    },
    create: {
      email: 'anika@certiflow.com',
      name: 'Anika Sharma',
      role: Role.TRAINING_CENTRE,
      state: STATE_NAME,
      district: 'Pune',
      passwordHash
    }
  });

  // Link Anika to Apex Training Centre
  await prisma.trainingCentre.upsert({
    where: { code: 'TC-PUN-001' },
    update: {
      name: 'Apex Skills Training Centre',
      state: STATE_NAME,
      district: 'Pune',
      userId: anika.id
    },
    create: {
      code: 'TC-PUN-001',
      name: 'Apex Skills Training Centre',
      state: STATE_NAME,
      district: 'Pune',
      userId: anika.id
    }
  });

  // 2. Seed Dev (District Officer - Pune)
  await prisma.user.upsert({
    where: { email: 'dev@certiflow.com' },
    update: {
      name: 'Dev Patel',
      role: Role.DISTRICT_OFFICER,
      state: STATE_NAME,
      district: 'Pune',
      passwordHash
    },
    create: {
      email: 'dev@certiflow.com',
      name: 'Dev Patel',
      role: Role.DISTRICT_OFFICER,
      state: STATE_NAME,
      district: 'Pune',
      passwordHash
    }
  });

  // 3. Seed Meera (District Officer - Pune)
  await prisma.user.upsert({
    where: { email: 'meera@certiflow.com' },
    update: {
      name: 'Meera Deshmukh',
      role: Role.DISTRICT_OFFICER,
      state: STATE_NAME,
      district: 'Pune',
      passwordHash
    },
    create: {
      email: 'meera@certiflow.com',
      name: 'Meera Deshmukh',
      role: Role.DISTRICT_OFFICER,
      state: STATE_NAME,
      district: 'Pune',
      passwordHash
    }
  });

  // 4. Seed Kabir (District Officer - Pune)
  await prisma.user.upsert({
    where: { email: 'kabir@certiflow.com' },
    update: {
      name: 'Kabir Joshi',
      role: Role.DISTRICT_OFFICER,
      state: STATE_NAME,
      district: 'Pune',
      passwordHash
    },
    create: {
      email: 'kabir@certiflow.com',
      name: 'Kabir Joshi',
      role: Role.DISTRICT_OFFICER,
      state: STATE_NAME,
      district: 'Pune',
      passwordHash
    }
  });

  // 5. Seed Neha (Quality Officer - Statewide)
  await prisma.user.upsert({
    where: { email: 'neha@certiflow.com' },
    update: {
      name: 'Neha Kulkarni',
      role: Role.QUALITY_OFFICER,
      state: STATE_NAME,
      district: null, // Statewide scope across all districts
      passwordHash
    },
    create: {
      email: 'neha@certiflow.com',
      name: 'Neha Kulkarni',
      role: Role.QUALITY_OFFICER,
      state: STATE_NAME,
      district: null,
      passwordHash
    }
  });

  // 6. Seed Farah (State Office - Statewide)
  await prisma.user.upsert({
    where: { email: 'farah@certiflow.com' },
    update: {
      name: 'Farah Khan',
      role: Role.STATE_OFFICE,
      state: STATE_NAME,
      district: null, // Statewide scope across all districts
      passwordHash
    },
    create: {
      email: 'farah@certiflow.com',
      name: 'Farah Khan',
      role: Role.STATE_OFFICE,
      state: STATE_NAME,
      district: null,
      passwordHash
    }
  });

  console.log('✅ Seed complete: 6 default demo accounts created.');
  console.log('🔑 Default password for all demo accounts: Password@123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
