# Architecture decision records

These records explain decisions that shape how `mcp-lint` behaves. Each one states the context,
the decision, and its consequences.

| ADR | Decision |
| --- | --- |
| [0001](0001-lint-the-model-facing-surface.md) | Lint the model-facing surface, not the server's source code |
| [0002](0002-average-entity-scores-and-cap-on-injection.md) | Average per-entity scores and cap the score on any injection error |
| [0003](0003-permissive-list-requests.md) | Send raw list requests instead of the SDK's typed helpers |
