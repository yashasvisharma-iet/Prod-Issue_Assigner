'use strict';

const DEFAULT_WEIGHTS = {
  skill: 0.65,
  load: 0.25,
  availability: 0.1,
};

class AssignmentEngine {
  constructor({ repository, weights = DEFAULT_WEIGHTS } = {}) {
    if (!repository) {
      throw new Error('AssignmentEngine requires a repository');
    }

    this.repository = repository;
    this.weights = weights;
  }

  async assignIssue(issueInput, { method = 'rule' } = {}) {
    const issue = await this.repository.getIssueById(issueInput.issueId || issueInput.id);
    if (!issue) {
      throw new Error('Issue not found');
    }

    if (issue.assigned_to) {
      return {
        assigned: false,
        reason: 'already_assigned',
        issue,
      };
    }

    const features = this.extractFeatures(issueInput || issue);
    const developers = await this.repository.listAvailableDevelopers();
    if (!developers.length) {
      return {
        assigned: false,
        reason: 'no_available_developers',
        issue,
      };
    }

    const scored = this.scoreDevelopers({ developers, features });
    const topScore = scored[0].score;
    const tied = scored.filter((candidate) => candidate.score === topScore);

    const selected =
      tied.length === 1
        ? tied[0]
        : await this.repository.pickRoundRobinCandidate({
            issueId: issue.id,
            candidateIds: tied.map((candidate) => candidate.developer.id),
          });

    const winner = selected.developer ? selected : scored.find((entry) => entry.developer.id === selected.id);
    if (!winner) {
      throw new Error('Unable to select assignment candidate');
    }

    const assignment = await this.repository.assignIssueAtomically({
      issueId: issue.id,
      developerId: winner.developer.id,
      method,
    });

    return {
      assigned: true,
      assignment,
      candidate: winner,
      features,
      scored,
    };
  }

  extractFeatures(issue) {
    const title = String(issue.title || '');
    const description = String(issue.description || issue.body || '');
    const labels = (issue.labels || []).map((label) => String(label).toLowerCase());

    const text = `${title} ${description}`.toLowerCase();
    const keywords = [...new Set(tokenize(text).filter((token) => token.length > 2))];

    return {
      source: issue.source || null,
      labels,
      keywords,
      metadata: {
        titleLength: title.length,
        descriptionLength: description.length,
      },
    };
  }

  scoreDevelopers({ developers, features }) {
    const maxLoad = Math.max(...developers.map((developer) => Number(developer.current_load || 0)), 1);

    return developers
      .map((developer) => {
        const skillScore = computeSkillScore(features, developer.skills || []);
        const loadScore = 1 - Math.min(Number(developer.current_load || 0) / maxLoad, 1);
        const availabilityScore = availabilityToScore(developer.availability_status);

        const score = roundScore(
          this.weights.skill * skillScore +
            this.weights.load * loadScore +
            this.weights.availability * availabilityScore
        );

        return {
          developer,
          score,
          components: {
            skillScore: roundScore(skillScore),
            loadScore: roundScore(loadScore),
            availabilityScore: roundScore(availabilityScore),
          },
        };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return Number(a.developer.current_load || 0) - Number(b.developer.current_load || 0);
      });
  }
}

function computeSkillScore(features, skills) {
  const normalizedSkills = new Set((skills || []).map((skill) => String(skill).toLowerCase()));
  if (!normalizedSkills.size) return 0;

  const tokens = new Set([...(features.keywords || []), ...(features.labels || [])]);
  if (!tokens.size) return 0;

  let matches = 0;
  for (const token of tokens) {
    if (normalizedSkills.has(token)) {
      matches += 1;
      continue;
    }

    for (const skill of normalizedSkills) {
      if (skill.includes(token) || token.includes(skill)) {
        matches += 0.6;
        break;
      }
    }
  }

  return Math.min(matches / Math.max(tokens.size, 1), 1);
}

function availabilityToScore(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'available') return 1;
  if (normalized === 'busy') return 0.4;
  if (normalized === 'offline' || normalized === 'unavailable') return 0;
  return 0.5;
}

function tokenize(text) {
  return text
    .split(/[^a-z0-9+#.\-]+/i)
    .map((item) => item.trim())
    .filter(Boolean);
}

function roundScore(value) {
  return Math.round(value * 1000) / 1000;
}

module.exports = {
  AssignmentEngine,
  DEFAULT_WEIGHTS,
};
