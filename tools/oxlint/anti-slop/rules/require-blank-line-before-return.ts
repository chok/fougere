import { defineRule } from "@oxlint/plugins";

import type { ESTree, SourceCode } from "@oxlint/plugins";

/**
 * What really opens the statement — its own comments come first, and a comment trailing
 * the previous statement is that statement's, not this one's.
 */
function opensWith(sourceCode: SourceCode, statement: ESTree.Node, previous: ESTree.Node) {
  const own = sourceCode
    .getCommentsBefore(statement)
    .filter((comment) => comment.loc.start.line > previous.loc.end.line);

  return own.length ? own[0] : statement;
}

/** Require the blank line that sets a return apart from the work that produced it. */
export const requireBlankLineBeforeReturnRule = defineRule({
  meta: {
    type: "layout",
    docs: {
      description:
        "Require a blank line before every return that follows another statement.",
    },
    messages: {
      breathe:
        "Leave a blank line before this return — it is the answer, not the last step of the work.",
    },
    fixable: "whitespace",
  },
  createOnce(context) {
    function check(body: readonly ESTree.Node[]): void {
      body.forEach((statement, index) => {
        if (index === 0 || statement.type !== "ReturnStatement") return;

        const previous = body[index - 1];

        // A one-liner — `{ this.cancel(); return ''; }` — goes together by construction.
        if (previous.loc.end.line === statement.loc.start.line) return;

        const opening = opensWith(context.sourceCode, statement, previous);

        if (opening.loc.start.line - previous.loc.end.line >= 2) return;

        // The break goes at the START of the line, so the statement keeps its indentation.
        const opens = opening.start - opening.loc.start.column;

        context.report({
          node: statement,
          messageId: "breathe",
          fix: (fixer) => fixer.insertTextBeforeRange([opens, opens], "\n"),
        });
      });
    }

    return {
      BlockStatement(node) {
        check(node.body);
      },
      Program(node) {
        check(node.body);
      },
      StaticBlock(node) {
        check(node.body);
      },
      SwitchCase(node) {
        check(node.consequent);
      },
    };
  },
});
