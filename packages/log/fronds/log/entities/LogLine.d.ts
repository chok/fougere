declare const LogLine_base: import("@fougere/schema").SchemaConstructor<{
    level: import("@fougere/schema").Field<"debug" | "error" | "info" | "warn">;
    /** Who wrote it — 'app', 'app:catalog'. */
    name: import("@fougere/schema").Field<string>;
    message: import("@fougere/schema").Field<string>;
    /** What the writer passed beside the message. */
    args: import("@fougere/schema").Field<unknown>;
    at: import("@fougere/schema").Field<Date>;
}>;
/**
 * One line. A fact about the process, announced like any other — which is what makes a
 * destination an ordinary handler and `remotes:` the only thing that decides where it runs.
 *
 * No `primary()`: an id costs 87 µs to generate (cuid2), and nothing addresses a line
 * by one. `at` is `created()`, so announcing is what fills it.
 */
export default class LogLine extends LogLine_base {
}
export {};
//# sourceMappingURL=LogLine.d.ts.map