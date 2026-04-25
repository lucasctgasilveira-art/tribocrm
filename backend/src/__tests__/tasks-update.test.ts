/// <reference types="vitest/globals" />
// Unit test para buildTaskUpdateData — função pura que monta o
// Prisma.TaskUpdateInput a partir do body do PATCH /tasks/:id.
//
// Foco principal: comportamento do campo `isDone` adicionado pra
// permitir desmarcar tarefas (E3-A). Cobertura também valida que os
// campos pré-existentes continuam funcionando como antes.

import { buildTaskUpdateData } from '../controllers/tasks.controller'

describe('buildTaskUpdateData — isDone (E3-A)', () => {
  it('isDone=true → seta isDone=true e doneAt=Date(agora)', () => {
    const data = buildTaskUpdateData({ isDone: true })
    expect(data.isDone).toBe(true)
    expect(data.doneAt).toBeInstanceOf(Date)
  })

  it('isDone=false → seta isDone=false e doneAt=null (desmarcar)', () => {
    const data = buildTaskUpdateData({ isDone: false })
    expect(data.isDone).toBe(false)
    expect(data.doneAt).toBeNull()
  })

  it('sem isDone no body → não toca isDone nem doneAt', () => {
    const data = buildTaskUpdateData({ title: 'Apenas título' })
    expect(data).not.toHaveProperty('isDone')
    expect(data).not.toHaveProperty('doneAt')
    expect(data.title).toBe('Apenas título')
  })
})

describe('buildTaskUpdateData — campos pré-existentes (regressão)', () => {
  it('aplica title, description e type quando presentes', () => {
    const data = buildTaskUpdateData({
      title: 't1',
      description: 'd1',
      type: 'CALL',
    })
    expect(data.title).toBe('t1')
    expect(data.description).toBe('d1')
    expect(data.type).toBe('CALL')
  })

  it('dueDate string → Date instance; dueDate null → null', () => {
    const withDate = buildTaskUpdateData({ dueDate: '2026-05-01T12:00:00Z' })
    expect(withDate.dueDate).toBeInstanceOf(Date)

    const cleared = buildTaskUpdateData({ dueDate: null })
    expect(cleared.dueDate).toBeNull()
  })

  it('responsibleId vira connect: { id }', () => {
    const data = buildTaskUpdateData({ responsibleId: 'user-42' })
    expect(data.responsible).toEqual({ connect: { id: 'user-42' } })
  })

  it('body vazio → data vazio (ninguém é alterado)', () => {
    const data = buildTaskUpdateData({})
    expect(Object.keys(data)).toHaveLength(0)
  })
})
