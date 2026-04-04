import { prisma } from '../db/prisma.js';

export async function pickDeveloperPlaceholder() {
  return prisma.developer.findFirst({
    where: { availabilityStatus: 'available' },
    orderBy: [{ currentLoad: 'asc' }, { createdAt: 'asc' }]
  });
}

export async function assignIssue(issueId) {
  const developer = await pickDeveloperPlaceholder();
  if (!developer) return null;

  await prisma.$transaction([
    prisma.issue.update({ where: { id: issueId }, data: { assignedTo: developer.id } }),
    prisma.assignment.create({
      data: {
        issueId,
        developerId: developer.id,
        method: 'placeholder_phase1',
        reason: 'Phase 1 placeholder: lowest current load available developer'
      }
    }),
    prisma.developer.update({
      where: { id: developer.id },
      data: { currentLoad: { increment: 1 } }
    })
  ]);

  return developer;
}
