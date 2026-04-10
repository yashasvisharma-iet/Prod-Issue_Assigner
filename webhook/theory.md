# Resolving Dependency 

From what I understand, to "resolve a dependency" means to "go get" it (i.e. from the service container) so it can be "used" where it's being injected or "passed" into.

const resolvedDeps = resolveControllerDependencies(deps);

function resolveControllerDependencies({  service, parser, idempotencyStore, logger } = {}) {
  return {
    service: resolveService(service, logger),
    parser: parser || new WebhookParser(),
    idempotencyStore: idempotencyStore || new WebhookIdempotencyStore(),
    logger: logger || console,
  };
}