// Compile-time checks to ensure Database['public'] satisfies Supabase generic schema.
import type { Database } from "@/lib/types/supabase";

// Test 1: Does Database['public'] extend GenericSchema?
type GenericRelationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};
type GenericTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: GenericRelationship[];
};
type GenericView = {
  Row: Record<string, unknown>;
  Relationships: GenericRelationship[];
};
type GenericFunction = {
  Args: Record<string, unknown> | never;
  Returns: unknown;
};
type GenericSchema = {
  Tables: Record<string, GenericTable>;
  Views: Record<string, GenericView>;
  Functions: Record<string, GenericFunction>;
};

type SchemaCheck = Database['public'] extends GenericSchema ? "OK" : "FAIL";
type TablesCheck = Database['public']['Tables'] extends Record<string, GenericTable> ? "OK" : "FAIL";
type ViewsCheck = Database['public']['Views'] extends Record<string, GenericView> ? "OK" : "FAIL";
type FunctionsCheck = Database['public']['Functions'] extends Record<string, GenericFunction> ? "OK" : "FAIL";

// Check a single table
type ProfileTableCheck = Database['public']['Tables']['profiles'] extends GenericTable ? "OK" : "FAIL";
type ProfileRowCheck = Database['public']['Tables']['profiles']['Row'] extends Record<string, unknown> ? "OK" : "FAIL";
type ProfileInsertCheck = Database['public']['Tables']['profiles']['Insert'] extends Record<string, unknown> ? "OK" : "FAIL";
type ProfileRelCheck = Database['public']['Tables']['profiles']['Relationships'] extends GenericRelationship[] ? "OK" : "FAIL";

type AssertOk<T extends "OK"> = T;

type CheckSchema = AssertOk<SchemaCheck>;
type CheckTables = AssertOk<TablesCheck>;
type CheckViews = AssertOk<ViewsCheck>;
type CheckFunctions = AssertOk<FunctionsCheck>;
type CheckProfileTable = AssertOk<ProfileTableCheck>;
type CheckProfileRow = AssertOk<ProfileRowCheck>;
type CheckProfileInsert = AssertOk<ProfileInsertCheck>;
type CheckProfileRelationships = AssertOk<ProfileRelCheck>;

export type {
  CheckFunctions,
  CheckProfileInsert,
  CheckProfileRelationships,
  CheckProfileRow,
  CheckProfileTable,
  CheckSchema,
  CheckTables,
  CheckViews,
};
