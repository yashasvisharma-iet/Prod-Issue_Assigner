'use strict';

class SqlAssignmentRepository {
  constructor({ db }) {
    if (!db || typeof db.query !== 'function') {
      throw new Error('SqlAssignmentRepository requires a db client exposing query(sql, params)');
    }

    this.db = db;
  }

  async getIssueById(issueId) {
    const result = await this.db.query(
      `SELECT id, title, description, source, status, assigned_to, created_at
       FROM issues
       WHERE id = $1`,
      [issueId]
    );

    return result.rows[0] || null;
  }

  async listAvailableDevelopers() {
    const result = await this.db.query(
      `SELECT id, name, email, skills, current_load, availability_status
       FROM developers
       WHERE LOWER(COALESCE(availability_status, 'available')) <> 'offline'
       ORDER BY current_load ASC, id ASC`
    );

    return result.rows.map((row) => ({
      ...row,
      skills: normalizeSkills(row.skills),
    }));
  }

  async pickRoundRobinCandidate({ candidateIds }) {
    if (!candidateIds.length) {
      throw new Error('No candidate IDs supplied for round robin selection');
    }

    const result = await this.db.query(
      `SELECT d.id,
              MAX(a.assigned_at) AS last_assigned_at
       FROM developers d
       LEFT JOIN assignments a ON a.developer_id = d.id
       WHERE d.id = ANY($1::int[])
       GROUP BY d.id
       ORDER BY last_assigned_at ASC NULLS FIRST, d.id ASC
       LIMIT 1`,
      [candidateIds]
    );

    return result.rows[0] || { id: candidateIds[0] };
  }

  async assignIssueAtomically({ issueId, developerId, method }) {
    await this.db.query('BEGIN');

    try {
      const issueLock = await this.db.query(
        `SELECT id, assigned_to, status
         FROM issues
         WHERE id = $1
         FOR UPDATE`,
        [issueId]
      );

      const issue = issueLock.rows[0];
      if (!issue) {
        throw new Error('Issue not found during assignment transaction');
      }

      if (issue.assigned_to) {
        await this.db.query('ROLLBACK');
        return {
          assigned: false,
          reason: 'already_assigned',
          issueId,
          developerId: issue.assigned_to,
        };
      }

      await this.db.query(
        `UPDATE issues
         SET assigned_to = $2,
             status = 'assigned'
         WHERE id = $1`,
        [issueId, developerId]
      );

      const assignmentInsert = await this.db.query(
        `INSERT INTO assignments (issue_id, developer_id, assigned_at, method)
         VALUES ($1, $2, NOW(), $3)
         RETURNING id, issue_id, developer_id, assigned_at, method`,
        [issueId, developerId, method]
      );

      await this.db.query(
        `UPDATE developers
         SET current_load = COALESCE(current_load, 0) + 1
         WHERE id = $1`,
        [developerId]
      );

      await this.db.query('COMMIT');
      return {
        assigned: true,
        ...assignmentInsert.rows[0],
      };
    } catch (error) {
      await this.db.query('ROLLBACK');
      throw error;
    }
  }
}

function normalizeSkills(skillsValue) {
  if (!skillsValue) return [];
  if (Array.isArray(skillsValue)) return skillsValue;

  if (typeof skillsValue === 'string') {
    try {
      const parsed = JSON.parse(skillsValue);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return skillsValue
        .split(',')
        .map((skill) => skill.trim())
        .filter(Boolean);
    }
  }

  return [];
}

module.exports = {
  SqlAssignmentRepository,
};
