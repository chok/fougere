/** TC39 Stage 3 decorator — marks a class or method as part of the frond's public contract. */

const exposedMethods = new WeakMap<object, Set<string>>();

export function expose(target: Function, context: ClassDecoratorContext): void;
export function expose(target: Function, context: ClassMethodDecoratorContext): void;
export function expose(
  target: Function,
  context: ClassDecoratorContext | ClassMethodDecoratorContext,
): void {
  if (context.kind === 'class') {
    (target as { __exposed?: boolean }).__exposed = true;
  }
  if (context.kind === 'method') {
    context.addInitializer(function (this: any) {
      const ctor = this.constructor;
      let set = exposedMethods.get(ctor);
      if (!set) {
        set = new Set();
        exposedMethods.set(ctor, set);
      }
      set.add(context.name as string);
    });
  }
}

/** Check whether a class has been marked with `@expose`. */
export function isExposed(cls: Function): boolean {
  return (cls as any).__exposed === true;
}

/** Get method names marked with `@expose` on a class. Requires one instantiation to populate. */
export function getExposedMethods(cls: Function): Set<string> {
  // Trigger initializers if not already done
  if (!exposedMethods.has(cls)) {
    try { new (cls as any)(); } catch { /* best effort */ }
  }
  return exposedMethods.get(cls) ?? new Set<string>();
}
