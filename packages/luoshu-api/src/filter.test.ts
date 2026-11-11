// 服务端筛选 SQL 构造单测：占位符方言、junction 左结合、LIKE 转义、
// 值只进参数不进 SQL、空/非法条件回 undefined。
import { describe, expect, it } from 'vitest'
import { buildFilterSql } from './filter.ts'

const mysqlOpts = { quoteIdent: (name: string): string => `\`${name.replace(/`/g, '``')}\`` }

describe('buildFilterSql', () => {
  it('空/非法条件回 undefined', () => {
    expect(buildFilterSql(undefined, mysqlOpts)).toBeUndefined()
    expect(buildFilterSql({ conditions: [] }, mysqlOpts)).toBeUndefined()
    expect(buildFilterSql({ conditions: [{ field: '', operator: 'eq', value: 1 }] }, mysqlOpts)).toBeUndefined()
  })

  it('比较/空值/LIKE 转义；值只进 params', () => {
    const sql = buildFilterSql({
      conditions: [
        { field: 'name', operator: 'contains', value: '100%_done' },
        { field: 'age', operator: 'gte', value: '18', junction: 'AND' },
        { field: 'note', operator: 'isNull', junction: 'OR' },
      ],
    }, mysqlOpts)
    expect(sql).toBeDefined()
    expect(sql!.where).toContain('LIKE ? ESCAPE')
    expect(sql!.where).toContain('(`age` >= ?)')
    expect(sql!.where).toContain('(`note` IS NULL)')
    expect(sql!.params).toEqual(['%100\\%\\_done%', '18'])
    expect(sql!.where).not.toContain('100%_done')
  })

  it('junction 左结合（括号包裹）', () => {
    const sql = buildFilterSql({
      conditions: [
        { field: 'a', operator: 'eq', value: 1 },
        { field: 'b', operator: 'eq', value: 2, junction: 'AND' },
        { field: 'c', operator: 'eq', value: 3, junction: 'OR' },
      ],
    }, mysqlOpts)
    expect(sql!.where).toBe('(((`a` = ?) AND (`b` = ?)) OR (`c` = ?))')
  })

  it('PG 占位符 $n + LOWER LIKE', () => {
    const sql = buildFilterSql({
      conditions: [
        { field: 'name', operator: 'startsWith', value: 'abc' },
        { field: 'id', operator: 'gt', value: 10, junction: 'AND' },
      ],
    }, {
      quoteIdent: (name: string): string => `"${name.replace(/"/g, '""')}"`,
      placeholder: (index: number): string => `$${index}`,
      caseInsensitiveLike: true,
    })
    expect(sql!.where).toContain('LOWER("name") LIKE LOWER($1) ESCAPE')
    expect(sql!.where).toContain('"id" > $2')
    expect(sql!.params).toEqual(['abc%', 10])
  })
})
