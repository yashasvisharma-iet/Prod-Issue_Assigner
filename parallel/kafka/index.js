const { TOPICS, ensureTopics } = require('./topics');
const {
  connectProducer,
  disconnectProducer,
  publishIssueCreated,
} = require('./producer');

module.exports = {
  TOPICS,
  ensureTopics,
  connectProducer,
  disconnectProducer,
  publishIssueCreated,
};
