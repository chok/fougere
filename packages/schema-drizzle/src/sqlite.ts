/**
 * @fougere/schema-drizzle — génère des tables Drizzle SQLite depuis les entités fougere
 */
import { sqliteTable, text, integer, real, primaryKey, type SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';
import { anatomy, type AnyField, type Fields, type SchemaLike } from '@fougere/schema';

// ─── Types ─────────────────────────────────────────

type EntityClass = SchemaLike & (abstract new (...args: any[]) => any);

export interface TableEntry {
  /** Nom de la table SQL */
  tableName?: string;
  /** Entity class source */
  entity: EntityClass;
}

export type TablesInput = Record<string, TableEntry | EntityClass>;

// ─── Helpers ───────────────────────────────────────

/** camelCase → snake_case */
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function isEntityClass(value: unknown): value is EntityClass {
  return typeof value === 'function' && 'getFields' in value;
}

// ─── Core ──────────────────────────────────────────

/**
 * Génère plusieurs tables Drizzle SQLite depuis un objet d'entités.
 *
 * ```ts
 * const tables = toSqliteTables({
 *   categories: Category,
 *   products: Product,
 *   customers: Customer,
 *   orders: Order,
 *   orderLines: OrderLine,
 * });
 * ```
 *
 * Les clés deviennent les noms de tables en snake_case.
 * Les refs sont résolues automatiquement entre les entités déclarées.
 */
export function toSqliteTables<T extends TablesInput>(
  input: T,
): { [K in keyof T]: SQLiteTableWithColumns<any> } {
  // 1. Normaliser : extraire entity + tableName
  const entries: Array<{ key: string; tableName: string; entity: EntityClass }> = [];
  for (const [key, value] of Object.entries(input)) {
    if (isEntityClass(value)) {
      entries.push({ key, tableName: toSnakeCase(key), entity: value });
    } else {
      const entry = value as TableEntry;
      entries.push({
        key,
        tableName: entry.tableName ?? toSnakeCase(key),
        entity: entry.entity,
      });
    }
  }

  // 2. Créer un mapping EntityClass → clé (pour résoudre les refs)
  const entityToKey = new Map<EntityClass, string>();
  for (const entry of entries) {
    entityToKey.set(entry.entity, entry.key);
  }

  // 3. Première passe : créer les tables sans refs
  const tables: Record<string, SQLiteTableWithColumns<any>> = {};

  for (const { key, tableName, entity } of entries) {
    const fields = entity.getFields();
    const isComposite = countPrimaries(fields) > 1;
    const columns: Record<string, any> = {};

    for (const [fieldName, field] of Object.entries(fields)) {
      const col = fieldToColumn(fieldName, field, isComposite);
      if (col) {
        columns[fieldName] = col;
      }
    }

    tables[key] = isComposite
      ? sqliteTable(tableName, columns, (table) => compositePKExtras(fields, table)!)
      : sqliteTable(tableName, columns);
  }

  // 4. Deuxième passe : recréer avec les refs résolues
  const result: Record<string, SQLiteTableWithColumns<any>> = {};

  for (const { key, tableName, entity } of entries) {
    const fields = entity.getFields();
    const isComposite = countPrimaries(fields) > 1;
    const columns: Record<string, any> = {};

    for (const [fieldName, field] of Object.entries(fields)) {
      const col = fieldToColumn(fieldName, field, isComposite);
      if (!col) continue;

      // Résoudre les relations (vers une autre entité)
      if (field.role?.relation?.kind === 'one') {
        const targetEntity = field.role.relation.to() as EntityClass;
        const targetKey = entityToKey.get(targetEntity);
        if (targetKey && tables[targetKey]) {
          columns[fieldName] = col.references(() => tables[targetKey].id);
          continue;
        }
      }

      columns[fieldName] = col;
    }

    result[key] = isComposite
      ? sqliteTable(tableName, columns, (table) => compositePKExtras(fields, table)!)
      : sqliteTable(tableName, columns);
  }

  return result as any;
}

/**
 * Génère une seule table Drizzle SQLite (sans résolution de refs).
 */
export function toSqliteTable(
  tableName: string,
  entity: SchemaLike,
): SQLiteTableWithColumns<any> {
  const fields = entity.getFields();
  const isComposite = countPrimaries(fields) > 1;
  const columns: Record<string, any> = {};

  for (const [fieldName, field] of Object.entries(fields)) {
    const col = fieldToColumn(fieldName, field, isComposite);
    if (col) {
      columns[fieldName] = col;
    }
  }

  return isComposite
    ? sqliteTable(tableName, columns, (table) => compositePKExtras(fields, table)!)
    : sqliteTable(tableName, columns);
}

// ─── Helpers ──────────────────────────────────────

/** Nombre de champs clé primaire d'une entité. */
function countPrimaries(fields: Fields): number {
  return Object.values(fields).filter((f) => f.role?.primary).length;
}

/** Callback de clé primaire composite pour sqliteTable, ou undefined si PK simple. */
function compositePKExtras(fields: Fields, table: any): any[] | undefined {
  const pkNames = Object.entries(fields)
    .filter(([, f]) => f.role?.primary)
    .map(([name]) => name);
  if (pkNames.length <= 1) return undefined;
  const cols = pkNames.map((n) => table[n]);
  return [primaryKey({ columns: cols as [any, ...any[]] })];
}

// ─── Champ → Colonne ───────────────────────────────

function fieldToColumn(fieldName: string, field: AnyField, isCompositePK: boolean): any {
  const colName = toSnakeCase(fieldName);

  // Relation « many » = pas de colonne (la jointure vit côté inverse)
  if (field.role?.relation?.kind === 'many') return null;

  // Le type de colonne se déduit du seul axe `shape` (la valeur) — via anatomy,
  // car le type peut être l'union nullable [T,'null'] (sinon un entier nullable
  // tomberait en TEXT).
  const { base: shape, nullable } = anatomy(field.shape);
  let col: any;
  switch (shape?.type) {
    case 'integer':
      col = integer(colName);
      break;
    case 'number':
      col = real(colName);
      break;
    case 'boolean':
      col = integer(colName, { mode: 'boolean' });
      break;
    case 'object':
    case 'array': // value list (`list(text())`) — owned by the row, stored as JSON
      col = text(colName, { mode: 'json' });
      break;
    case 'string':
    default:
      // string (texte, enum, ref, id, date-time) → TEXT
      col = text(colName);
  }

  // Clé primaire — inline seulement pour PK simple (composite via table extras)
  if (field.role?.primary && !isCompositePK) {
    col = col.primaryKey();
  }

  if (!nullable) {
    col = col.notNull();
  }

  const create = field.lifecycle?.create;
  if (typeof create === 'object' && 'value' in create) {
    col = col.default(create.value);
  }

  return col;
}
