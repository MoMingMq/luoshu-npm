export const API_VERSION = '0' as const

export type {
  ConnectionOptions,
  TerminalSessionOptions,
  ConnectionInfo,
  SqlDialect,
  DatabaseRef,
  TreeNodeRef,
  TreeNode,
  ListPage,
  IndexInfo,
  ColumnInfo,
  ForeignKeyAction,
  ForeignKeyInfo,
  SchemaInfo,
  QueryParams,
  QueryResult,
  ResultChunk,
  NodeQuery,
  TablePage,
  FilterOperator,
  FilterCondition,
  TableFilter,
  InsertBatchOptions,
  InsertBatchResult,
  TableDdl,
  ApplyDdlOptions,
  DdlApplyResult,
  TransactionHelper,
  ColumnDef,
  IndexDef,
  FkDef,
  TableDef,
  TableChangeRequest,
  GeneratedDdl,
  LogStreamOptions,
  LogChunk,
  ReadFileOptions,
  ReadFileResult,
  WriteFileOptions
} from './types.ts'

export type { LuoshuError } from './errors.ts'
export { createLuoshuError, isLuoshuError } from './errors.ts'

export type { DataSourceProvider, TerminalProvider } from './provider.ts'

export type {
  CommandHandler,
  InteractiveAuthPrompts,
  KeyValueStorage,
  Logger,
  PluginContext,
  PluginInteractiveAuth,
  PluginSeams,
  DDLProvider,
  TransferProvider,
  BackupProvider,
  ProviderRegistration,
  PluginActivate
} from './plugin.ts'

export { pluginCodeMetaSchema, validatePluginCodeMeta } from './metadata.ts'
export type {
  PluginCodeMeta,
  PluginFormField,
  PluginNodeType,
  PluginSettingsEntry,
  PluginSettingsGroup
} from './metadata.ts'

// 方言工具
export { quoteCharOf, quoteIdentifier, quoteTableRef, placeholderOf, parseOrderBy } from './sql-quote.ts'
export type { QuoteDialect, OrderBySegment } from './sql-quote.ts'
export { TYPE_WORDS_BY_FAMILY, mapSqliteKeyword, mapNativeToStandard, nativeVocabularyOf } from './type-words.ts'
export type { StandardType, TypeFamily } from './type-words.ts'

export {
  buildEditStatement,
  applyRowEditsViaQuery,
  applyRowEditsTransactional,
  TX_ROLLED_BACK_CODE
} from './row-edit.ts'
export type {
  RowEdit,
  EditApplyEntry,
  EditStatementBuilt,
  EditStatementExecutor,
  ApplyRowEditsOptions,
  EditTransactionRunner
} from './row-edit.ts'

// 服务端筛选：各数据源插件 nodeQuery 共用
export { buildFilterSql } from './filter.ts'
export type { FilterSql, FilterSqlOptions } from './filter.ts'

// v2 契约声明式补偿：v1 Provider+描述 → cordis 插件工厂
export { defineDataSource, projectServiceOf, normalizeRef, DATA_SOURCE_REF_ARGS } from './define-datasource.ts'
export type { DataSourceDescriptor, DataSourcePlugin } from './define-datasource.ts'

