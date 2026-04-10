'use strict';

const { AssignmentEngine } = require('./assignmentEngine');
const { SqlAssignmentRepository } = require('./sqlAssignmentRepository');

function buildEngineFromPgClient(pgClient) {
  const repository = new SqlAssignmentRepository({ db: pgClient });
  return new AssignmentEngine({ repository });
}

module.exports = {
  AssignmentEngine,
  SqlAssignmentRepository,
  buildEngineFromPgClient,
};
